import { db } from './db'
import type { DayKey, Habit, HabitLog, Win } from './types'
import { newId, nowIso } from '../lib/id'
import { todayKey, type WeekStart } from '../lib/dates'
import { allDoneOn, isDoneValue, type LogMap } from '../lib/streaks'
import { t } from '../i18n/ru'

export type NewHabit = Partial<Omit<Habit, 'id' | 'createdAt' | 'updatedAt'>> & { name: string }

/** refId победы «Все привычки дня выполнены» */
export const ALL_HABITS_REF = 'all-habits'

export async function addHabit(input: NewHabit): Promise<string> {
  const now = nowIso()
  const last = await db.habits.orderBy('order').last()
  const habit: Habit = {
    emoji: '✨',
    color: '#e8913a',
    type: 'check',
    target: 1,
    unit: '',
    schedule: { kind: 'daily' },
    archived: false,
    startDate: todayKey(),
    ...input,
    order: (last?.order ?? -1) + 1,
    name: input.name.trim(),
    id: newId(),
    createdAt: now,
    updatedAt: now,
  }
  await db.habits.add(habit)
  return habit.id
}

export async function updateHabit(id: string, patch: Partial<Habit>) {
  await db.habits.update(id, { ...patch, updatedAt: nowIso() })
}

export async function reorderHabits(ids: string[]) {
  const now = nowIso()
  await db.habits.bulkUpdate(ids.map((key, order) => ({ key, changes: { order, updatedAt: now } })))
}

export interface HabitSnapshot {
  habit: Habit
  logs: HabitLog[]
  wins: Win[]
}

/** Удалить привычку вместе с отметками. Возвращает снимок для «Отменить». */
export async function deleteHabit(id: string): Promise<HabitSnapshot | undefined> {
  return db.transaction('rw', db.habits, db.habitLogs, db.wins, async () => {
    const habit = await db.habits.get(id)
    if (!habit) return undefined
    const logs = await db.habitLogs.where('habitId').equals(id).toArray()
    const wins = await db.wins.where('refId').equals(id).toArray()
    await db.habitLogs.bulkDelete(logs.map((l) => l.id))
    await db.wins.bulkDelete(wins.map((w) => w.id))
    await db.habits.delete(id)
    return { habit, logs, wins }
  })
}

export async function restoreHabit(s: HabitSnapshot) {
  await db.transaction('rw', db.habits, db.habitLogs, db.wins, async () => {
    await db.habits.put(s.habit)
    await db.habitLogs.bulkPut(s.logs)
    await db.wins.bulkPut(s.wins)
  })
}

/** Все отметки активных привычек, сгруппированные по привычке */
export async function loadLogMaps(): Promise<Map<string, LogMap>> {
  const out = new Map<string, LogMap>()
  for (const l of await db.habitLogs.toArray()) {
    let m = out.get(l.habitId)
    if (!m) out.set(l.habitId, (m = new Map()))
    m.set(l.date, l.value)
  }
  return out
}

function winText(h: Habit, value: number): string {
  const base = `${h.emoji} ${h.name}`
  return h.type === 'count' && h.unit ? `${base}: ${value} ${h.unit}` : base
}

export interface LogResult {
  /** Привычка стала выполненной в этот день */
  becameDone: boolean
  /** Этим действием выполнены все привычки дня */
  allDoneNow: boolean
}

/**
 * Записать значение привычки за день (0 — снять отметку).
 * Сама добавляет/убирает победу «привычка выполнена» и «все привычки дня выполнены».
 */
export async function setHabitValue(
  habitId: string,
  date: DayKey,
  value: number,
  weekStartsOn: WeekStart = 1,
): Promise<LogResult> {
  return db.transaction('rw', db.habits, db.habitLogs, db.wins, async () => {
    const habit = await db.habits.get(habitId)
    if (!habit) return { becameDone: false, allDoneNow: false }
    const now = nowIso()
    value = Math.max(0, Math.round(value))

    const existing = await db.habitLogs.where('[habitId+date]').equals([habitId, date]).first()
    const wasDone = isDoneValue(habit, existing?.value)
    if (existing) {
      if (value === 0 && !existing.note) await db.habitLogs.delete(existing.id)
      else await db.habitLogs.update(existing.id, { value, updatedAt: now })
    } else if (value > 0) {
      await db.habitLogs.add({ id: newId(), habitId, date, value, note: '', createdAt: now, updatedAt: now })
    }
    const isDone = isDoneValue(habit, value)

    // Победа за эту привычку в этот день
    const habitWins = db.wins.where('refId').equals(habitId).filter((w) => w.date === date && w.source === 'habit')
    if (isDone && !wasDone) {
      await db.wins.add({
        id: newId(),
        date,
        text: winText(habit, value),
        size: 'small',
        source: 'habit',
        refId: habitId,
        createdAt: now,
        updatedAt: now,
      })
    } else if (!isDone && wasDone) {
      await habitWins.delete()
    } else if (isDone) {
      await habitWins.modify({ text: winText(habit, value), updatedAt: now })
    }

    // «Все привычки дня выполнены»
    const active = (await db.habits.toArray()).filter((h) => !h.archived)
    const logs = await loadLogMaps()
    const { all } = allDoneOn(active, logs, date, weekStartsOn)
    const allWin = db.wins.where('refId').equals(ALL_HABITS_REF).filter((w) => w.date === date)
    const hadAll = (await allWin.count()) > 0
    if (all && !hadAll) {
      await db.wins.add({
        id: newId(),
        date,
        text: t.habits.allDoneWin,
        size: 'medium',
        source: 'habit',
        refId: ALL_HABITS_REF,
        createdAt: now,
        updatedAt: now,
      })
    } else if (!all && hadAll) {
      await allWin.delete()
    }

    return { becameDone: isDone && !wasDone, allDoneNow: all && !hadAll }
  })
}

export async function setHabitNote(habitId: string, date: DayKey, note: string) {
  const now = nowIso()
  const existing = await db.habitLogs.where('[habitId+date]').equals([habitId, date]).first()
  if (existing) {
    if (!note && existing.value === 0) await db.habitLogs.delete(existing.id)
    else await db.habitLogs.update(existing.id, { note, updatedAt: now })
  } else if (note) {
    await db.habitLogs.add({ id: newId(), habitId, date, value: 0, note, createdAt: now, updatedAt: now })
  }
}

/* ---------- Шаблоны ---------- */

export interface HabitTemplate {
  key: string
  name: string
  emoji: string
  color: string
  type: 'check' | 'count'
  target: number
  unit: string
}

export const HABIT_TEMPLATES: HabitTemplate[] = [
  { key: 'water', name: 'Вода', emoji: '💧', color: '#3b82c4', type: 'count', target: 8, unit: 'стаканов' },
  { key: 'sport', name: 'Спорт', emoji: '🏃', color: '#e5654b', type: 'check', target: 1, unit: '' },
  { key: 'read', name: 'Чтение 20 минут', emoji: '📖', color: '#8b6fd6', type: 'check', target: 1, unit: '' },
  { key: 'study', name: 'Учёба', emoji: '🎓', color: '#2a9d82', type: 'check', target: 1, unit: '' },
  { key: 'pray', name: 'Молитва / медитация', emoji: '🤲', color: '#d4a03a', type: 'check', target: 1, unit: '' },
  { key: 'walk', name: 'Прогулка', emoji: '🚶', color: '#5aa55a', type: 'check', target: 1, unit: '' },
  { key: 'early', name: 'Ранний подъём', emoji: '🌅', color: '#e8913a', type: 'check', target: 1, unit: '' },
  { key: 'nosugar', name: 'Без сахара', emoji: '🍏', color: '#62a83c', type: 'check', target: 1, unit: '' },
  { key: 'english', name: 'Английский', emoji: '🇬🇧', color: '#3b6fc4', type: 'check', target: 1, unit: '' },
  { key: 'sleep', name: 'Сон до 23:00', emoji: '🌙', color: '#6c5fc7', type: 'check', target: 1, unit: '' },
]

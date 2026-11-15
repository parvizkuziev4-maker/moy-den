import type { DayEntry, DayKey, Habit, Task } from '../db/types'
import { dayKey } from './dates'
import { isDoneValue, isScheduled, type LogMap } from './streaks'

// Статистика. Чистые функции — см. stats.test.ts

export interface MoodHabitObs {
  habit: Habit
  /** Среднее настроение в дни, когда привычка сделана */
  withAvg: number
  /** …и в дни по расписанию, когда не сделана */
  withoutAvg: number
  withN: number
  withoutN: number
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

/**
 * Простое наблюдение «настроение и привычки»: среднее настроение в дни с привычкой и без неё.
 * Нужно минимум minDays дней в каждой группе. Сначала — самая заметная разница.
 */
export function moodByHabit(
  habits: Habit[],
  logs: Map<string, LogMap>,
  days: Pick<DayEntry, 'date' | 'mood'>[],
  from: DayKey,
  to: DayKey,
  minDays = 3,
): MoodHabitObs[] {
  const moodDays = days.filter((d) => d.mood && d.date >= from && d.date <= to)
  const out: MoodHabitObs[] = []
  for (const h of habits) {
    if (h.archived) continue
    const l = logs.get(h.id) ?? new Map()
    const withM: number[] = []
    const withoutM: number[] = []
    for (const d of moodDays) {
      if (d.date < h.startDate) continue
      if (isDoneValue(h, l.get(d.date))) withM.push(d.mood!)
      else if (isScheduled(h, d.date)) withoutM.push(d.mood!)
    }
    if (withM.length >= minDays && withoutM.length >= minDays) {
      out.push({ habit: h, withAvg: avg(withM), withoutAvg: avg(withoutM), withN: withM.length, withoutN: withoutM.length })
    }
  }
  return out.sort((a, b) => Math.abs(b.withAvg - b.withoutAvg) - Math.abs(a.withAvg - a.withoutAvg))
}

/** Выполненные задачи за период по сферам: areaId ('' — без сферы) → число */
export function tasksByArea(tasks: Task[], from: DayKey, to: DayKey): Map<string, number> {
  const m = new Map<string, number>()
  for (const x of tasks) {
    if (!x.done || !x.doneAt) continue
    const d = dayKey(new Date(x.doneAt))
    if (d < from || d > to) continue
    m.set(x.areaId ?? '', (m.get(x.areaId ?? '') ?? 0) + 1)
  }
  return m
}

/** Округление до одного знака для текста («4.2») */
export const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toFixed(1)

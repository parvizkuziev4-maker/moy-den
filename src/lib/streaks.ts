import type { DayKey, Habit } from '../db/types'
import { addDaysKey, isoWeekday, type WeekStart } from './dates'

// Логика серий и процентов привычек. Чистые функции — покрыты тестами (streaks.test.ts).

export type HabitLike = Pick<Habit, 'type' | 'target' | 'schedule' | 'startDate'>
/** Отметки одной привычки: дата → значение */
export type LogMap = Map<DayKey, number>

export interface SoftMode {
  /** Мягкий режим: пропуск не ломает серию */
  enabled: boolean
  /** Сколько пропусков в неделю прощается */
  restPerWeek: number
  weekStartsOn: WeekStart
}

export const SOFT_OFF: SoftMode = { enabled: false, restPerWeek: 0, weekStartsOn: 1 }

export function isDoneValue(h: Pick<Habit, 'type' | 'target'>, v: number | undefined): boolean {
  if (v === undefined) return false
  return h.type === 'check' ? v >= 1 : v >= Math.max(1, h.target)
}

/** Нужно ли делать привычку в этот день по расписанию */
export function isScheduled(h: Pick<Habit, 'schedule'>, day: DayKey): boolean {
  switch (h.schedule.kind) {
    case 'daily':
    case 'timesPerWeek':
      return true
    case 'days':
      return h.schedule.days.includes(isoWeekday(day))
  }
}

/** Первый день недели, в которую входит day */
export function weekStartKey(day: DayKey, weekStartsOn: WeekStart): DayKey {
  const first = weekStartsOn === 1 ? 1 : 7
  return addDaysKey(day, -((isoWeekday(day) - first + 7) % 7))
}

/** С какого дня считать: дата начала или самая ранняя отметка (если отметили прошлые дни) */
function effectiveStart(h: HabitLike, logs: LogMap): DayKey {
  let start = h.startDate
  for (const [d, v] of logs) if (v > 0 && d < start) start = d
  return start
}

export interface StreakInfo {
  current: number
  best: number
  /** Для «N раз в неделю» серия считается в неделях */
  unit: 'days' | 'weeks'
}

/**
 * Текущая и лучшая серия.
 * - Считаются только дни по расписанию.
 * - Сегодня ещё не отмечено — серия не сгорает (день ещё идёт).
 * - Мягкий режим: до restPerWeek пропусков в календарную неделю прощаются (серия не растёт, но и не сгорает).
 */
export function streaks(h: HabitLike, logs: LogMap, today: DayKey, soft: SoftMode = SOFT_OFF): StreakInfo {
  const start = effectiveStart(h, logs)
  if (start > today) return { current: 0, best: 0, unit: h.schedule.kind === 'timesPerWeek' ? 'weeks' : 'days' }

  if (h.schedule.kind === 'timesPerWeek') {
    const times = Math.max(1, h.schedule.times)
    const thisWeek = weekStartKey(today, soft.weekStartsOn)
    let run = 0
    let best = 0
    for (let w = weekStartKey(start, soft.weekStartsOn); w <= thisWeek; w = addDaysKey(w, 7)) {
      let done = 0
      for (let i = 0; i < 7; i++) {
        const d = addDaysKey(w, i)
        if (d >= start && d <= today && isDoneValue(h, logs.get(d))) done++
      }
      if (done >= times) {
        run++
        best = Math.max(best, run)
      } else if (w !== thisWeek) {
        run = 0
      }
    }
    return { current: run, best, unit: 'weeks' }
  }

  let run = 0
  let best = 0
  const restUsed = new Map<DayKey, number>()
  for (let d = start; d <= today; d = addDaysKey(d, 1)) {
    if (!isScheduled(h, d)) continue
    if (isDoneValue(h, logs.get(d))) {
      run++
      best = Math.max(best, run)
      continue
    }
    if (d === today) continue // день ещё не закончился
    if (soft.enabled && run > 0) {
      const wk = weekStartKey(d, soft.weekStartsOn)
      const used = restUsed.get(wk) ?? 0
      if (used < soft.restPerWeek) {
        restUsed.set(wk, used + 1)
        continue
      }
    }
    run = 0
  }
  return { current: run, best, unit: 'days' }
}

/** Процент выполнения за последние n дней (0–1). null — пока не из чего считать. */
export function completionRate(h: HabitLike, logs: LogMap, today: DayKey, n: number): number | null {
  const start = effectiveStart(h, logs)
  const from = addDaysKey(today, -(n - 1))
  let done = 0
  let expected = 0
  let days = 0
  for (let d = from > start ? from : start; d <= today; d = addDaysKey(d, 1)) {
    const isDone = isDoneValue(h, logs.get(d))
    // сегодняшний день считаем только если уже сделано
    if (d === today && !isDone) continue
    days++
    if (h.schedule.kind === 'timesPerWeek') {
      if (isDone) done++
    } else if (isScheduled(h, d)) {
      expected++
      if (isDone) done++
    }
  }
  if (h.schedule.kind === 'timesPerWeek') expected = (Math.max(1, h.schedule.times) * days) / 7
  if (expected <= 0) return null
  return Math.min(1, done / expected)
}

/** Сколько раз сделано на неделе, в которую входит day */
export function doneThisWeek(h: HabitLike, logs: LogMap, day: DayKey, weekStartsOn: WeekStart): number {
  const w = weekStartKey(day, weekStartsOn)
  let n = 0
  for (let i = 0; i < 7; i++) if (isDoneValue(h, logs.get(addDaysKey(w, i)))) n++
  return n
}

/**
 * Нужно ли делать привычку в этот день (для списка и «все привычки выполнены»).
 * «N раз в неделю»: нужна, пока норма недели не набрана (или если уже отмечена сегодня).
 */
export function isDue(h: HabitLike, logs: LogMap, day: DayKey, weekStartsOn: WeekStart): boolean {
  if (h.schedule.kind === 'timesPerWeek') {
    if (isDoneValue(h, logs.get(day))) return true
    return doneThisWeek(h, logs, day, weekStartsOn) < Math.max(1, h.schedule.times)
  }
  return isScheduled(h, day)
}

/** Все ли привычки, нужные в этот день, выполнены */
export function allDoneOn(
  habits: (HabitLike & { id: string })[],
  logsByHabit: Map<string, LogMap>,
  day: DayKey,
  weekStartsOn: WeekStart,
): { due: number; done: number; all: boolean } {
  let due = 0
  let done = 0
  for (const h of habits) {
    const logs = logsByHabit.get(h.id) ?? new Map()
    if (!isDue(h, logs, day, weekStartsOn)) continue
    due++
    if (isDoneValue(h, logs.get(day))) done++
  }
  return { due, done, all: due > 0 && done === due }
}

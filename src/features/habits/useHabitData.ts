import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { loadLogMaps, setHabitValue } from '../../db/habits'
import type { DayKey, Habit } from '../../db/types'
import { usePrefs } from '../../lib/prefs'
import type { LogMap, SoftMode } from '../../lib/streaks'
import { todayKey } from '../../lib/dates'
import { confetti } from '../../lib/confetti'
import { showToast } from '../../lib/toast'
import { t } from '../../i18n/ru'

const NO_HABITS: Habit[] = []
const NO_LOGS = new Map<string, LogMap>()
export const EMPTY_LOG: LogMap = new Map()

/** Привычки по порядку. archived: false — активные, true — архив. */
export function useHabits(archived = false): Habit[] {
  return (
    useLiveQuery(
      async () => (await db.habits.orderBy('order').toArray()).filter((h) => h.archived === archived),
      [archived],
    ) ?? NO_HABITS
  )
}

export function useLogMaps(): Map<string, LogMap> {
  return useLiveQuery(loadLogMaps, []) ?? NO_LOGS
}

export function useSoftMode(): SoftMode {
  const p = usePrefs()
  return { enabled: p.softHabits, restPerWeek: p.restDaysPerWeek, weekStartsOn: p.weekStartsOn }
}

/** Отметить привычку + праздник, если сегодня выполнены все */
export async function setValueWithCelebration(habit: Habit, date: DayKey, value: number, weekStartsOn: 0 | 1) {
  const r = await setHabitValue(habit.id, date, value, weekStartsOn)
  if (r.allDoneNow && date === todayKey()) {
    confetti()
    showToast(t.habits.allDoneToast)
  }
}

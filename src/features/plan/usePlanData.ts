import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Area, DayKey, Person, Task } from '../../db/types'
import { sortTasks } from '../../db/tasks'

const EMPTY: Task[] = []

export function useAreas(): Map<string, Area> {
  const areas = useLiveQuery(() => db.areas.orderBy('order').toArray(), [])
  return new Map((areas ?? []).map((a) => [a.id, a]))
}

export function usePeopleMap(): Map<string, Person> {
  const people = useLiveQuery(() => db.people.orderBy('name').toArray(), [])
  return new Map((people ?? []).map((p) => [p.id, p]))
}

export function useTasksOn(date: DayKey | ''): Task[] {
  return useLiveQuery(async () => sortTasks(await db.tasks.where('date').equals(date).toArray()), [date]) ?? EMPTY
}

/** Задачи в диапазоне дат включительно */
export function useTasksBetween(from: DayKey, to: DayKey): Task[] {
  return (
    useLiveQuery(
      async () => sortTasks(await db.tasks.where('date').between(from, to, true, true).toArray()),
      [from, to],
    ) ?? EMPTY
  )
}

export function useOverdue(today: DayKey): Task[] {
  return (
    useLiveQuery(
      async () =>
        sortTasks(
          await db.tasks
            .where('date')
            .between('0', today, true, false)
            .filter((t) => !t.done)
            .toArray(),
        ),
      [today],
    ) ?? EMPTY
  )
}

export function useTaskSearch(query: string): Task[] {
  const q = query.trim().toLowerCase()
  return (
    useLiveQuery(async () => {
      if (!q) return EMPTY
      const all = await db.tasks.toArray()
      const hits = all.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.notes.toLowerCase().includes(q) ||
          t.subtasks.some((s) => s.title.toLowerCase().includes(q)),
      )
      // недавние даты выше
      return hits.sort((a, b) => (b.date || '9').localeCompare(a.date || '9')).slice(0, 100)
    }, [q]) ?? EMPTY
  )
}

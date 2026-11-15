import { db } from './db'
import type { DayKey, Subtask, Task, Win } from './types'
import { newId, nowIso } from '../lib/id'
import { nextOccurrence } from '../lib/recurrence'
import { addDaysKey, todayKey } from '../lib/dates'

export type NewTask = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>> & { title: string }

export async function addTask(input: NewTask): Promise<string> {
  const now = nowIso()
  const task: Task = {
    notes: '',
    date: '',
    priority: 2,
    done: false,
    repeat: { kind: 'none' },
    subtasks: [],
    order: Date.now(),
    ...input,
    title: input.title.trim(),
    id: newId(),
    createdAt: now,
    updatedAt: now,
  }
  await db.tasks.add(task)
  return task.id
}

export async function updateTask(id: string, patch: Partial<Task>) {
  await db.tasks.update(id, { ...patch, updatedAt: nowIso() })
}

/**
 * Отметить / снять отметку.
 * Выполнено → победа в этот день (source = task) и, если задача повторяется, следующий повтор.
 * Снята отметка → победа удаляется, а нетронутый следующий повтор убирается.
 */
export async function toggleTask(id: string, today: DayKey = todayKey()): Promise<boolean> {
  return db.transaction('rw', db.tasks, db.wins, async () => {
    const task = await db.tasks.get(id)
    if (!task) return false
    const now = nowIso()

    if (!task.done) {
      let spawnedNextId = task.spawnedNextId
      if (task.repeat.kind !== 'none' && !spawnedNextId) {
        const next = nextOccurrence(task.repeat, task.date, today)
        if (next) {
          spawnedNextId = newId()
          await db.tasks.add({
            ...task,
            id: spawnedNextId,
            date: next,
            done: false,
            doneAt: undefined,
            spawnedNextId: undefined,
            subtasks: task.subtasks.map((s) => ({ ...s, id: newId(), done: false })),
            createdAt: now,
            updatedAt: now,
          })
        }
      }
      await db.tasks.update(id, { done: true, doneAt: now, spawnedNextId, updatedAt: now })
      const win: Win = {
        id: newId(),
        date: today,
        text: task.title,
        areaId: task.areaId,
        size: task.priority === 1 ? 'medium' : 'small',
        source: 'task',
        refId: id,
        createdAt: now,
        updatedAt: now,
      }
      await db.wins.add(win)
      return true
    }

    await db.wins
      .where('refId')
      .equals(id)
      .filter((w) => w.source === 'task')
      .delete()
    let spawnedNextId = task.spawnedNextId
    if (spawnedNextId) {
      const next = await db.tasks.get(spawnedNextId)
      // Удаляем следующий повтор, только если его ещё не трогали
      if (!next || (!next.done && next.updatedAt === next.createdAt)) {
        if (next) await db.tasks.delete(next.id)
        spawnedNextId = undefined
      }
    }
    await db.tasks.update(id, { done: false, doneAt: undefined, spawnedNextId, updatedAt: now })
    return false
  })
}

export async function deleteTask(id: string): Promise<Task | undefined> {
  const task = await db.tasks.get(id)
  if (task) await db.tasks.delete(id)
  return task
}

/** Вернуть удалённую задачу (кнопка «Отменить»). */
export async function restoreTask(task: Task) {
  await db.tasks.put(task)
}

export async function moveTasks(ids: string[], date: DayKey | '') {
  const now = nowIso()
  await db.tasks.bulkUpdate(ids.map((key) => ({ key, changes: { date, updatedAt: now } })))
}

/** «Перенести на завтра»: просроченная — на завтра от сегодня, будущая — на день позже. */
export function tomorrowFor(task: Pick<Task, 'date'>, today: DayKey = todayKey()): DayKey {
  return task.date && task.date >= today ? addDaysKey(task.date, 1) : addDaysKey(today, 1)
}

export async function undoneOn(date: DayKey): Promise<Task[]> {
  return db.tasks.where('date').equals(date).filter((t) => !t.done).toArray()
}

/** Невыполненные задачи с датой раньше сегодняшней. */
export async function overdue(today: DayKey = todayKey()): Promise<Task[]> {
  return db.tasks
    .where('date')
    .between('0', today, true, false)
    .filter((t) => !t.done)
    .toArray()
}

export async function setSubtasks(id: string, subtasks: Subtask[]) {
  await updateTask(id, { subtasks })
}

/** Порядок в списке: невыполненные (со временем — по времени, потом по важности), затем выполненные. */
export function sortTasks(list: Task[]): Task[] {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (a.done && b.done) return (a.doneAt ?? '').localeCompare(b.doneAt ?? '')
    if (!!a.time !== !!b.time) return a.time ? -1 : 1
    if (a.time && b.time && a.time !== b.time) return a.time.localeCompare(b.time)
    if (a.priority !== b.priority) return a.priority - b.priority
    return a.order - b.order
  })
}

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  addTask,
  deleteTask,
  moveTasks,
  overdue,
  restoreTask,
  sortTasks,
  toggleTask,
  tomorrowFor,
  updateTask,
} from './tasks'
import type { Task } from './types'

const TODAY = '2026-11-15'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('задачи', () => {
  it('выполненная задача становится победой, снятие отметки её убирает', async () => {
    const id = await addTask({ title: '  Позвонить поставщику ', date: TODAY, priority: 1 })
    expect((await db.tasks.get(id))?.title).toBe('Позвонить поставщику')

    expect(await toggleTask(id, TODAY)).toBe(true)
    const wins = await db.wins.toArray()
    expect(wins).toHaveLength(1)
    expect(wins[0]).toMatchObject({ text: 'Позвонить поставщику', source: 'task', refId: id, date: TODAY, size: 'medium' })
    expect((await db.tasks.get(id))?.doneAt).toBeTruthy()

    expect(await toggleTask(id, TODAY)).toBe(false)
    expect(await db.wins.count()).toBe(0)
    expect((await db.tasks.get(id))?.doneAt).toBeUndefined()
  })

  it('повторяющаяся задача создаёт следующую, но только один раз', async () => {
    const id = await addTask({
      title: 'Планёрка',
      date: TODAY,
      repeat: { kind: 'daily' },
      subtasks: [{ id: 's1', title: 'Отчёт', done: true }],
    })
    await toggleTask(id, TODAY)
    let all = await db.tasks.toArray()
    expect(all).toHaveLength(2)
    const next = all.find((t) => t.id !== id)!
    expect(next).toMatchObject({ date: '2026-11-16', done: false, title: 'Планёрка' })
    expect(next.subtasks[0]).toMatchObject({ title: 'Отчёт', done: false })

    // снял и снова поставил отметку — второй копии нет
    await toggleTask(id, TODAY)
    expect(await db.tasks.count()).toBe(1)
    await toggleTask(id, TODAY)
    await toggleTask(id, TODAY)
    await toggleTask(id, TODAY)
    all = await db.tasks.toArray()
    expect(all).toHaveLength(2)
  })

  it('изменённый следующий повтор не удаляется при снятии отметки', async () => {
    const id = await addTask({ title: 'Спорт', date: TODAY, repeat: { kind: 'weekly' } })
    await toggleTask(id, TODAY)
    const next = (await db.tasks.toArray()).find((t) => t.id !== id)!
    await new Promise((r) => setTimeout(r, 2))
    await updateTask(next.id, { notes: 'зал' })
    await toggleTask(id, TODAY)
    expect(await db.tasks.get(next.id)).toBeDefined()
  })

  it('удаление и «Отменить»', async () => {
    const id = await addTask({ title: 'Купить подарок', date: TODAY })
    const snap = await deleteTask(id)
    expect(await db.tasks.count()).toBe(0)
    await restoreTask(snap!)
    expect((await db.tasks.get(id))?.title).toBe('Купить подарок')
  })

  it('просроченные и перенос', async () => {
    const a = await addTask({ title: 'Вчерашняя', date: '2026-11-14' })
    await addTask({ title: 'Сегодняшняя', date: TODAY })
    await addTask({ title: 'Входящая', date: '' })
    const done = await addTask({ title: 'Старая сделанная', date: '2026-11-01' })
    await toggleTask(done, TODAY)

    expect((await overdue(TODAY)).map((t) => t.id)).toEqual([a])
    await moveTasks([a], TODAY)
    expect(await overdue(TODAY)).toHaveLength(0)
  })

  it('tomorrowFor', () => {
    expect(tomorrowFor({ date: '2026-11-10' }, TODAY)).toBe('2026-11-16')
    expect(tomorrowFor({ date: '' }, TODAY)).toBe('2026-11-16')
    expect(tomorrowFor({ date: '2026-11-20' }, TODAY)).toBe('2026-11-21')
  })
})

describe('sortTasks', () => {
  const base = (p: Partial<Task>): Task => ({
    id: Math.random().toString(),
    title: '',
    notes: '',
    date: TODAY,
    priority: 2,
    done: false,
    repeat: { kind: 'none' },
    subtasks: [],
    order: 0,
    createdAt: '',
    updatedAt: '',
    ...p,
  })
  it('сначала со временем, потом по важности, сделанные в конце', () => {
    const list = [
      base({ title: 'сделано', done: true, doneAt: 'x' }),
      base({ title: 'обычная', order: 1 }),
      base({ title: 'важная', priority: 1, order: 2 }),
      base({ title: 'в 15', time: '15:00' }),
      base({ title: 'в 9', time: '09:00' }),
    ]
    expect(sortTasks(list).map((t) => t.title)).toEqual(['в 9', 'в 15', 'важная', 'обычная', 'сделано'])
  })
})

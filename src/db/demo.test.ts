import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { hasDemo, loadDemo, removeDemo } from './demo'
import { addTask, toggleTask } from './tasks'
import { saveDay } from './wins'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('пример данных', () => {
  it('загружается один раз и удаляется полностью, не трогая мои данные', async () => {
    const mine = await addTask({ title: 'Моя задача', date: '2026-11-15' })
    await saveDay('2026-11-10', { mood: 5 })

    await loadDemo(db, '2026-11-15')
    await loadDemo(db, '2026-11-15') // второй раз ничего не дублирует
    expect(await hasDemo()).toBe(true)
    expect(await db.habits.count()).toBe(4)
    expect(await db.people.count()).toBe(3)
    expect(await db.wins.count()).toBeGreaterThan(20)
    expect((await db.days.get('2026-11-10'))?.mood).toBe(5) // моя запись дня не перезаписана

    // победа из демо-задачи тоже уберётся
    await toggleTask('demo-t-1', '2026-11-15')

    await removeDemo()
    expect(await hasDemo()).toBe(false)
    expect(await db.habits.count()).toBe(0)
    expect(await db.habitLogs.count()).toBe(0)
    expect(await db.wins.count()).toBe(0)
    expect(await db.people.count()).toBe(0)
    expect(await db.topics.count()).toBe(0)
    expect(await db.interactions.count()).toBe(0)
    expect((await db.tasks.toArray()).map((x) => x.id)).toEqual([mine])
    expect((await db.days.toArray()).map((x) => x.date)).toEqual(['2026-11-10'])
    expect(await db.areas.count()).toBe(6)
  })
})

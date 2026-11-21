import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { Dexie } from 'dexie'
import { MoyDenDB } from './db'
import { applyPlan, previewPlan } from './planImport'
import { parsePlanText } from '../lib/planText'

let n = 0
const opened: MoyDenDB[] = []
function freshDb() {
  const d = new MoyDenDB(`plan-test-${++n}`)
  opened.push(d)
  return d
}
afterEach(async () => {
  for (const d of opened.splice(0)) {
    d.close()
    await Dexie.delete(d.name)
  }
})

const TEXT = `Дата: 2026-11-22
06:00 ! CSCA math
12:45 Lunch @Muhammadali
Люди:
Qurbonov Muhammadali
? How is our friendship going?
Safarov Mustafo
? Who makes which slides?
`

describe('applyPlan', () => {
  it('добавляет задачи и людей, не трогая старые данные', async () => {
    const db = freshDb()
    await db.open()
    const now = new Date().toISOString()
    await db.people.add({
      id: 'p1',
      createdAt: now,
      updatedAt: now,
      name: 'Muhammadali Qurbonov',
      group: 'friends',
      howWeMet: '',
      phone: '',
      telegram: '',
      notes: 'старая заметка',
      contactEveryDays: 0,
      tags: [],
      favorite: true,
      supportCircle: false,
    })
    await db.tasks.add({
      id: 't-old',
      createdAt: now,
      updatedAt: now,
      title: 'Old task',
      notes: '',
      date: '2026-11-20',
      priority: 2,
      done: true,
      repeat: { kind: 'none' },
      subtasks: [],
      order: 1,
    })

    const plan = parsePlanText(TEXT, '2026-11-21')
    const preview = await previewPlan(plan, db)
    expect(preview).toMatchObject({
      newTasks: 2,
      knownPeople: ['Muhammadali Qurbonov'],
      newPeople: ['Safarov Mustafo'],
    })
    expect(await db.tasks.count()).toBe(1) // предпросмотр ничего не пишет

    const r = await applyPlan(plan, db)
    expect(r).toMatchObject({ newTasks: 2, sameTasks: 0, newTopics: 2, firstDate: '2026-11-22' })

    // Старое на месте
    expect(await db.tasks.get('t-old')).toMatchObject({ title: 'Old task', done: true })
    expect(await db.people.get('p1')).toMatchObject({ notes: 'старая заметка', favorite: true })
    // Человек не задвоился, задача связана с ним
    expect(await db.people.count()).toBe(2)
    const lunch = (await db.tasks.toArray()).find((t) => t.title === 'Lunch')!
    expect(lunch.personId).toBe('p1')
    const topics = await db.topics.where('personId').equals('p1').toArray()
    expect(topics.map((t) => [t.text, t.kind])).toEqual([['How is our friendship going?', 'ask']])
  })

  it('второй раз то же самое не добавляет', async () => {
    const db = freshDb()
    await db.open()
    const plan = parsePlanText(TEXT, '2026-11-21')
    await applyPlan(plan, db)
    const again = await applyPlan(plan, db)
    expect(again).toMatchObject({ newTasks: 0, sameTasks: 2, newTopics: 0, newPeople: [] })
    expect(await db.tasks.count()).toBe(2)
    expect(await db.people.count()).toBe(2)
    expect(await db.topics.count()).toBe(2)
  })
})

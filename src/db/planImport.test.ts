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

  const person = (id: string, name: string) => {
    const now = new Date().toISOString()
    return {
      id,
      createdAt: now,
      updatedAt: now,
      name,
      group: 'friends' as const,
      howWeMet: '',
      phone: '',
      telegram: '',
      notes: '',
      contactEveryDays: 0,
      tags: [],
      favorite: false,
      supportCircle: false,
    }
  }

  it('кириллица и латиница: «Safarov Mustafo» сам связывается с «Мустафо Сафаров»', async () => {
    const db = freshDb()
    await db.open()
    await db.people.bulkAdd([person('m', 'Мустафо Сафаров'), person('q', 'Мухаммадали Курбонов')])
    const plan = parsePlanText(TEXT, '2026-11-21')
    const preview = await previewPlan(plan, db)
    expect(preview.questions).toEqual([])
    expect(preview.newPeople).toEqual([])
    expect(preview.knownPeople.sort()).toEqual(['Мустафо Сафаров', 'Мухаммадали Курбонов'])
    await applyPlan(plan, db)
    expect(await db.people.count()).toBe(2) // никого нового
    const lunch = (await db.tasks.toArray()).find((t) => t.title === 'Lunch')!
    expect(lunch.personId).toBe('q')
    expect((await db.topics.where('personId').equals('m').toArray()).map((t) => t.text)).toEqual([
      'Who makes which slides?',
    ])
  })

  const SIMILAR = `Люди:
Safarov Mustafa
? Who makes which slides?
`

  it('«похоже» — спрашивает; по умолчанию «Да, это он»', async () => {
    const db = freshDb()
    await db.open()
    await db.people.add(person('m', 'Мустафо Сафаров'))
    const plan = parsePlanText(SIMILAR, '2026-11-21')
    const preview = await previewPlan(plan, db)
    expect(preview.questions).toEqual([
      { key: 'Safarov Mustafa', name: 'Safarov Mustafa', kind: 'similar', candidates: [{ id: 'm', name: 'Мустафо Сафаров' }] },
    ])
    await applyPlan(plan, db) // ответ не дали — значит «Да»
    expect(await db.people.count()).toBe(1)
    expect(await db.topics.where('personId').equals('m').count()).toBe(1)
  })

  it('«Нет, новый человек» — создаёт нового с именем как в плане', async () => {
    const db = freshDb()
    await db.open()
    await db.people.add(person('m', 'Мустафо Сафаров'))
    const plan = parsePlanText(SIMILAR, '2026-11-21')
    const choices = { 'Safarov Mustafa': 'new' }
    expect((await previewPlan(plan, db, choices)).newPeople).toEqual(['Safarov Mustafa'])
    await applyPlan(plan, db, choices)
    const all = await db.people.toArray()
    expect(all.map((p) => p.name).sort()).toEqual(['Safarov Mustafa', 'Мустафо Сафаров'])
    expect(await db.people.get('m')).toMatchObject({ name: 'Мустафо Сафаров' }) // старый не тронут
  })

  it('подходят двое — выбор из них, можно выбрать второго', async () => {
    const db = freshDb()
    await db.open()
    await db.people.bulkAdd([person('a', 'Мустафо Сафаров'), person('b', 'Мустафо Каримов')])
    const plan = parsePlanText('Дата: 2026-11-22\n10:00 Встреча @Мустафо\n', '2026-11-21')
    const preview = await previewPlan(plan, db)
    expect(preview.questions[0]).toMatchObject({ kind: 'several', name: 'Мустафо' })
    expect(preview.questions[0]!.candidates.map((c) => c.id).sort()).toEqual(['a', 'b'])
    await applyPlan(plan, db, { Мустафо: 'b' })
    expect((await db.tasks.toArray())[0]!.personId).toBe('b')
    expect(await db.people.count()).toBe(2)
  })

  it('совсем другое имя — новый человек без вопросов', async () => {
    const db = freshDb()
    await db.open()
    await db.people.add(person('m', 'Мустафо Сафаров'))
    const plan = parsePlanText('Люди:\nМухаммадали\n? Как дела?\n', '2026-11-21')
    const preview = await previewPlan(plan, db)
    expect(preview).toMatchObject({ questions: [], newPeople: ['Мухаммадали'] })
  })
})

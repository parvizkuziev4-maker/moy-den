import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  addInteraction,
  addPerson,
  addTopic,
  assignTopic,
  deleteInteraction,
  deletePerson,
  restorePerson,
  taskFromFollowUp,
  toggleTopic,
} from './people'
import { addTask } from './tasks'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('люди', () => {
  it('разговор обновляет «последний контакт», удаление — пересчитывает', async () => {
    const id = await addPerson({ name: '  Азиз  ' })
    expect((await db.people.get(id))?.name).toBe('Азиз')
    const a = await addInteraction({ personId: id, date: '2026-11-10', type: 'call', summary: 'Цены', followUp: '' })
    await addInteraction({ personId: id, date: '2026-11-03', type: 'meeting', summary: 'Знакомство', followUp: '' })
    expect((await db.people.get(id))?.lastContactAt).toBe('2026-11-10')
    await deleteInteraction(a)
    expect((await db.people.get(id))?.lastContactAt).toBe('2026-11-03')
  })

  it('темы: обсудили и обратно, общая тема отдаётся человеку', async () => {
    const pid = await addPerson({ name: 'Мадина' })
    const t1 = await addTopic('Поездка в Самарканд', pid)
    await toggleTopic(t1)
    expect(await db.topics.get(t1)).toMatchObject({ status: 'discussed' })
    expect((await db.topics.get(t1))?.discussedAt).toBeTruthy()
    await toggleTopic(t1)
    expect((await db.topics.get(t1))?.discussedAt).toBeUndefined()

    const general = await addTopic('Идея: доставка за 1 день')
    expect((await db.topics.get(general))?.personId).toBeUndefined()
    await assignTopic(general, pid)
    expect(await db.topics.where('personId').equals(pid).count()).toBe(2)
  })

  it('задача из «что сделать после» связана с человеком', async () => {
    const pid = await addPerson({ name: 'Фарход' })
    const tid = await taskFromFollowUp({ personId: pid, followUp: 'Отправить прайс' })
    expect(await db.tasks.get(tid)).toMatchObject({ title: 'Отправить прайс', personId: pid, date: '' })
  })

  it('удаление и «Отменить» возвращают темы, историю и связи с задачами', async () => {
    const pid = await addPerson({ name: 'Рустам' })
    await addTopic('Футбол', pid)
    await addInteraction({ personId: pid, date: '2026-11-12', type: 'message', summary: '', followUp: '' })
    const tid = await addTask({ title: 'Позвонить Рустаму', personId: pid })

    const snap = await deletePerson(pid)
    expect(await db.people.count()).toBe(0)
    expect(await db.topics.count()).toBe(0)
    expect((await db.tasks.get(tid))?.personId).toBeUndefined()

    await restorePerson(snap!)
    expect(await db.topics.count()).toBe(1)
    expect(await db.interactions.count()).toBe(1)
    expect((await db.tasks.get(tid))?.personId).toBe(pid)
  })
})

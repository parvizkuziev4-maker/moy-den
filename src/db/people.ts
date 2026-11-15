import { db } from './db'
import type { DayKey, Interaction, Person, Topic } from './types'
import { newId, nowIso } from '../lib/id'
import { addTask } from './tasks'

export type NewPerson = Partial<Omit<Person, 'id' | 'createdAt' | 'updatedAt'>> & { name: string }

export async function addPerson(input: NewPerson): Promise<string> {
  const now = nowIso()
  const p: Person = {
    group: 'friends',
    howWeMet: '',
    phone: '',
    telegram: '',
    notes: '',
    contactEveryDays: 0,
    tags: [],
    favorite: false,
    supportCircle: false,
    ...input,
    name: input.name.trim(),
    id: newId(),
    createdAt: now,
    updatedAt: now,
  }
  await db.people.add(p)
  return p.id
}

export async function updatePerson(id: string, patch: Partial<Person>) {
  await db.people.update(id, { ...patch, updatedAt: nowIso() })
}

export interface PersonSnapshot {
  person: Person
  topics: Topic[]
  interactions: Interaction[]
  /** id задач, у которых убрали связь с человеком */
  taskIds: string[]
}

/** Удалить человека с его темами и историей. Задачи остаются, но без связи. */
export async function deletePerson(id: string): Promise<PersonSnapshot | undefined> {
  return db.transaction('rw', [db.people, db.topics, db.interactions, db.tasks], async () => {
    const person = await db.people.get(id)
    if (!person) return undefined
    const topics = await db.topics.where('personId').equals(id).toArray()
    const interactions = await db.interactions.where('personId').equals(id).toArray()
    const taskIds = (await db.tasks.where('personId').equals(id).primaryKeys()) as string[]
    await db.topics.bulkDelete(topics.map((x) => x.id))
    await db.interactions.bulkDelete(interactions.map((x) => x.id))
    await db.tasks.bulkUpdate(taskIds.map((key) => ({ key, changes: { personId: undefined } })))
    await db.people.delete(id)
    return { person, topics, interactions, taskIds }
  })
}

export async function restorePerson(s: PersonSnapshot) {
  await db.transaction('rw', [db.people, db.topics, db.interactions, db.tasks], async () => {
    await db.people.put(s.person)
    await db.topics.bulkPut(s.topics)
    await db.interactions.bulkPut(s.interactions)
    await db.tasks.bulkUpdate(s.taskIds.map((key) => ({ key, changes: { personId: s.person.id } })))
  })
}

/* ---------- Темы ---------- */

export async function addTopic(text: string, personId?: string, kind: Topic['kind'] = 'topic'): Promise<string> {
  const now = nowIso()
  const topic: Topic = {
    id: newId(),
    personId,
    text: text.trim(),
    kind,
    status: 'open',
    priority: 2,
    createdAt: now,
    updatedAt: now,
  }
  await db.topics.add(topic)
  return topic.id
}

/** Отметить «обсудили» / вернуть в открытые */
export async function toggleTopic(id: string) {
  const topic = await db.topics.get(id)
  if (!topic) return
  const now = nowIso()
  await db.topics.update(
    id,
    topic.status === 'open'
      ? { status: 'discussed', discussedAt: now, updatedAt: now }
      : { status: 'open', discussedAt: undefined, updatedAt: now },
  )
}

/** Отдать общую тему конкретному человеку */
export async function assignTopic(id: string, personId: string) {
  await db.topics.update(id, { personId, updatedAt: nowIso() })
}

export async function deleteTopic(id: string): Promise<Topic | undefined> {
  const topic = await db.topics.get(id)
  if (topic) await db.topics.delete(id)
  return topic
}

/* ---------- История общения ---------- */

export type NewInteraction = Omit<Interaction, 'id' | 'createdAt' | 'updatedAt'>

/** Записать разговор. Дата последнего контакта у человека обновляется сама. */
export async function addInteraction(input: NewInteraction): Promise<string> {
  return db.transaction('rw', db.interactions, db.people, async () => {
    const now = nowIso()
    const id = newId()
    await db.interactions.add({
      ...input,
      summary: input.summary.trim(),
      followUp: input.followUp.trim(),
      id,
      createdAt: now,
      updatedAt: now,
    })
    await refreshLastContact(input.personId)
    return id
  })
}

export async function deleteInteraction(id: string): Promise<Interaction | undefined> {
  return db.transaction('rw', db.interactions, db.people, async () => {
    const it = await db.interactions.get(id)
    if (!it) return undefined
    await db.interactions.delete(id)
    await refreshLastContact(it.personId)
    return it
  })
}

export async function restoreInteraction(it: Interaction) {
  await db.transaction('rw', db.interactions, db.people, async () => {
    await db.interactions.put(it)
    await refreshLastContact(it.personId)
  })
}

/** lastContactAt = дата самого свежего разговора */
async function refreshLastContact(personId: string) {
  const all = await db.interactions.where('personId').equals(personId).toArray()
  const last = all.reduce<DayKey | undefined>((m, x) => (!m || x.date > m ? x.date : m), undefined)
  await db.people.update(personId, { lastContactAt: last, updatedAt: nowIso() })
}

/** «Добавить из этого задачу»: задача во «Входящих», связанная с человеком */
export async function taskFromFollowUp(it: Pick<Interaction, 'personId' | 'followUp'>): Promise<string> {
  return addTask({ title: it.followUp, personId: it.personId, date: '' })
}

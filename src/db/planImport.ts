import { db as defaultDb, type MoyDenDB } from './db'
import type { Person, Task, Topic } from './types'
import { newId, nowIso } from '../lib/id'
import { normName, sameName, type ParsedPlan } from '../lib/planText'

export interface PlanPreview {
  newTasks: number
  sameTasks: number
  /** Люди, которые уже есть в приложении (имя как в приложении) */
  knownPeople: string[]
  /** Люди, которых создадим */
  newPeople: string[]
  newTopics: number
}

export interface PlanResult extends PlanPreview {
  firstDate?: string
}

const taskKey = (date: string, title: string) => `${date}|${normName(title)}`

/** Найти человека: сначала точное имя, потом то же имя в другом порядке или одно слово. */
function findPerson(people: Person[], name: string): Person | undefined {
  const n = normName(name)
  return people.find((p) => normName(p.name) === n) ?? people.find((p) => sameName(p.name, name))
}

/** Посчитать, что добавится, ничего не записывая. */
export async function previewPlan(
  plan: ParsedPlan,
  db: MoyDenDB = defaultDb,
): Promise<PlanPreview> {
  return run(plan, db, false)
}

/**
 * Добавить план. Ничего не удаляет и не меняет старое: только добавляет.
 * Такая же задача в тот же день (то же название) второй раз не добавится,
 * тот же открытый вопрос человеку — тоже. Всё в одной транзакции.
 */
export async function applyPlan(plan: ParsedPlan, db: MoyDenDB = defaultDb): Promise<PlanResult> {
  return db.transaction('rw', db.tasks, db.people, db.topics, () => run(plan, db, true))
}

async function run(plan: ParsedPlan, db: MoyDenDB, write: boolean): Promise<PlanResult> {
  const now = nowIso()
  const people = await db.people.toArray()
  const knownPeople: string[] = []
  const newPeople: string[] = []

  // Все имена из плана: из раздела «Люди» и из «@Имя» в задачах.
  const names = [
    ...plan.people.map((p) => p.name),
    ...plan.tasks.flatMap((t) => (t.personName ? [t.personName] : [])),
  ]
  const resolved = new Map<string, string>() // normName → personId
  for (const name of names) {
    if (resolved.has(normName(name))) continue
    // Уже встречали это имя в плане в другой записи («Мухаммадали» и «Qurbonov Мухаммадали»)?
    const planAlias = [...resolved.keys()].find((k) => sameName(k, name))
    if (planAlias) {
      resolved.set(normName(name), resolved.get(planAlias)!)
      continue
    }
    const found = findPerson(people, name)
    if (found) {
      resolved.set(normName(name), found.id)
      knownPeople.push(found.name)
      continue
    }
    const p: Person = {
      id: newId(),
      createdAt: now,
      updatedAt: now,
      name: name.trim(),
      group: 'friends',
      howWeMet: '',
      phone: '',
      telegram: '',
      notes: '',
      contactEveryDays: 0,
      tags: [],
      favorite: false,
      supportCircle: false,
    }
    people.push(p)
    resolved.set(normName(name), p.id)
    newPeople.push(p.name)
    if (write) await db.people.add(p)
  }
  const personId = (name?: string) => (name ? resolved.get(normName(name)) : undefined)

  // Задачи
  const dates = [...new Set(plan.tasks.map((t) => t.date))]
  const existing = await db.tasks.where('date').anyOf(dates).toArray()
  const seen = new Set(existing.map((t) => taskKey(t.date, t.title)))
  let newTasks = 0
  let sameTasks = 0
  let order = Date.now()
  for (const pt of plan.tasks) {
    const key = taskKey(pt.date, pt.title)
    if (seen.has(key)) {
      sameTasks++
      continue
    }
    seen.add(key)
    newTasks++
    if (!write) continue
    const task: Task = {
      id: newId(),
      createdAt: now,
      updatedAt: now,
      title: pt.title,
      notes: pt.notes,
      date: pt.date,
      priority: pt.priority,
      done: false,
      repeat: { kind: 'none' },
      subtasks: pt.subtasks.map((title) => ({ id: newId(), title, done: false })),
      order: order++,
    }
    if (pt.time) task.time = pt.time
    if (pt.focus) task.focus = true
    const pid = personId(pt.personName)
    if (pid) task.personId = pid
    await db.tasks.add(task)
  }

  // Вопросы и темы людям
  let newTopics = 0
  for (const pp of plan.people) {
    const pid = personId(pp.name)!
    const open = (await db.topics.where('personId').equals(pid).toArray()).filter(
      (t) => t.status === 'open',
    )
    const have = new Set(open.map((t) => normName(t.text)))
    const items: [string, Topic['kind']][] = [
      ...pp.asks.map((x): [string, Topic['kind']] => [x, 'ask']),
      ...pp.topics.map((x): [string, Topic['kind']] => [x, 'topic']),
    ]
    for (const [text, kind] of items) {
      if (have.has(normName(text))) continue
      have.add(normName(text))
      newTopics++
      if (!write) continue
      await db.topics.add({
        id: newId(),
        createdAt: now,
        updatedAt: now,
        personId: pid,
        text: text.trim(),
        kind,
        status: 'open',
        priority: 2,
      })
    }
  }

  return { newTasks, sameTasks, knownPeople, newPeople, newTopics, firstDate: dates.sort()[0] }
}

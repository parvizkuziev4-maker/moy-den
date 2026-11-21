import { db as defaultDb, type MoyDenDB } from './db'
import type { Person, Task, Topic } from './types'
import { newId, nowIso } from '../lib/id'
import { normName, type ParsedPlan } from '../lib/planText'
import { compareNames, findPeople } from '../lib/nameMatch'

/** Вопрос в предпросмотре: «Это Мустафо Сафаров?» или выбор из нескольких */
export interface PersonQuestion {
  /** Ключ вопроса — имя как в плане (для выбора ответа) */
  key: string
  /** Имя, как написано в плане */
  name: string
  /** 'similar' — похож на одного человека; 'several' — подходят несколько */
  kind: 'similar' | 'several'
  candidates: { id: string; name: string }[]
}

/** Ответы на вопросы: ключ → id выбранного человека или 'new' (новый человек) */
export type PersonChoices = Record<string, string>

export interface PlanPreview {
  newTasks: number
  sameTasks: number
  /** Люди, которые уже есть в приложении (имя как в приложении) */
  knownPeople: string[]
  /** Люди, которых создадим */
  newPeople: string[]
  newTopics: number
  /** Что спросить у пользователя про людей (ответ по умолчанию — первый кандидат) */
  questions: PersonQuestion[]
}

export interface PlanResult extends PlanPreview {
  firstDate?: string
}

const taskKey = (date: string, title: string) => `${date}|${normName(title)}`

/** Посчитать, что добавится, ничего не записывая. */
export async function previewPlan(
  plan: ParsedPlan,
  db: MoyDenDB = defaultDb,
  choices: PersonChoices = {},
): Promise<PlanPreview> {
  return run(plan, db, false, choices)
}

/**
 * Добавить план. Ничего не удаляет и не меняет старое: только добавляет.
 * Такая же задача в тот же день (то же название) второй раз не добавится,
 * тот же открытый вопрос человеку — тоже. Всё в одной транзакции.
 */
export async function applyPlan(
  plan: ParsedPlan,
  db: MoyDenDB = defaultDb,
  choices: PersonChoices = {},
): Promise<PlanResult> {
  return db.transaction('rw', db.tasks, db.people, db.topics, () => run(plan, db, true, choices))
}

async function run(
  plan: ParsedPlan,
  db: MoyDenDB,
  write: boolean,
  choices: PersonChoices,
): Promise<PlanResult> {
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
  const questions: PersonQuestion[] = []
  for (const name of names) {
    if (resolved.has(normName(name))) continue
    // Уже встречали это имя в плане в другой записи («Мухаммадали» и «Qurbonov Мухаммадали»)?
    const planAlias = [...resolved.keys()].find((k) => compareNames(k, name) === 'exact')
    if (planAlias) {
      resolved.set(normName(name), resolved.get(planAlias)!)
      continue
    }

    // Ищем среди людей приложения: точное совпадение — связываем сами, «похоже» — спрашиваем
    const { exact, similar } = findPeople(people, name)
    const candidates = exact.length ? exact : similar
    let chosen: Person | undefined
    if (exact.length === 1) {
      chosen = exact[0]
    } else if (candidates.length) {
      const q: PersonQuestion = {
        key: name,
        name,
        kind: candidates.length > 1 ? 'several' : 'similar',
        candidates: candidates.map((p) => ({ id: p.id, name: p.name })),
      }
      questions.push(q)
      // по умолчанию — «Да, это он» (первый кандидат); 'new' — новый человек
      const answer = choices[q.key] ?? q.candidates[0]!.id
      if (answer !== 'new') chosen = candidates.find((p) => p.id === answer) ?? candidates[0]
    }

    if (chosen) {
      resolved.set(normName(name), chosen.id)
      if (!knownPeople.includes(chosen.name)) knownPeople.push(chosen.name)
      continue
    }

    // Новый человек — с именем, как написано в плане
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

  return { newTasks, sameTasks, knownPeople, newPeople, newTopics, questions, firstDate: dates.sort()[0] }
}

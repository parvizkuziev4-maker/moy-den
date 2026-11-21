// «Вставить план»: план на день обычным текстом → задачи и вопросы людям.
// Чистые функции без базы — их легко тестировать.
//
// Формат (каждая строка — одна вещь):
//
//   Дата: 2026-11-22            ← дальше задачи на этот день (можно «сегодня», «завтра»)
//   05:41 Фаджр                 ← время необязательно
//   06:00 ! Математика CSCA     ← «!» = Важно, «★» = в «Фокус дня»
//   12:45 Обед @Мухаммадали     ← «@Имя» — связать задачу с человеком
//   - подзадача                 ← строка с «-» под задачей
//   Купить хлеб // у дома        ← после «//» — заметка
//
//   Люди:                        ← дальше люди и что у них спросить
//   Qurbonov Muhammadali
//   ? Как дела в школе?          ← «?» = что спросить в следующий раз
//   - Тема для разговора         ← «-» = тема

import type { DayKey, Priority } from '../db/types'
import { addDaysKey } from './dates'

export interface PlanTask {
  date: DayKey
  time?: string
  title: string
  notes: string
  priority: Priority
  focus: boolean
  subtasks: string[]
  personName?: string
}

export interface PlanPerson {
  name: string
  asks: string[]
  topics: string[]
}

export interface ParsedPlan {
  tasks: PlanTask[]
  people: PlanPerson[]
  /** Строки, которые не удалось понять (номер строки и текст) */
  skipped: { line: number; text: string }[]
}

const DATE_RE = /^(?:дата|date)\s*[:：]\s*(.+)$/i
const PEOPLE_RE = /^(?:люди|people)\s*[:：]?\s*$/i
const TIME_RE = /^(\d{1,2})[:.](\d{2})\s+(.*)$/
const SUB_RE = /^[-–—•]\s+(.+)$/

/** «2026-11-22», «22.11.2026», «сегодня», «завтра» → YYYY-MM-DD */
export function parseDay(raw: string, today: DayKey): DayKey | null {
  const v = raw.trim().toLowerCase()
  if (v === 'сегодня' || v === 'today') return today
  if (v === 'завтра' || v === 'tomorrow') return addDaysKey(today, 1)
  if (v === 'послезавтра') return addDaysKey(today, 2)
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return valid(+m[1]!, +m[2]!, +m[3]!)
  m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (m) return valid(+m[3]!, +m[2]!, +m[1]!)
  return null
}

function valid(y: number, mo: number, d: number): DayKey | null {
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Имя для сравнения: без регистра, лишних пробелов и с «е» вместо «ё». */
export function normName(name: string): string {
  return name.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ')
}

/** Совпадают ли имена: «Qurbonov Muhammadali» = «Muhammadali Qurbonov» = «Muhammadali». */
export function sameName(a: string, b: string): boolean {
  const x = normName(a)
  const y = normName(b)
  if (!x || !y) return false
  if (x === y) return true
  const wx = x.split(' ')
  const wy = y.split(' ')
  const sorted = (w: string[]) => [...w].sort().join(' ')
  if (wx.length === wy.length) return sorted(wx) === sorted(wy)
  // Одно слово против полного имени: «Мустафо» = «Safarov Мустафо»
  const [short, long] = wx.length < wy.length ? [wx, wy] : [wy, wx]
  return short.length === 1 && long.includes(short[0]!)
}

export function parsePlanText(text: string, today: DayKey): ParsedPlan {
  const out: ParsedPlan = { tasks: [], people: [], skipped: [] }
  let mode: 'none' | 'tasks' | 'people' = 'none'
  let date: DayKey | null = null
  let lastTask: PlanTask | null = null
  let person: PlanPerson | null = null

  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  lines.forEach((rawLine, i) => {
    const line = rawLine.trim()
    if (!line) return

    const d = line.match(DATE_RE)
    if (d) {
      const day = parseDay(d[1]!, today)
      if (day) {
        date = day
        mode = 'tasks'
        lastTask = null
      } else out.skipped.push({ line: i + 1, text: line })
      return
    }
    if (PEOPLE_RE.test(line)) {
      mode = 'people'
      person = null
      return
    }

    if (mode === 'tasks' && date) {
      const sub = line.match(SUB_RE)
      if (sub) {
        if (lastTask) lastTask.subtasks.push(sub[1]!.trim())
        else out.skipped.push({ line: i + 1, text: line })
        return
      }
      const task = parseTaskLine(line, date)
      if (task) {
        out.tasks.push(task)
        lastTask = task
      } else out.skipped.push({ line: i + 1, text: line })
      return
    }

    if (mode === 'people') {
      if (line.startsWith('?')) {
        const q = line.slice(1).trim()
        if (person && q) person.asks.push(q)
        else out.skipped.push({ line: i + 1, text: line })
        return
      }
      const sub = line.match(SUB_RE)
      if (sub) {
        if (person) person.topics.push(sub[1]!.trim())
        else out.skipped.push({ line: i + 1, text: line })
        return
      }
      const name = line.replace(/^(?:человек|person)\s*[:：]\s*/i, '').trim()
      const existing = out.people.find((p) => sameName(p.name, name))
      person = existing ?? { name, asks: [], topics: [] }
      if (!existing) out.people.push(person)
      return
    }

    // Строки до «Дата:» и «Люди:» (например, заголовок «Мой День») пропускаем молча.
  })
  return out
}

function parseTaskLine(line: string, date: DayKey): PlanTask | null {
  let rest = line
  let time: string | undefined
  const tm = rest.match(TIME_RE)
  if (tm) {
    const h = +tm[1]!
    const m = +tm[2]!
    if (h > 23 || m > 59) return null
    time = `${String(h).padStart(2, '0')}:${tm[2]}`
    rest = tm[3]!
  }

  let priority: Priority = 2
  let focus = false
  // Знаки в начале в любом порядке: «! ★», «★!»
  for (;;) {
    const s = rest.trimStart()
    if (s.startsWith('!')) priority = 1
    else if (s.startsWith('★')) focus = true
    else break
    rest = s.slice(1)
  }

  let notes = ''
  const n = rest.indexOf('//')
  if (n >= 0) {
    notes = rest.slice(n + 2).trim()
    rest = rest.slice(0, n)
  }

  let personName: string | undefined
  const at = rest.match(/\s@(.+)$/) ?? rest.match(/^@(.+)$/)
  if (at) {
    personName = at[1]!.trim()
    rest = rest.slice(0, at.index)
  }

  const title = rest.trim()
  if (!title) return null
  return { date, time, title, notes, priority, focus, subtasks: [], personName }
}

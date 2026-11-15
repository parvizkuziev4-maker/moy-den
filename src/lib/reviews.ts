import type { DayEntry, DayKey, Habit, Task, Win } from '../db/types'
import { addDaysKey, addMonthsKey, dayKey, dayLabel, fullDayLabel } from './dates'
import { isDoneValue, isScheduled, type LogMap } from './streaks'
import { t } from '../i18n/ru'

// Обзоры недели/месяца, «мне тяжело», «в этот день», экспорт побед. Чистые функции — см. reviews.test.ts.

export const MOODS = ['😞', '😕', '😐', '🙂', '😄'] as const
export const moodEmoji = (m?: number) => (m ? MOODS[m - 1] : undefined)

/** Все дни от from до to включительно */
export function daysBetween(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = []
  for (let d = from; d <= to; d = addDaysKey(d, 1)) out.push(d)
  return out
}

export interface PeriodInput {
  from: DayKey
  to: DayKey
  today: DayKey
  wins: Win[]
  tasks: Task[]
  days: DayEntry[]
  habits: Habit[]
  logs: Map<string, LogMap>
}

export interface DayStat {
  date: DayKey
  wins: number
  mood?: number
  energy?: number
}

export interface PeriodStats {
  wins: number
  bigWins: number
  tasksDone: number
  /** 0–1 или null, если привычек не было */
  habitRate: number | null
  avgMood: number | null
  avgEnergy: number | null
  /** День с наибольшим числом побед */
  bestDay: DayStat | null
  byDay: DayStat[]
  /** areaId ('' — без сферы) → число побед */
  byArea: Map<string, number>
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export function periodStats(p: PeriodInput): PeriodStats {
  const last = p.to < p.today ? p.to : p.today
  const range = p.from <= last ? daysBetween(p.from, last) : []
  const inRange = (d: DayKey) => d >= p.from && d <= p.to

  const wins = p.wins.filter((w) => inRange(w.date))
  const dayMap = new Map(p.days.filter((d) => inRange(d.date)).map((d) => [d.date, d]))

  const byDay: DayStat[] = range.map((date) => ({
    date,
    wins: wins.filter((w) => w.date === date).length,
    mood: dayMap.get(date)?.mood,
    energy: dayMap.get(date)?.energy,
  }))

  let bestDay: DayStat | null = null
  for (const d of byDay) if (d.wins > 0 && (!bestDay || d.wins > bestDay.wins)) bestDay = d

  const byArea = new Map<string, number>()
  for (const w of wins) byArea.set(w.areaId ?? '', (byArea.get(w.areaId ?? '') ?? 0) + 1)

  const tasksDone = p.tasks.filter((x) => x.done && x.doneAt && inRange(dayKey(new Date(x.doneAt)))).length

  // Привычки: сделано / нужно по расписанию (сегодня — только если уже сделано)
  let expected = 0
  let done = 0
  for (const h of p.habits) {
    if (h.archived) continue
    const logs = p.logs.get(h.id) ?? new Map<DayKey, number>()
    let hDays = 0
    let hDone = 0
    for (const d of range) {
      if (d < h.startDate) continue
      const isDone = isDoneValue(h, logs.get(d))
      if (d === p.today && !isDone) continue
      if (h.schedule.kind === 'timesPerWeek') {
        hDays++
        if (isDone) hDone++
      } else if (isScheduled(h, d)) {
        expected++
        if (isDone) done++
      }
    }
    if (h.schedule.kind === 'timesPerWeek') {
      const exp = (Math.max(1, h.schedule.times) * hDays) / 7
      expected += exp
      done += Math.min(hDone, exp)
    }
  }

  const moods = byDay.flatMap((d) => (d.mood ? [d.mood] : []))
  const energies = byDay.flatMap((d) => (d.energy ? [d.energy] : []))

  return {
    wins: wins.length,
    bigWins: wins.filter((w) => w.size === 'big').length,
    tasksDone,
    habitRate: expected > 0 ? Math.min(1, done / expected) : null,
    avgMood: avg(moods),
    avgEnergy: avg(energies),
    bestDay,
    byDay,
    byArea,
  }
}

/** Сравнение с прошлым периодом — только в позитивном ключе. */
export function compareText(cur: number, prev: number): string {
  if (prev === 0) return cur > 0 ? t.review.compareFirst(cur) : t.review.compareZero
  if (cur > prev) return t.review.compareMore(cur - prev)
  if (cur === prev) return t.review.compareSame
  return t.review.compareLess(cur)
}

/**
 * Настроение 1–2 три дня подряд (заканчивая сегодня, а если сегодня ещё не отмечено — вчера).
 */
export function lowMoodStreak(days: Pick<DayEntry, 'date' | 'mood'>[], today: DayKey): boolean {
  const mood = new Map(days.map((d) => [d.date, d.mood]))
  const end = mood.get(today) ? today : addDaysKey(today, -1)
  for (let i = 0; i < 3; i++) {
    const m = mood.get(addDaysKey(end, -i))
    if (!m || m > 2) return false
  }
  return true
}

/** Победы «в этот день» месяц и год назад */
export function onThisDay(wins: Win[], today: DayKey): { monthAgo: Win[]; yearAgo: Win[] } {
  const m = addMonthsKey(today, -1)
  const y = addMonthsKey(today, -12)
  return { monthAgo: wins.filter((w) => w.date === m), yearAgo: wins.filter((w) => w.date === y) }
}

/** Случайные победы из прошлого (для «Мне тяжело»): сначала большие и средние. */
export function pickPastWins(wins: Win[], today: DayKey, n = 5, rand: () => number = Math.random): Win[] {
  const past = wins.filter((w) => w.date < today && w.refId !== 'all-habits')
  const weight = (w: Win) => (w.size === 'big' ? 3 : w.size === 'medium' ? 2 : 1)
  const pool = past.map((w) => ({ w, key: rand() * weight(w) }))
  pool.sort((a, b) => b.key - a.key)
  return pool.slice(0, n).map((x) => x.w)
}

/** Победы в Markdown — чтобы перечитать или распечатать */
export function winsToMarkdown(
  title: string,
  wins: Win[],
  areas: Map<string, { name: string; emoji: string }>,
  days: Map<DayKey, Pick<DayEntry, 'mood' | 'lesson' | 'gratitude'>> = new Map(),
): string {
  const byDate = new Map<DayKey, Win[]>()
  for (const w of [...wins].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))) {
    byDate.set(w.date, [...(byDate.get(w.date) ?? []), w])
  }
  const lines = [`# ${title}`, '', `${t.wins.total}: ${wins.length}`, '']
  for (const [date, list] of byDate) {
    const entry = days.get(date)
    const mood = entry?.mood ? ` ${moodEmoji(entry.mood)}` : ''
    lines.push(`## ${capitalize(fullDayLabel(date))} — ${t.wins.count(list.length)}${mood}`, '')
    for (const w of list) {
      const star = w.size === 'big' ? '⭐ ' : w.size === 'medium' ? '✦ ' : ''
      const area = w.areaId && areas.get(w.areaId)
      lines.push(`- ${star}${w.text}${area ? ` _(${area.emoji} ${area.name})_` : ''}`)
    }
    const grat = entry?.gratitude?.filter(Boolean) ?? []
    if (grat.length) lines.push('', `${t.day.gratitude}: ${grat.join('; ')}`)
    if (entry?.lesson) lines.push('', `${t.day.lesson}: ${entry.lesson}`)
    lines.push('')
  }
  return lines.join('\n')
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** «Пт, 14 ноября — 7 побед» */
export function dayHeader(date: DayKey, n: number, today: DayKey): string {
  return `${capitalize(dayLabel(date, today))} — ${t.wins.count(n)}`
}

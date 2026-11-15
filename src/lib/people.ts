import { differenceInCalendarDays, getDaysInMonth } from 'date-fns'
import type { DayKey, Person } from '../db/types'
import { dayKey, parseDay } from './dates'
import { t } from '../i18n/ru'

// Чистые функции для раздела «Люди» — см. people.test.ts

/** Инициалы для аватара: «Алишер Каримов» → «АК» */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

/** Сколько дней прошло с последнего общения (null — ещё не общались) */
export function daysSinceContact(p: Pick<Person, 'lastContactAt'>, today: DayKey): number | null {
  if (!p.lastContactAt) return null
  return differenceInCalendarDays(parseDay(today), parseDay(p.lastContactAt.slice(0, 10)))
}

/** «Давно не общались»: прошло больше, чем хочется (contactEveryDays) */
export function isContactOverdue(p: Pick<Person, 'lastContactAt' | 'contactEveryDays' | 'createdAt'>, today: DayKey): boolean {
  if (!p.contactEveryDays) return false
  const since = daysSinceContact(p, today)
  if (since !== null) return since > p.contactEveryDays
  // ни разу не записывали разговор — считаем от даты добавления
  const added = p.createdAt ? differenceInCalendarDays(parseDay(today), parseDay(p.createdAt.slice(0, 10))) : 0
  return added > p.contactEveryDays
}

/** Кому пора написать — сначала те, с кем дольше всего не общались */
export function overdueContacts<P extends Person>(people: P[], today: DayKey, limit = 3): P[] {
  const score = (p: P) => (daysSinceContact(p, today) ?? 10_000) - p.contactEveryDays
  return people
    .filter((p) => isContactOverdue(p, today))
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit)
}

/** День рождения хранится как YYYY-MM-DD или MM-DD (год неизвестен) */
export function parseBirthday(b?: string): { year?: number; month: number; day: number } | null {
  if (!b) return null
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b)
  if (full) return { year: Number(full[1]), month: Number(full[2]), day: Number(full[3]) }
  const short = /^(\d{2})-(\d{2})$/.exec(b)
  if (short) return { month: Number(short[1]), day: Number(short[2]) }
  return null
}

export interface NextBirthday {
  date: DayKey
  daysLeft: number
  /** Сколько исполнится (если известен год) */
  turns?: number
}

/** Ближайший день рождения (сегодня — daysLeft = 0). 29 февраля в невисокосный год — 28-го. */
export function nextBirthday(b: string | undefined, today: DayKey): NextBirthday | null {
  const p = parseBirthday(b)
  if (!p) return null
  const now = parseDay(today)
  const make = (year: number) => {
    const dim = getDaysInMonth(new Date(year, p.month - 1, 1))
    return new Date(year, p.month - 1, Math.min(p.day, dim))
  }
  let date = make(now.getFullYear())
  if (differenceInCalendarDays(date, now) < 0) date = make(now.getFullYear() + 1)
  return {
    date: dayKey(date),
    daysLeft: differenceInCalendarDays(date, now),
    turns: p.year ? date.getFullYear() - p.year : undefined,
  }
}

/** Ближайшие дни рождения в пределах days дней */
export function upcomingBirthdays<P extends Person>(people: P[], today: DayKey, days = 7): (NextBirthday & { person: P })[] {
  return people
    .flatMap((person) => {
      const nb = nextBirthday(person.birthday, today)
      return nb && nb.daysLeft <= days ? [{ ...nb, person }] : []
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

export type PeopleSort = 'name' | 'contact' | 'recent'

/** Избранные всегда сверху, дальше по выбранной сортировке */
export function sortPeople<P extends Person>(people: P[], sort: PeopleSort, today: DayKey): P[] {
  return [...people].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
    if (sort === 'contact') {
      const da = daysSinceContact(a, today) ?? 100_000
      const db = daysSinceContact(b, today) ?? 100_000
      if (da !== db) return db - da
    }
    if (sort === 'recent' && a.createdAt !== b.createdAt) return b.createdAt.localeCompare(a.createdAt)
    return a.name.localeCompare(b.name, 'ru')
  })
}

/** Ссылка на Telegram из «@user», «user» или «https://t.me/user» */
export function telegramLink(tg: string): string {
  return `https://t.me/${tg.trim().replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '')}`
}

export const phoneLink = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v)
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Люди в CSV (открывается в Excel/Numbers; BOM — чтобы кириллица не сломалась) */
export function peopleToCsv(people: Person[]): string {
  const head = t.people.csvHeader
  const rows = people.map((p) =>
    [
      p.name,
      t.people.groups[p.group],
      p.phone,
      p.telegram,
      p.birthday ?? '',
      p.howWeMet,
      p.contactEveryDays || '',
      p.lastContactAt?.slice(0, 10) ?? '',
      p.tags.join(', '),
      p.favorite ? '★' : '',
      p.notes,
    ]
      .map(csvCell)
      .join(','),
  )
  return '﻿' + [head.map(csvCell).join(','), ...rows].join('\r\n')
}

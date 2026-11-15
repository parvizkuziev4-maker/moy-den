import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ru as ruLocale } from 'date-fns/locale'
import { t } from '../i18n/ru'
import type { DayKey } from '../db/types'

export type WeekStart = 0 | 1
export const WEEK_STARTS_ON: WeekStart = 1 // понедельник

export function greetingFor(date: Date): string {
  const h = date.getHours()
  if (h < 5) return t.greeting.night
  if (h < 12) return t.greeting.morning
  if (h < 18) return t.greeting.day
  return t.greeting.evening
}

const fmt = (d: Date, pattern: string) => format(d, pattern, { locale: ruLocale })

/** «суббота, 15 ноября» */
export function longDate(date: Date): string {
  return fmt(date, 'EEEE, d MMMM')
}

/** Ключ дня в базе: YYYY-MM-DD по местному времени телефона. */
export function dayKey(date: Date): DayKey {
  return format(date, 'yyyy-MM-dd')
}

export const todayKey = (): DayKey => dayKey(new Date())

/** YYYY-MM-DD → Date (полночь по местному времени) */
export function parseDay(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

export const addDaysKey = (key: DayKey, n: number): DayKey => dayKey(addDays(parseDay(key), n))
export const addMonthsKey = (key: DayKey, n: number): DayKey => dayKey(addMonths(parseDay(key), n))

/** День недели: 1 = пн … 7 = вс */
export function isoWeekday(key: DayKey): number {
  const d = parseDay(key).getDay()
  return d === 0 ? 7 : d
}

/** 7 дней недели, в которую входит key */
export function weekOf(key: DayKey, weekStartsOn: WeekStart = WEEK_STARTS_ON): DayKey[] {
  const start = startOfWeek(parseDay(key), { weekStartsOn })
  return Array.from({ length: 7 }, (_, i) => dayKey(addDays(start, i)))
}

/** Все дни сетки месяца (с хвостами соседних месяцев до полных недель) */
export function monthGrid(key: DayKey, weekStartsOn: WeekStart = WEEK_STARTS_ON): DayKey[] {
  const d = parseDay(key)
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(d), { weekStartsOn }),
    end: endOfWeek(endOfMonth(d), { weekStartsOn }),
  }).map(dayKey)
}

/** «Сегодня», «Завтра», «Вчера» или «пт, 14 ноября» */
export function dayLabel(key: DayKey, today: DayKey = todayKey()): string {
  if (key === today) return t.dates.today
  if (key === addDaysKey(today, 1)) return t.dates.tomorrow
  if (key === addDaysKey(today, -1)) return t.dates.yesterday
  const d = parseDay(key)
  const sameYear = d.getFullYear() === parseDay(today).getFullYear()
  return fmt(d, sameYear ? 'EEEEEE, d MMMM' : 'EEEEEE, d MMMM yyyy')
}

/** «пятница, 14 ноября» */
export const fullDayLabel = (key: DayKey) => fmt(parseDay(key), 'EEEE, d MMMM')
/** «ноябрь 2026» */
export const monthLabel = (key: DayKey) => fmt(parseDay(key), 'LLLL yyyy')
/** «10 – 16 ноября» */
export function weekRangeLabel(days: DayKey[]): string {
  const a = parseDay(days[0]!)
  const b = parseDay(days[days.length - 1]!)
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${fmt(b, 'd MMMM')}`
    : `${fmt(a, 'd MMM')} – ${fmt(b, 'd MMM')}`
}
/** «пн», «вт» … */
export const weekdayShort = (key: DayKey) => fmt(parseDay(key), 'EEEEEE')

import type { DayKey, Habit, Repeat, Task } from '../db/types'
import { isoWeekday, todayKey } from './dates'

// Файл календаря .ics: Календарь iPhone сам напомнит, без сервера и push. См. ics.test.ts

const DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

export interface IcsEvent {
  uid: string
  title: string
  description?: string
  date: DayKey
  /** HH:mm (местное время телефона) */
  time: string
  durationMin?: number
  /** Например FREQ=DAILY или FREQ=WEEKLY;BYDAY=MO,WE */
  rrule?: string
  /** Напомнить за N минут (0 — в момент события) */
  alarmMin: number
}

/** Экранирование текста по RFC 5545 */
export function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Строки длиннее 75 символов переносим (продолжение начинается с пробела) */
export function fold(line: string): string {
  const out: string[] = []
  let rest = line
  while (rest.length > 74) {
    out.push(rest.slice(0, 74))
    rest = ' ' + rest.slice(74)
  }
  out.push(rest)
  return out.join('\r\n')
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const localDt = (date: DayKey, time: string) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`

export function buildIcs(events: IcsEvent[], now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Moy Den//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  for (const e of events) {
    const [h, m] = e.time.split(':').map(Number)
    const end = new Date(2000, 0, 1, h!, m! + (e.durationMin ?? 15))
    const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
    const endDate = end.getDate() > 1 ? nextDayKey(e.date) : e.date
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@moy-den`,
      `DTSTAMP:${stamp(now)}`,
      // время без «Z» — «плавающее», то есть местное время телефона
      `DTSTART:${localDt(e.date, e.time)}`,
      `DTEND:${localDt(endDate, endTime)}`,
      `SUMMARY:${icsEscape(e.title)}`,
    )
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`)
    if (e.rrule) lines.push(`RRULE:${e.rrule}`)
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(e.title)}`,
      `TRIGGER:${e.alarmMin > 0 ? `-PT${e.alarmMin}M` : 'PT0M'}`,
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

function nextDayKey(d: DayKey): DayKey {
  const [y, m, day] = d.split('-').map(Number)
  const n = new Date(y!, m! - 1, day! + 1)
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

export function repeatToRrule(r: Repeat, date: DayKey): string | undefined {
  switch (r.kind) {
    case 'none':
      return undefined
    case 'daily':
      return 'FREQ=DAILY'
    case 'weekdays':
      return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
    case 'weekly':
      return `FREQ=WEEKLY;BYDAY=${DAYS[isoWeekday(date) - 1]}`
    case 'monthly':
      return `FREQ=MONTHLY;BYMONTHDAY=${r.day ?? Number(date.slice(8, 10))}`
    case 'custom':
      return r.days.length ? `FREQ=WEEKLY;BYDAY=${[...r.days].sort().map((d) => DAYS[d - 1]).join(',')}` : undefined
  }
}

/** Напоминание для задачи со временем (null — у задачи нет даты или времени) */
export function taskEvent(task: Task, alarmMin: number, today: DayKey = todayKey()): IcsEvent | null {
  if (!task.time) return null
  const date = task.date || today
  return {
    uid: `task-${task.id}`,
    title: task.title,
    description: task.notes || undefined,
    date,
    time: task.time,
    rrule: repeatToRrule(task.repeat, date),
    alarmMin,
  }
}

/** Напоминание для привычки по её расписанию (null — нет времени напоминания) */
export function habitEvent(h: Habit, alarmMin: number, today: DayKey = todayKey()): IcsEvent | null {
  if (!h.reminderTime) return null
  const start = h.startDate > today ? h.startDate : today
  const rrule =
    h.schedule.kind === 'days' && h.schedule.days.length
      ? `FREQ=WEEKLY;BYDAY=${[...h.schedule.days].sort().map((d) => DAYS[d - 1]).join(',')}`
      : 'FREQ=DAILY'
  return {
    uid: `habit-${h.id}`,
    title: `${h.emoji} ${h.name}`,
    date: start,
    time: h.reminderTime,
    durationMin: 10,
    rrule,
    alarmMin,
  }
}

/** Имя файла без странных символов */
export const icsFileName = (title: string) =>
  `moy-den-${title.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'napominanie'}.ics`

import { getDaysInMonth } from 'date-fns'
import type { DayKey, Repeat } from '../db/types'
import { addDaysKey, dayKey, isoWeekday, parseDay } from './dates'
import { t } from '../i18n/ru'

/** Следующая дата повтора строго после from. null — повтора нет. */
export function nextDate(repeat: Repeat, from: DayKey): DayKey | null {
  switch (repeat.kind) {
    case 'none':
      return null
    case 'daily':
      return addDaysKey(from, 1)
    case 'weekly':
      return addDaysKey(from, 7)
    case 'weekdays': {
      let d = addDaysKey(from, 1)
      while (isoWeekday(d) > 5) d = addDaysKey(d, 1)
      return d
    }
    case 'custom': {
      if (repeat.days.length === 0) return null
      let d = from
      for (let i = 0; i < 7; i++) {
        d = addDaysKey(d, 1)
        if (repeat.days.includes(isoWeekday(d))) return d
      }
      return null
    }
    case 'monthly': {
      const base = parseDay(from)
      const want = repeat.day ?? base.getDate()
      const firstOfNext = new Date(base.getFullYear(), base.getMonth() + 1, 1)
      const day = Math.min(want, getDaysInMonth(firstOfNext))
      return dayKey(new Date(firstOfNext.getFullYear(), firstOfNext.getMonth(), day))
    }
  }
}

/**
 * Дата следующего повтора, когда задачу отметили выполненной.
 * Если задача была просрочена — пропускаем прошедшие даты, следующая будет позже сегодняшнего дня.
 * Задача без даты («Входящие») повторяется от сегодняшнего дня.
 */
export function nextOccurrence(repeat: Repeat, taskDate: DayKey | '', today: DayKey): DayKey | null {
  let next = nextDate(repeat, taskDate || today)
  for (let guard = 0; next !== null && next <= today && guard < 2000; guard++) {
    next = nextDate(repeat, next)
  }
  return next
}

const WEEKDAY_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']

export function repeatLabel(r: Repeat): string {
  switch (r.kind) {
    case 'none':
      return t.repeat.none
    case 'daily':
      return t.repeat.daily
    case 'weekdays':
      return t.repeat.weekdays
    case 'weekly':
      return t.repeat.weekly
    case 'monthly':
      return t.repeat.monthly
    case 'custom':
      return [...r.days].sort().map((d) => WEEKDAY_SHORT[d - 1]).join(', ') || t.repeat.custom
  }
}

export { WEEKDAY_SHORT }

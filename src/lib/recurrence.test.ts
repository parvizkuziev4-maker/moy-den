import { describe, expect, it } from 'vitest'
import { nextDate, nextOccurrence, repeatLabel } from './recurrence'

// 2026-11-13 — пятница, 2026-11-15 — воскресенье
describe('nextDate', () => {
  it('без повтора — null', () => {
    expect(nextDate({ kind: 'none' }, '2026-11-13')).toBeNull()
  })
  it('каждый день, через смену месяца и года', () => {
    expect(nextDate({ kind: 'daily' }, '2026-11-30')).toBe('2026-12-01')
    expect(nextDate({ kind: 'daily' }, '2026-12-31')).toBe('2027-01-01')
  })
  it('по будням: с пятницы на понедельник', () => {
    expect(nextDate({ kind: 'weekdays' }, '2026-11-13')).toBe('2026-11-16')
    expect(nextDate({ kind: 'weekdays' }, '2026-11-15')).toBe('2026-11-16')
    expect(nextDate({ kind: 'weekdays' }, '2026-11-16')).toBe('2026-11-17')
  })
  it('раз в неделю', () => {
    expect(nextDate({ kind: 'weekly' }, '2026-12-28')).toBe('2027-01-04')
  })
  it('выбранные дни недели (пн, ср, пт)', () => {
    const r = { kind: 'custom' as const, days: [1, 3, 5] }
    expect(nextDate(r, '2026-11-13')).toBe('2026-11-16') // пт → пн
    expect(nextDate(r, '2026-11-16')).toBe('2026-11-18') // пн → ср
    expect(nextDate({ kind: 'custom', days: [] }, '2026-11-13')).toBeNull()
  })
  it('раз в месяц: 31-е не съезжает', () => {
    const r = { kind: 'monthly' as const, day: 31 }
    expect(nextDate(r, '2027-01-31')).toBe('2027-02-28')
    expect(nextDate(r, '2027-02-28')).toBe('2027-03-31')
    expect(nextDate(r, '2028-01-31')).toBe('2028-02-29') // високосный
    expect(nextDate({ kind: 'monthly' }, '2026-12-15')).toBe('2027-01-15')
  })
})

describe('nextOccurrence', () => {
  const today = '2026-11-15'
  it('вовремя выполненная задача → следующая дата', () => {
    expect(nextOccurrence({ kind: 'daily' }, today, today)).toBe('2026-11-16')
  })
  it('просроченная ежедневная → завтра, а не вчера', () => {
    expect(nextOccurrence({ kind: 'daily' }, '2026-11-10', today)).toBe('2026-11-16')
  })
  it('просроченная еженедельная сохраняет день недели', () => {
    // 2026-11-02 — понедельник → следующий понедельник после сегодня
    expect(nextOccurrence({ kind: 'weekly' }, '2026-11-02', today)).toBe('2026-11-16')
  })
  it('задача из «Входящих» повторяется от сегодня', () => {
    expect(nextOccurrence({ kind: 'weekly' }, '', today)).toBe('2026-11-22')
  })
  it('выполнена заранее — от своей даты', () => {
    expect(nextOccurrence({ kind: 'weekly' }, '2026-11-20', today)).toBe('2026-11-27')
  })
})

describe('repeatLabel', () => {
  it('подписи по-русски', () => {
    expect(repeatLabel({ kind: 'daily' })).toBe('Каждый день')
    expect(repeatLabel({ kind: 'custom', days: [5, 1, 3] })).toBe('пн, ср, пт')
  })
})

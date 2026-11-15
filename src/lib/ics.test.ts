import { describe, expect, it } from 'vitest'
import type { Habit, Task } from '../db/types'
import { buildIcs, fold, habitEvent, icsEscape, icsFileName, repeatToRrule, taskEvent } from './ics'

const NOW = new Date('2026-11-15T04:00:00Z')

const task = (p: Partial<Task>): Task => ({
  id: 't1',
  title: 'Встреча с поставщиком',
  notes: '',
  date: '2026-11-16',
  time: '09:30',
  priority: 2,
  done: false,
  repeat: { kind: 'none' },
  subtasks: [],
  order: 0,
  createdAt: '',
  updatedAt: '',
  ...p,
})

const habit = (p: Partial<Habit>): Habit => ({
  id: 'h1',
  name: 'Вода',
  emoji: '💧',
  color: '',
  type: 'check',
  target: 1,
  unit: '',
  schedule: { kind: 'daily' },
  reminderTime: '08:00',
  archived: false,
  order: 0,
  startDate: '2026-11-01',
  createdAt: '',
  updatedAt: '',
  ...p,
})

describe('ics', () => {
  it('экранирует спецсимволы', () => {
    expect(icsEscape('Цены; скидки, бонусы\nи т.д.')).toBe('Цены\\; скидки\\, бонусы\\nи т.д.')
  })

  it('переносит длинные строки', () => {
    const f = fold('SUMMARY:' + 'а'.repeat(100))
    expect(f.split('\r\n').every((l) => l.length <= 75)).toBe(true)
    expect(f.split('\r\n')[1]!.startsWith(' ')).toBe(true)
  })

  it('событие задачи: местное время, 15 минут, напоминание за 10 минут', () => {
    const ics = buildIcs([taskEvent(task({}), 10)!], NOW)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('DTSTART:20261116T093000')
    expect(ics).toContain('DTEND:20261116T094500')
    expect(ics).toContain('SUMMARY:Встреча с поставщиком')
    expect(ics).toContain('TRIGGER:-PT10M')
    expect(ics).toContain('UID:task-t1@moy-den')
    expect(ics).not.toContain('RRULE')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('событие через полночь переходит на следующий день', () => {
    const ics = buildIcs([taskEvent(task({ time: '23:50', date: '2026-12-31' }), 0)!], NOW)
    expect(ics).toContain('DTEND:20270101T000500')
    expect(ics).toContain('TRIGGER:PT0M')
  })

  it('без времени — напоминания нет; без даты — на сегодня', () => {
    expect(taskEvent(task({ time: undefined }), 5)).toBeNull()
    expect(taskEvent(task({ date: '' }), 5, '2026-11-15')?.date).toBe('2026-11-15')
  })

  it('повторы задач в RRULE', () => {
    expect(repeatToRrule({ kind: 'daily' }, '2026-11-16')).toBe('FREQ=DAILY')
    expect(repeatToRrule({ kind: 'weekdays' }, '2026-11-16')).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')
    expect(repeatToRrule({ kind: 'weekly' }, '2026-11-18')).toBe('FREQ=WEEKLY;BYDAY=WE')
    expect(repeatToRrule({ kind: 'monthly', day: 31 }, '2026-11-30')).toBe('FREQ=MONTHLY;BYMONTHDAY=31')
    expect(repeatToRrule({ kind: 'custom', days: [5, 1] }, '2026-11-16')).toBe('FREQ=WEEKLY;BYDAY=MO,FR')
  })

  it('привычки: каждый день или по дням, начало не раньше сегодня', () => {
    const e = habitEvent(habit({}), 5, '2026-11-15')!
    expect(e).toMatchObject({ date: '2026-11-15', time: '08:00', rrule: 'FREQ=DAILY', title: '💧 Вода' })
    expect(habitEvent(habit({ schedule: { kind: 'days', days: [2, 4] } }), 5)!.rrule).toBe('FREQ=WEEKLY;BYDAY=TU,TH')
    expect(habitEvent(habit({ reminderTime: undefined }), 5)).toBeNull()
  })

  it('много событий в одном файле', () => {
    const ics = buildIcs([habitEvent(habit({}), 5)!, habitEvent(habit({ id: 'h2', name: 'Спорт' }), 5)!], NOW)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
  })

  it('имя файла', () => {
    expect(icsFileName('Встреча с поставщиком!')).toBe('moy-den-встреча-с-поставщиком.ics')
  })
})

import { describe, expect, it } from 'vitest'
import type { Habit, Task } from '../db/types'
import { moodByHabit, oneDecimal, tasksByArea } from './stats'

const habit = (id: string, p: Partial<Habit> = {}): Habit => ({
  id,
  name: id,
  emoji: '',
  color: '',
  type: 'check',
  target: 1,
  unit: '',
  schedule: { kind: 'daily' },
  archived: false,
  order: 0,
  startDate: '2026-01-01',
  createdAt: '',
  updatedAt: '',
  ...p,
})

describe('moodByHabit', () => {
  const days = [
    ['2026-11-01', 5],
    ['2026-11-02', 4],
    ['2026-11-03', 4],
    ['2026-11-04', 2],
    ['2026-11-05', 3],
    ['2026-11-06', 3],
    ['2026-11-07', 5],
  ].map(([date, mood]) => ({ date: date as string, mood: mood as number }))

  it('среднее с привычкой и без неё, по убыванию разницы', () => {
    const walk = habit('walk')
    const read = habit('read')
    const logs = new Map([
      ['walk', new Map(['2026-11-01', '2026-11-02', '2026-11-03'].map((d) => [d, 1]))],
      ['read', new Map(['2026-11-01', '2026-11-02', '2026-11-04', '2026-11-05'].map((d) => [d, 1]))], // разница 0.5
    ])
    const r = moodByHabit([read, walk], logs, days, '2026-11-01', '2026-11-30')
    expect(r.map((x) => x.habit.id)).toEqual(['walk', 'read'])
    expect(r[0]).toMatchObject({ withN: 3, withoutN: 4 })
    expect(r[0]!.withAvg).toBeCloseTo(13 / 3)
    expect(r[0]!.withoutAvg).toBeCloseTo(13 / 4)
  })

  it('мало данных — не делаем выводов', () => {
    const logs = new Map([['x', new Map([['2026-11-01', 1]])]])
    expect(moodByHabit([habit('x')], logs, days, '2026-11-01', '2026-11-30')).toEqual([])
  })

  it('дни не по расписанию не считаются «без привычки»', () => {
    const mon = habit('mon', { schedule: { kind: 'days', days: [1] } }) // только пн
    const logs = new Map([['mon', new Map([['2026-11-02', 1]])]])
    expect(moodByHabit([mon], logs, days, '2026-11-01', '2026-11-30', 1)).toEqual([])
  })
})

describe('tasksByArea', () => {
  it('только выполненные в периоде', () => {
    const t = (doneAt: string | undefined, areaId?: string): Task => ({
      id: Math.random().toString(),
      title: '',
      notes: '',
      date: '',
      priority: 2,
      done: !!doneAt,
      doneAt,
      areaId,
      repeat: { kind: 'none' },
      subtasks: [],
      order: 0,
      createdAt: '',
      updatedAt: '',
    })
    const m = tasksByArea(
      [
        t(new Date(2026, 10, 10, 12).toISOString(), 'biz'),
        t(new Date(2026, 10, 11, 12).toISOString(), 'biz'),
        t(new Date(2026, 10, 11, 12).toISOString()),
        t(new Date(2026, 9, 1, 12).toISOString(), 'biz'),
        t(undefined, 'biz'),
      ],
      '2026-11-09',
      '2026-11-15',
    )
    expect(m.get('biz')).toBe(2)
    expect(m.get('')).toBe(1)
  })
  it('oneDecimal', () => {
    expect(oneDecimal(4.25)).toBe('4.3')
    expect(oneDecimal(3)).toBe('3.0')
  })
})

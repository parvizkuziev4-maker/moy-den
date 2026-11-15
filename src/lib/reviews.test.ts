import { describe, expect, it } from 'vitest'
import type { DayEntry, Habit, Task, Win } from '../db/types'
import {
  compareText,
  daysBetween,
  lowMoodStreak,
  onThisDay,
  periodStats,
  pickPastWins,
  winsToMarkdown,
} from './reviews'

const win = (date: string, p: Partial<Win> = {}): Win => ({
  id: Math.random().toString(36),
  date,
  text: 'Победа',
  size: 'small',
  source: 'manual',
  createdAt: `${date}T10:00:00.000Z`,
  updatedAt: '',
  ...p,
})
const day = (date: string, mood?: number): DayEntry => ({
  date,
  mood,
  createdAt: '',
  updatedAt: '',
  gratitude: [],
  note: '',
  bestMoment: '',
  lesson: '',
  tomorrowFocus: '',
})

describe('periodStats', () => {
  const habit: Habit = {
    id: 'h',
    name: 'Спорт',
    emoji: '🏃',
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
  }
  const task = (doneAt?: string): Task => ({
    id: Math.random().toString(36),
    title: '',
    notes: '',
    date: '2026-11-10',
    priority: 2,
    done: !!doneAt,
    doneAt,
    repeat: { kind: 'none' },
    subtasks: [],
    order: 0,
    createdAt: '',
    updatedAt: '',
  })

  it('считает победы, задачи, привычки, настроение и лучший день за неделю', () => {
    const s = periodStats({
      from: '2026-11-09',
      to: '2026-11-15',
      today: '2026-11-15',
      wins: [
        win('2026-11-09'),
        win('2026-11-12', { size: 'big', areaId: 'biz' }),
        win('2026-11-12', { areaId: 'biz' }),
        win('2026-11-12'),
        win('2026-11-08'), // прошлая неделя
      ],
      tasks: [task(new Date(2026, 10, 10, 12).toISOString()), task(new Date(2026, 10, 1).toISOString()), task()],
      days: [day('2026-11-09', 2), day('2026-11-12', 5), day('2026-11-01', 1)],
      habits: [habit],
      // сделано 4 из 6 прошедших дней (сегодня не отмечено — не считается)
      logs: new Map([['h', new Map(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'].map((d) => [d, 1]))]]),
    })
    expect(s.wins).toBe(4)
    expect(s.bigWins).toBe(1)
    expect(s.tasksDone).toBe(1)
    expect(s.habitRate).toBeCloseTo(4 / 6)
    expect(s.avgMood).toBe(3.5)
    expect(s.bestDay).toMatchObject({ date: '2026-11-12', wins: 3 })
    expect(s.byDay).toHaveLength(7)
    expect(s.byArea.get('biz')).toBe(2)
  })

  it('будущие дни недели не считаются', () => {
    const s = periodStats({
      from: '2026-11-09',
      to: '2026-11-15',
      today: '2026-11-11',
      wins: [],
      tasks: [],
      days: [],
      habits: [],
      logs: new Map(),
    })
    expect(s.byDay).toHaveLength(3)
    expect(s.habitRate).toBeNull()
    expect(s.bestDay).toBeNull()
  })
})

describe('compareText — только позитив', () => {
  it('больше / так же / меньше / с нуля', () => {
    expect(compareText(12, 10)).toMatch(/На 2 победы больше/)
    expect(compareText(10, 10)).toMatch(/стабильность/)
    expect(compareText(5, 10)).toMatch(/каждая важна/)
    expect(compareText(3, 0)).toMatch(/отличный старт/)
    for (const s of [compareText(1, 50), compareText(0, 3)]) expect(s).not.toMatch(/меньше|хуже/)
  })
})

describe('lowMoodStreak', () => {
  it('три тяжёлых дня подряд', () => {
    const days = [day('2026-11-13', 2), day('2026-11-14', 1), day('2026-11-15', 2)]
    expect(lowMoodStreak(days, '2026-11-15')).toBe(true)
  })
  it('сегодня ещё не отмечено — смотрим до вчера', () => {
    const days = [day('2026-11-12', 1), day('2026-11-13', 2), day('2026-11-14', 1)]
    expect(lowMoodStreak(days, '2026-11-15')).toBe(true)
  })
  it('хороший день посередине или пропуск — нет', () => {
    expect(lowMoodStreak([day('2026-11-13', 2), day('2026-11-14', 4), day('2026-11-15', 1)], '2026-11-15')).toBe(false)
    expect(lowMoodStreak([day('2026-11-13', 2), day('2026-11-15', 1)], '2026-11-15')).toBe(false)
    expect(lowMoodStreak([day('2026-11-13', 2), day('2026-11-14', 2), day('2026-11-15', 3)], '2026-11-15')).toBe(false)
  })
})

describe('onThisDay', () => {
  it('месяц и год назад, через смену года', () => {
    const wins = [win('2026-10-15'), win('2025-11-15'), win('2026-11-14')]
    const r = onThisDay(wins, '2026-11-15')
    expect(r.monthAgo.map((w) => w.date)).toEqual(['2026-10-15'])
    expect(r.yearAgo.map((w) => w.date)).toEqual(['2025-11-15'])
    expect(onThisDay([win('2025-12-15')], '2026-01-15').monthAgo).toHaveLength(1)
  })
})

describe('pickPastWins', () => {
  it('только прошлые, не больше n, без служебных', () => {
    const wins = [
      ...Array.from({ length: 10 }, (_, i) => win(`2026-10-${10 + i}`)),
      win('2026-11-15'),
      win('2026-11-01', { refId: 'all-habits' }),
    ]
    const r = pickPastWins(wins, '2026-11-15', 5)
    expect(r).toHaveLength(5)
    expect(r.every((w) => w.date < '2026-11-15' && w.refId !== 'all-habits')).toBe(true)
  })
})

describe('winsToMarkdown', () => {
  it('группирует по дням, отмечает большие и сферы', () => {
    const md = winsToMarkdown(
      'Мои победы',
      [win('2026-11-14', { text: 'Закрыл сделку', size: 'big', areaId: 'b' }), win('2026-11-13', { text: 'Прогулка' })],
      new Map([['b', { name: 'Бизнес', emoji: '💼' }]]),
      new Map([['2026-11-14', { mood: 5, lesson: 'Терпение окупается', gratitude: ['семья'] }]]),
    )
    expect(md).toContain('# Мои победы')
    expect(md).toContain('Всего побед: 2')
    expect(md.indexOf('13 ноября')).toBeLessThan(md.indexOf('14 ноября'))
    expect(md).toContain('- ⭐ Закрыл сделку _(💼 Бизнес)_')
    expect(md).toContain('😄')
    expect(md).toContain('Чему научился: Терпение окупается')
  })
})

describe('daysBetween', () => {
  it('включительно, через месяц', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  })
})

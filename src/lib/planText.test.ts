import { describe, expect, it } from 'vitest'
import { parseDay, parsePlanText, sameName } from './planText'

const TODAY = '2026-11-21'

describe('parseDay', () => {
  it('понимает разные записи даты', () => {
    expect(parseDay('2026-11-22', TODAY)).toBe('2026-11-22')
    expect(parseDay('22.11.2026', TODAY)).toBe('2026-11-22')
    expect(parseDay('завтра', TODAY)).toBe('2026-11-22')
    expect(parseDay('Сегодня', TODAY)).toBe(TODAY)
    expect(parseDay('2026-02-30', TODAY)).toBeNull()
    expect(parseDay('потом', TODAY)).toBeNull()
  })
})

describe('sameName', () => {
  it('сравнивает имена без учёта порядка и регистра', () => {
    expect(sameName('Qurbonov Muhammadali', 'muhammadali  qurbonov')).toBe(true)
    expect(sameName('Мустафо', 'Safarov Мустафо')).toBe(true)
    expect(sameName('Алёна', 'алена')).toBe(true)
    expect(sameName('Mustafo', 'Muhammadali')).toBe(false)
  })
})

describe('parsePlanText', () => {
  const text = `Мой День
Дата: 2026-11-22
05:41 Fajr
06:00 ! ★ CSCA math, block 1 // phone in another room
12:45 Lunch with Muhammadali @Qurbonov Muhammadali
- first subtask
- second subtask
Read 20 pages

Люди:
Qurbonov Muhammadali
? How is our friendship going?
- XAMKOR changes
Person: Safarov Mustafo
? Who makes which slides?
`
  const p = parsePlanText(text, TODAY)

  it('читает задачи с временем, важностью, фокусом и заметкой', () => {
    expect(p.tasks).toHaveLength(4)
    expect(p.tasks[0]).toMatchObject({
      date: '2026-11-22',
      time: '05:41',
      title: 'Fajr',
      priority: 2,
      focus: false,
    })
    expect(p.tasks[1]).toMatchObject({
      time: '06:00',
      title: 'CSCA math, block 1',
      notes: 'phone in another room',
      priority: 1,
      focus: true,
    })
    expect(p.tasks[3]).toMatchObject({ title: 'Read 20 pages', time: undefined })
  })

  it('связывает задачу с человеком и собирает подзадачи', () => {
    expect(p.tasks[2]).toMatchObject({
      title: 'Lunch with Muhammadali',
      personName: 'Qurbonov Muhammadali',
      subtasks: ['first subtask', 'second subtask'],
    })
  })

  it('читает людей, вопросы и темы; заголовок не становится задачей', () => {
    expect(p.people).toEqual([
      {
        name: 'Qurbonov Muhammadali',
        asks: ['How is our friendship going?'],
        topics: ['XAMKOR changes'],
      },
      { name: 'Safarov Mustafo', asks: ['Who makes which slides?'], topics: [] },
    ])
    expect(p.skipped).toEqual([])
  })

  it('отмечает непонятные строки', () => {
    const r = parsePlanText('Дата: когда-нибудь\nЛюди:\n? вопрос без человека', TODAY)
    expect(r.skipped.map((s) => s.line)).toEqual([1, 3])
  })

  it('время 25:00 — не время', () => {
    const r = parsePlanText('Дата: завтра\n25:00 Странно', TODAY)
    expect(r.tasks).toHaveLength(0)
    expect(r.skipped).toHaveLength(1)
  })
})

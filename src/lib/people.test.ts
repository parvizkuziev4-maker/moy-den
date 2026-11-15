import { describe, expect, it } from 'vitest'
import type { Person } from '../db/types'
import {
  daysSinceContact,
  initials,
  isContactOverdue,
  nextBirthday,
  overdueContacts,
  peopleToCsv,
  sortPeople,
  telegramLink,
  upcomingBirthdays,
} from './people'

const T = '2026-11-15'
const person = (p: Partial<Person>): Person => ({
  id: Math.random().toString(36),
  name: 'Имя',
  group: 'friends',
  howWeMet: '',
  phone: '',
  telegram: '',
  notes: '',
  contactEveryDays: 0,
  tags: [],
  favorite: false,
  supportCircle: false,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '',
  ...p,
})

describe('initials', () => {
  it('две буквы, одна или «?»', () => {
    expect(initials('Алишер Каримов')).toBe('АК')
    expect(initials('  мама ')).toBe('М')
    expect(initials('')).toBe('?')
  })
})

describe('давно не общались', () => {
  it('daysSinceContact', () => {
    expect(daysSinceContact({ lastContactAt: '2026-11-10' }, T)).toBe(5)
    expect(daysSinceContact({}, T)).toBeNull()
  })
  it('isContactOverdue: по последнему разговору или по дате добавления', () => {
    expect(isContactOverdue(person({ contactEveryDays: 7, lastContactAt: '2026-11-07' }), T)).toBe(true)
    expect(isContactOverdue(person({ contactEveryDays: 7, lastContactAt: '2026-11-08' }), T)).toBe(false)
    expect(isContactOverdue(person({ contactEveryDays: 0, lastContactAt: '2025-01-01' }), T)).toBe(false)
    expect(isContactOverdue(person({ contactEveryDays: 7 }), T)).toBe(true) // добавлен 1 ноября
    expect(isContactOverdue(person({ contactEveryDays: 30 }), T)).toBe(false)
  })
  it('overdueContacts: до 3 человек, дольше всех — первым', () => {
    const list = [
      person({ name: 'А', contactEveryDays: 7, lastContactAt: '2026-11-01' }),
      person({ name: 'Б', contactEveryDays: 7, lastContactAt: '2026-10-01' }),
      person({ name: 'В', contactEveryDays: 7, lastContactAt: '2026-11-14' }),
      person({ name: 'Г', contactEveryDays: 3, lastContactAt: '2026-11-04' }), // просрочка 8
      person({ name: 'Д', contactEveryDays: 30, lastContactAt: '2026-09-01' }),
    ]
    // сортировка по просрочке сверх желаемого: Д 45, Б 38, Г 8, А 7
    expect(overdueContacts(list, T).map((p) => p.name)).toEqual(['Д', 'Б', 'Г'])
  })
})

describe('дни рождения', () => {
  it('в этом году, в следующем и сегодня', () => {
    expect(nextBirthday('1990-11-18', T)).toEqual({ date: '2026-11-18', daysLeft: 3, turns: 36 })
    expect(nextBirthday('03-08', T)).toEqual({ date: '2027-03-08', daysLeft: 113, turns: undefined })
    expect(nextBirthday('1985-11-15', T)?.daysLeft).toBe(0)
  })
  it('через Новый год', () => {
    expect(nextBirthday('01-02', '2026-12-30')?.daysLeft).toBe(3)
  })
  it('29 февраля в невисокосный год — 28-го', () => {
    expect(nextBirthday('2000-02-29', '2027-01-01')?.date).toBe('2027-02-28')
    expect(nextBirthday('2000-02-29', '2028-01-01')?.date).toBe('2028-02-29')
  })
  it('пусто или мусор — null', () => {
    expect(nextBirthday(undefined, T)).toBeNull()
    expect(nextBirthday('завтра', T)).toBeNull()
  })
  it('upcomingBirthdays: в пределах недели, по порядку', () => {
    const list = [
      person({ name: 'Через 5', birthday: '11-20' }),
      person({ name: 'Сегодня', birthday: '11-15' }),
      person({ name: 'Далеко', birthday: '12-25' }),
      person({ name: 'Без даты' }),
    ]
    expect(upcomingBirthdays(list, T).map((x) => x.person.name)).toEqual(['Сегодня', 'Через 5'])
  })
})

describe('sortPeople', () => {
  const list = [
    person({ name: 'Борис', lastContactAt: '2026-11-14', createdAt: '2026-01-01' }),
    person({ name: 'Анна', lastContactAt: '2026-10-01', createdAt: '2026-03-01' }),
    person({ name: 'Вера', favorite: true, createdAt: '2026-02-01' }),
    person({ name: 'Гуля', createdAt: '2026-05-01' }),
  ]
  it('избранные сверху, затем по имени', () => {
    expect(sortPeople(list, 'name', T).map((p) => p.name)).toEqual(['Вера', 'Анна', 'Борис', 'Гуля'])
  })
  it('давно не общались: без разговоров и самые давние — выше', () => {
    expect(sortPeople(list, 'contact', T).map((p) => p.name)).toEqual(['Вера', 'Гуля', 'Анна', 'Борис'])
  })
  it('новые', () => {
    expect(sortPeople(list, 'recent', T).map((p) => p.name)).toEqual(['Вера', 'Гуля', 'Анна', 'Борис'])
  })
})

describe('ссылки и CSV', () => {
  it('telegramLink', () => {
    expect(telegramLink('@aziz')).toBe('https://t.me/aziz')
    expect(telegramLink('https://t.me/aziz')).toBe('https://t.me/aziz')
  })
  it('peopleToCsv: заголовок, BOM, экранирование', () => {
    const csv = peopleToCsv([person({ name: 'Иванов, Пётр', notes: 'Любит "чай"\nи футбол', group: 'suppliers' })])
    expect(csv.startsWith('﻿Имя,Группа')).toBe(true)
    expect(csv).toContain('"Иванов, Пётр",Поставщики')
    expect(csv).toContain('"Любит ""чай""\nи футбол"')
  })
})

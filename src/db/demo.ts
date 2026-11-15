import { db, type MoyDenDB } from './db'
import type { Area, DayEntry, Habit, HabitLog, Interaction, Person, Task, Topic, Win } from './types'
import { addDaysKey, todayKey } from '../lib/dates'
import { nowIso } from '../lib/id'

// «Загрузить пример» — чтобы посмотреть, как всё выглядит. У всех записей id начинается с «demo-»
// (у записей дня — пометка demo), поэтому «Удалить пример» убирает только их, твои данные не трогает.

const PREFIX = 'demo-'
const isDemo = (id: unknown) => typeof id === 'string' && id.startsWith(PREFIX)

/** Простой повторяемый «случай», чтобы пример всегда был одинаковым */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

export async function hasDemo(d: MoyDenDB = db): Promise<boolean> {
  return (await d.habits.where('id').startsWith(PREFIX).count()) > 0
}

export async function loadDemo(d: MoyDenDB = db, today = todayKey()): Promise<void> {
  if (await hasDemo(d)) return
  const r = rng(42)
  const now = nowIso()
  const base = { createdAt: now, updatedAt: now }
  const areas: Area[] = await d.areas.orderBy('order').toArray()
  const area = (name: string) => areas.find((a) => a.name === name)?.id

  const habits: Habit[] = [
    { id: 'demo-h-water', name: 'Вода', emoji: '💧', color: '#3b82c4', type: 'count', target: 8, unit: 'стаканов', schedule: { kind: 'daily' }, reminderTime: '09:00', archived: false, order: 100, startDate: addDaysKey(today, -60), ...base },
    { id: 'demo-h-walk', name: 'Прогулка', emoji: '🚶', color: '#5aa55a', type: 'check', target: 1, unit: '', schedule: { kind: 'daily' }, archived: false, order: 101, startDate: addDaysKey(today, -60), ...base },
    { id: 'demo-h-read', name: 'Чтение 20 минут', emoji: '📖', color: '#8b6fd6', type: 'check', target: 1, unit: '', schedule: { kind: 'daily' }, reminderTime: '21:30', archived: false, order: 102, startDate: addDaysKey(today, -60), ...base },
    { id: 'demo-h-sport', name: 'Спорт', emoji: '🏃', color: '#e5654b', type: 'check', target: 1, unit: '', schedule: { kind: 'timesPerWeek', times: 3 }, archived: false, order: 103, startDate: addDaysKey(today, -60), ...base },
  ]

  const logs: HabitLog[] = []
  const wins: Win[] = []
  const days: DayEntry[] = []
  const winTexts: [string, string | undefined, Win['size']][] = [
    ['Закрыл поставку чая из Китая', 'Бизнес', 'big'],
    ['Провёл встречу бизнес-клуба', 'Клуб', 'medium'],
    ['Помог сыну с математикой', 'Семья', 'small'],
    ['Договорился о скидке у поставщика', 'Бизнес', 'medium'],
    ['Прочитал главу книги про переговоры', 'Учёба', 'small'],
    ['Разобрал склад', 'Бизнес', 'small'],
    ['Позвонил маме', 'Семья', 'small'],
    ['Выучил 10 английских слов', 'Учёба', 'small'],
    ['Отдохнул вечером с семьёй', 'Семья', 'small'],
    ['Нашёл нового клиента', 'Бизнес', 'big'],
  ]

  for (let i = 59; i >= 1; i--) {
    const date = addDaysKey(today, -i)
    const walked = r() < 0.65
    const read = r() < 0.55
    if (walked) logs.push({ id: `demo-l-walk-${date}`, habitId: 'demo-h-walk', date, value: 1, note: '', ...base })
    if (read) logs.push({ id: `demo-l-read-${date}`, habitId: 'demo-h-read', date, value: 1, note: '', ...base })
    if (r() < 0.45) logs.push({ id: `demo-l-sport-${date}`, habitId: 'demo-h-sport', date, value: 1, note: '', ...base })
    logs.push({ id: `demo-l-water-${date}`, habitId: 'demo-h-water', date, value: 5 + Math.floor(r() * 5), note: '', ...base })

    // настроение чуть лучше в дни с прогулкой — чтобы было видно наблюдение в статистике
    const mood = Math.max(1, Math.min(5, Math.round(2.6 + (walked ? 1.1 : 0) + (r() - 0.5) * 1.6)))
    days.push({
      date,
      mood,
      energy: Math.max(1, Math.min(5, mood + Math.round(r() * 2 - 1))),
      gratitude: ['Здоровье семьи', '', ''],
      note: '',
      bestMoment: '',
      lesson: '',
      tomorrowFocus: '',
      demo: true,
      ...base,
    })

    const n = Math.floor(r() * 4)
    for (let k = 0; k < n; k++) {
      const [text, a, size] = winTexts[Math.floor(r() * winTexts.length)]!
      wins.push({ id: `demo-w-${date}-${k}`, date, text, areaId: a ? area(a) : undefined, size, source: 'manual', ...base })
    }
  }

  const tasks: Task[] = [
    ['Встреча с поставщиком', today, '11:00', 1, 'Бизнес'],
    ['Позвонить в банк', today, undefined, 2, 'Бизнес'],
    ['Купить подарок сыну', today, undefined, 2, 'Семья'],
    ['Подготовить отчёт для клуба', addDaysKey(today, 1), '15:00', 1, 'Клуб'],
    ['Урок английского', addDaysKey(today, 2), '19:00', 2, 'Учёба'],
    ['Идея: доставка чая за 1 день', '', undefined, 3, 'Бизнес'],
  ].map(([title, date, time, priority, a], i) => ({
    id: `demo-t-${i}`,
    title: title as string,
    notes: '',
    date: date as string,
    time: time as string | undefined,
    priority: priority as 1 | 2 | 3,
    areaId: area(a as string),
    done: false,
    repeat: { kind: 'none' as const },
    subtasks: [],
    order: i,
    personId: i === 0 ? 'demo-p-alisher' : undefined,
    ...base,
  }))

  const people: Person[] = [
    { id: 'demo-p-alisher', name: 'Алишер Каримов', group: 'suppliers', howWeMet: 'Выставка в Урумчи', phone: '+992 90 000 00 01', telegram: '@example', birthday: `1985-${addDaysKey(today, 3).slice(5)}`, notes: 'Любит зелёный чай. Двое детей.', contactEveryDays: 14, lastContactAt: addDaysKey(today, -20), tags: ['чай'], favorite: false, supportCircle: false, ...base },
    { id: 'demo-p-mama', name: 'Мама', group: 'family', howWeMet: '', phone: '+992 90 000 00 02', telegram: '', notes: '', contactEveryDays: 2, lastContactAt: addDaysKey(today, -1), tags: [], favorite: true, supportCircle: true, ...base },
    { id: 'demo-p-farhod', name: 'Фарход', group: 'club', howWeMet: 'Бизнес-клуб', phone: '', telegram: '@example2', notes: 'Строит склад в Худжанде.', contactEveryDays: 30, lastContactAt: addDaysKey(today, -9), tags: [], favorite: false, supportCircle: false, ...base },
  ]
  const topics: Topic[] = [
    { id: 'demo-tp-1', personId: 'demo-p-alisher', text: 'Новый сорт зелёного чая', kind: 'topic', status: 'open', priority: 2, ...base },
    { id: 'demo-tp-2', personId: 'demo-p-alisher', text: 'Как здоровье отца?', kind: 'ask', status: 'open', priority: 2, ...base },
    { id: 'demo-tp-3', text: 'Доставка за 1 день — кто уже делает?', kind: 'topic', status: 'open', priority: 2, ...base },
  ]
  const interactions: Interaction[] = [
    { id: 'demo-i-1', personId: 'demo-p-alisher', date: addDaysKey(today, -20), type: 'call', summary: 'Обсудили цены на зимнюю поставку', followUp: 'Отправить прайс-лист', ...base },
    { id: 'demo-i-2', personId: 'demo-p-farhod', date: addDaysKey(today, -9), type: 'meeting', summary: 'Встретились на клубе, говорили про склад', followUp: '', ...base },
  ]

  await d.transaction('rw', [d.habits, d.habitLogs, d.wins, d.days, d.tasks, d.people, d.topics, d.interactions], async () => {
    await d.habits.bulkPut(habits)
    await d.habitLogs.bulkPut(logs)
    await d.wins.bulkPut(wins)
    // свои записи дня не перезаписываем
    const existing = new Set((await d.days.bulkGet(days.map((x) => x.date))).filter(Boolean).map((x) => x!.date))
    await d.days.bulkPut(days.filter((x) => !existing.has(x.date)))
    await d.tasks.bulkPut(tasks)
    await d.people.bulkPut(people)
    await d.topics.bulkPut(topics)
    await d.interactions.bulkPut(interactions)
  })
}

/** Удалить только пример. Твои записи остаются. */
export async function removeDemo(d: MoyDenDB = db): Promise<void> {
  await d.transaction('rw', [d.habits, d.habitLogs, d.wins, d.days, d.tasks, d.people, d.topics, d.interactions], async () => {
    for (const table of [d.habits, d.habitLogs, d.wins, d.tasks, d.people, d.topics, d.interactions]) {
      await table.where('id').startsWith(PREFIX).delete()
    }
    // победы, созданные из демо-задач и демо-привычек
    await d.wins.filter((w) => isDemo(w.refId)).delete()
    await d.habitLogs.filter((l) => isDemo(l.habitId)).delete()
    await d.days.filter((x) => x.demo === true).delete()
  })
}

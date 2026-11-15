import { Dexie, type EntityTable, type Table } from 'dexie'
import type {
  Area,
  DayEntry,
  Habit,
  HabitLog,
  Interaction,
  Person,
  Settings,
  Task,
  Topic,
  Win,
} from './types'
import { defaultAreas, defaultSettings } from './defaults'

/**
 * Версия схемы данных. Её же пишем в резервную копию.
 *
 * КАК ОБНОВЛЯТЬ СХЕМУ, НЕ ТЕРЯЯ ДАННЫЕ:
 * 1. Никогда не меняй и не удаляй старые вызовы db.version(N).
 * 2. Добавь новый db.version(N + 1).stores({...}) только с изменёнными таблицами
 *    и, если нужно, .upgrade(tx => ...) для преобразования старых записей.
 * 3. Увеличь SCHEMA_VERSION и добавь тест в db.test.ts.
 */
export const SCHEMA_VERSION = 1

export class MoyDenDB extends Dexie {
  tasks!: EntityTable<Task, 'id'>
  areas!: EntityTable<Area, 'id'>
  habits!: EntityTable<Habit, 'id'>
  habitLogs!: EntityTable<HabitLog, 'id'>
  wins!: EntityTable<Win, 'id'>
  days!: Table<DayEntry, string>
  people!: EntityTable<Person, 'id'>
  topics!: EntityTable<Topic, 'id'>
  interactions!: EntityTable<Interaction, 'id'>
  settings!: Table<Settings, 'main'>

  constructor(name = 'moy-den') {
    super(name)

    // Версия 1. Указываем только индексы (поля для поиска/сортировки), остальные поля хранятся и так.
    // Логические поля (done, archived) не индексируем — IndexedDB не умеет индексировать true/false.
    this.version(1).stores({
      tasks: 'id, date, doneAt, personId, areaId, updatedAt',
      areas: 'id, order',
      habits: 'id, order',
      habitLogs: 'id, habitId, date, &[habitId+date]',
      wins: 'id, date, source, refId, areaId',
      days: 'date',
      people: 'id, name, group, lastContactAt',
      topics: 'id, personId, status',
      interactions: 'id, personId, date',
      settings: 'id',
    })

    // Первый запуск: создаём сферы жизни и настройки по умолчанию.
    this.on('populate', (tx) => {
      void tx.table('areas').bulkAdd(defaultAreas())
      void tx.table('settings').add(defaultSettings())
    })
  }
}

export const db = new MoyDenDB()

/** Все таблицы с данными — в этом порядке пишем в резервную копию. */
export const DATA_TABLES = [
  'tasks',
  'areas',
  'habits',
  'habitLogs',
  'wins',
  'days',
  'people',
  'topics',
  'interactions',
  'settings',
] as const
export type DataTable = (typeof DATA_TABLES)[number]

/** Поле-ключ записи в таблице. */
export function keyOf(table: DataTable): 'id' | 'date' {
  return table === 'days' ? 'date' : 'id'
}

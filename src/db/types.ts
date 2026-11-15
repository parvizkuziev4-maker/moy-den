// Модель данных «Мой День». Даты дня — строка YYYY-MM-DD, моменты времени — ISO-строка.

/** Общие поля у каждой записи. */
export interface Base {
  id: string
  createdAt: string
  updatedAt: string
}

export type DayKey = string // YYYY-MM-DD

export type Priority = 1 | 2 | 3

export type Repeat =
  | { kind: 'none' }
  | { kind: 'daily' }
  | { kind: 'weekdays' }
  | { kind: 'weekly' }
  /** day — какое число месяца (чтобы 31-е не «съезжало» на 28-е) */
  | { kind: 'monthly'; day?: number }
  /** Выбранные дни недели: 1 = пн … 7 = вс */
  | { kind: 'custom'; days: number[] }

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Task extends Base {
  title: string
  notes: string
  /** Пустая строка = «Входящие» (без даты) */
  date: DayKey | ''
  /** HH:mm, необязательно */
  time?: string
  priority: Priority
  areaId?: string
  done: boolean
  doneAt?: string
  repeat: Repeat
  subtasks: Subtask[]
  order: number
  personId?: string
  /** В «Фокусе дня» (до 3 главных задач) */
  focus?: boolean
  /** id следующего повтора, созданного при выполнении (чтобы не создать дважды) */
  spawnedNextId?: string
}

export interface Area extends Base {
  name: string
  color: string
  emoji: string
  order: number
}

export type HabitSchedule =
  | { kind: 'daily' }
  /** 1 = пн … 7 = вс */
  | { kind: 'days'; days: number[] }
  | { kind: 'timesPerWeek'; times: number }

export interface Habit extends Base {
  name: string
  emoji: string
  color: string
  type: 'check' | 'count'
  /** Цель для счётчика (например, 8 стаканов) */
  target: number
  unit: string
  schedule: HabitSchedule
  /** HH:mm — для напоминания в Календаре (.ics) */
  reminderTime?: string
  archived: boolean
  order: number
  startDate: DayKey
}

export interface HabitLog extends Base {
  habitId: string
  date: DayKey
  value: number
  note: string
}

export type WinSize = 'small' | 'medium' | 'big'
export type WinSource = 'manual' | 'task' | 'habit'

export interface Win extends Base {
  date: DayKey
  text: string
  areaId?: string
  size: WinSize
  source: WinSource
  /** id задачи или привычки, если победа создана автоматически */
  refId?: string
}

/** Запись дня. Ключ — дата. */
export interface DayEntry {
  date: DayKey
  createdAt: string
  updatedAt: string
  mood?: number // 1–5
  energy?: number // 1–5
  gratitude: string[]
  note: string
  bestMoment: string
  lesson: string
  tomorrowFocus: string
  /** id победы, выбранной «победой недели» (хранится в воскресенье недели) */
  winOfWeekId?: string
  /** Запись из «примера данных» — удаляется кнопкой «Удалить пример» */
  demo?: boolean
}

export const PERSON_GROUPS = [
  'family',
  'friends',
  'partners',
  'suppliers',
  'clients',
  'club',
  'study',
  'other',
] as const
export type PersonGroup = (typeof PERSON_GROUPS)[number]

export interface Person extends Base {
  name: string
  /** Сжатое изображение data:URL, до ~200 КБ */
  photo?: string
  group: PersonGroup
  howWeMet: string
  phone: string
  telegram: string
  /** YYYY-MM-DD или MM-DD, если год неизвестен */
  birthday?: string
  notes: string
  /** Как часто хочу общаться, в днях (0 = не напоминать) */
  contactEveryDays: number
  lastContactAt?: string
  tags: string[]
  favorite: boolean
  /** В списке «Кому позвонить» на экране «Мне тяжело» */
  supportCircle: boolean
}

export interface Topic extends Base {
  /** Пусто = общая тема из «Банка тем» */
  personId?: string
  text: string
  /** ask = «что спросить в следующий раз» */
  kind: 'topic' | 'ask'
  status: 'open' | 'discussed'
  discussedAt?: string
  priority: Priority
}

export interface Interaction extends Base {
  personId: string
  date: DayKey
  type: 'meeting' | 'call' | 'message'
  summary: string
  followUp: string
}

export type ThemeMode = 'light' | 'dark' | 'system'
export const ACCENTS = ['sun', 'coral', 'mint', 'ocean', 'lavender', 'rose'] as const
export type Accent = (typeof ACCENTS)[number]

export interface Settings {
  id: 'main'
  updatedAt: string
  name: string
  theme: ThemeMode
  accent: Accent
  /** 1 = понедельник, 0 = воскресенье */
  weekStartsOn: 0 | 1
  showQuotes: boolean
  /** Мягкий режим привычек: пропуск не ломает серию */
  softHabits: boolean
  /** Сколько «дней отдыха» в неделю допускает мягкий режим */
  restDaysPerWeek: number
  /** SHA-256 от PIN-кода; пусто — PIN выключен */
  pinHash?: string
  lastBackupAt?: string
  installHintDismissed: boolean
  /** За сколько минут напоминать в Календаре (0–15) */
  reminderLeadMinutes: number
}

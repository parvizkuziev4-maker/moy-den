import type { Area, Settings } from './types'
import { newId, nowIso } from '../lib/id'

export function defaultSettings(): Settings {
  return {
    id: 'main',
    updatedAt: nowIso(),
    name: '',
    theme: 'system',
    accent: 'sun',
    weekStartsOn: 1,
    showQuotes: true,
    softHabits: true,
    restDaysPerWeek: 1,
    installHintDismissed: false,
    reminderLeadMinutes: 10,
    glassEffect: true,
  }
}

const AREAS: [string, string, string][] = [
  ['Бизнес', '💼', '#3b82c4'],
  ['Учёба', '📚', '#8b6fd6'],
  ['Семья', '🏡', '#e5654b'],
  ['Здоровье', '💪', '#2a9d82'],
  ['Клуб', '🤝', '#e8913a'],
  ['Личное', '✨', '#d9578a'],
]

export function defaultAreas(): Area[] {
  const now = nowIso()
  return AREAS.map(([name, emoji, color], order) => ({
    id: newId(),
    createdAt: now,
    updatedAt: now,
    name,
    emoji,
    color,
    order,
  }))
}

import { useSyncExternalStore } from 'react'
import { db } from '../db/db'
import { defaultSettings } from '../db/defaults'
import { ACCENTS, type Accent, type Settings, type ThemeMode } from '../db/types'
import { nowIso } from './id'
import { syncLockWithSettings } from './lock'

// Настройки. Главное место хранения — таблица settings в базе (попадает в резервную копию).
// Копия в localStorage нужна только чтобы тема применялась мгновенно при запуске (см. index.html).

export { ACCENTS }
export type { Accent, ThemeMode }

export const ACCENT_HEX: Record<Accent, string> = {
  sun: '#e8913a',
  coral: '#e5654b',
  mint: '#2a9d82',
  ocean: '#3b82c4',
  lavender: '#8b6fd6',
  rose: '#d9578a',
}

export type Prefs = Settings

const KEY = 'moy-den-prefs'

function readCache(): Prefs {
  const base = defaultSettings()
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...base, ...(JSON.parse(raw) as Partial<Prefs>), id: 'main' } : base
  } catch {
    return base
  }
}

let current: Prefs = readCache()
const listeners = new Set<() => void>()

function publish(next: Prefs) {
  current = next
  try {
    // PIN-хэш в кэш не кладём.
    const { pinHash: _pin, ...rest } = next
    void _pin
    localStorage.setItem(KEY, JSON.stringify(rest))
  } catch {
    /* приватный режим — не страшно */
  }
  applyAppearance()
  listeners.forEach((l) => l())
}

export function setPrefs(patch: Partial<Omit<Prefs, 'id'>>) {
  const next = { ...current, ...patch, updatedAt: nowIso() }
  publish(next)
  void db.settings.put(next)
}

/** Загрузить настройки из базы (при запуске и после восстановления копии). */
export async function loadPrefsFromDb() {
  const saved = await db.settings.get('main')
  if (saved) {
    publish({ ...defaultSettings(), ...saved })
  } else {
    await db.settings.put(current)
  }
  syncLockWithSettings(current.pinHash)
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

export function applyAppearance() {
  const dark = current.theme === 'dark' || (current.theme === 'system' && darkQuery.matches)
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.dataset.accent = current.accent
  root.classList.toggle('no-glass', current.glassEffect === false)
  // Цвет полосы статуса под тему приложения
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((m) => (m.content = dark ? '#141210' : '#FBF7F2'))
}

darkQuery.addEventListener('change', applyAppearance)

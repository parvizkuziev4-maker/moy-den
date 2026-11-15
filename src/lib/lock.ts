import { useSyncExternalStore } from 'react'

// Состояние блокировки PIN-кодом. Флаг «PIN включён» дублируем в localStorage,
// чтобы закрыть экран сразу при запуске, ещё до загрузки базы.

const FLAG = 'moy-den-pin-on'
const AUTOLOCK_MS = 5 * 60 * 1000

function readFlag(): boolean {
  try {
    return localStorage.getItem(FLAG) === '1'
  } catch {
    return false
  }
}

let locked = readFlag()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function setPinFlag(on: boolean) {
  try {
    if (on) localStorage.setItem(FLAG, '1')
    else localStorage.removeItem(FLAG)
  } catch {
    /* ничего */
  }
}

export const lock = () => {
  locked = true
  emit()
}
export const unlock = () => {
  locked = false
  emit()
}

export function useLocked(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => locked,
  )
}

/** Сверить флаг с базой после загрузки настроек */
export function syncLockWithSettings(pinHash: string | undefined) {
  setPinFlag(!!pinHash)
  if (pinHash && !locked && !sessionStarted) lock()
  if (!pinHash && locked) unlock()
}
let sessionStarted = false
export const markUnlockedOnce = () => {
  sessionStarted = true
}

// Блокировка через 5 минут в фоне
let hiddenAt = 0
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now()
    else if (readFlag() && hiddenAt && Date.now() - hiddenAt > AUTOLOCK_MS) lock()
  })
}

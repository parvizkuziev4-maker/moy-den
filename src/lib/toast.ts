import { useSyncExternalStore } from 'react'

export interface ToastItem {
  id: number
  text: string
  action?: { label: string; run: () => void }
}

let current: ToastItem | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** Короткое сообщение внизу экрана. С action — кнопка («Отменить») на 5 секунд. */
export function showToast(text: string, action?: ToastItem['action'], ms = action ? 5000 : 2500) {
  clearTimeout(timer)
  current = { id: ++seq, text, action }
  emit()
  timer = setTimeout(dismissToast, ms)
}

export function dismissToast() {
  clearTimeout(timer)
  current = null
  emit()
}

export function useToast(): ToastItem | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}

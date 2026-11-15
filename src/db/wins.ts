import { db } from './db'
import type { DayEntry, DayKey, Win } from './types'
import { newId, nowIso } from '../lib/id'
import { todayKey } from '../lib/dates'

export type NewWin = Partial<Omit<Win, 'id' | 'createdAt' | 'updatedAt'>> & { text: string }

export async function addWin(input: NewWin): Promise<string> {
  const now = nowIso()
  const win: Win = {
    date: todayKey(),
    size: 'small',
    source: 'manual',
    ...input,
    text: input.text.trim(),
    id: newId(),
    createdAt: now,
    updatedAt: now,
  }
  await db.wins.add(win)
  return win.id
}

export async function updateWin(id: string, patch: Partial<Win>) {
  await db.wins.update(id, { ...patch, updatedAt: nowIso() })
}

export async function deleteWin(id: string): Promise<Win | undefined> {
  const w = await db.wins.get(id)
  if (w) await db.wins.delete(id)
  return w
}

export async function restoreWin(w: Win) {
  await db.wins.put(w)
}

export function emptyDay(date: DayKey): DayEntry {
  const now = nowIso()
  return {
    date,
    createdAt: now,
    updatedAt: now,
    gratitude: ['', '', ''],
    note: '',
    bestMoment: '',
    lesson: '',
    tomorrowFocus: '',
  }
}

/** Сохранить часть записи дня (создаёт запись, если её нет) */
export async function saveDay(date: DayKey, patch: Partial<Omit<DayEntry, 'date'>>) {
  await db.transaction('rw', db.days, async () => {
    const cur = (await db.days.get(date)) ?? emptyDay(date)
    await db.days.put({ ...cur, ...patch, date, updatedAt: nowIso() })
  })
}

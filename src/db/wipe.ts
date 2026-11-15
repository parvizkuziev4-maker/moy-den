import { db } from './db'
import { setPinFlag } from '../lib/lock'

/** Стереть всё и начать с чистого листа (база создастся заново со сферами по умолчанию) */
export async function wipeAllData() {
  db.close()
  await db.delete()
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('moy-den')) localStorage.removeItem(k)
  } catch {
    /* приватный режим */
  }
  setPinFlag(false)
  location.hash = '#/'
  location.reload()
}

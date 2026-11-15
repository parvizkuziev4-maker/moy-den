import { DATA_TABLES, db as defaultDb, keyOf, type MoyDenDB } from './db'
import { buildBackup, emptyData, mergeRows, type Backup, type BackupData, type Row } from '../lib/backup'

const tables = (db: MoyDenDB) => DATA_TABLES.map((t) => db.table(t))

/** Прочитать все данные для резервной копии. */
export async function exportAll(db: MoyDenDB = defaultDb): Promise<Backup> {
  const data = emptyData()
  await db.transaction('r', tables(db), async () => {
    for (const t of DATA_TABLES) data[t] = (await db.table(t).toArray()) as Row[]
  })
  return buildBackup(data)
}

export type ImportMode = 'replace' | 'merge'

/** Записать данные из копии. Всё в одной транзакции: либо всё, либо ничего. */
export async function importAll(
  data: BackupData,
  mode: ImportMode,
  db: MoyDenDB = defaultDb,
): Promise<number> {
  let written = 0
  await db.transaction('rw', tables(db), async () => {
    for (const t of DATA_TABLES) {
      const table = db.table(t)
      const incoming = data[t]
      if (mode === 'replace') {
        await table.clear()
        await table.bulkPut(incoming)
        written += incoming.length
      } else {
        const key = keyOf(t)
        const existing = (await table.bulkGet(incoming.map((r) => r[key] as string))).filter(
          (r): r is Row => r !== undefined,
        )
        const toPut = mergeRows(existing, incoming, key)
        await table.bulkPut(toPut)
        written += toPut.length
      }
    }
  })
  return written
}

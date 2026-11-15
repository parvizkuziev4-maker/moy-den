import { DATA_TABLES, SCHEMA_VERSION, keyOf, type DataTable } from '../db/db'

// Чистые функции резервной копии (без базы) — их легко тестировать.

export type Row = Record<string, unknown>
export type BackupData = Record<DataTable, Row[]>

export interface Backup {
  app: 'moy-den'
  schemaVersion: number
  exportedAt: string
  data: BackupData
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string }

export function emptyData(): BackupData {
  return Object.fromEntries(DATA_TABLES.map((t) => [t, []])) as unknown as BackupData
}

export function buildBackup(data: BackupData, exportedAt = new Date()): Backup {
  return { app: 'moy-den', schemaVersion: SCHEMA_VERSION, exportedAt: exportedAt.toISOString(), data }
}

/** moy-den-backup-2026-11-15.json (по местной дате) */
export function backupFileName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `moy-den-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`
}

const isObj = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Разобрать и проверить файл копии. Сообщения об ошибках — для человека. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Файл повреждён или это не JSON.' }
  }
  if (!isObj(raw) || raw.app !== 'moy-den' || !isObj(raw.data)) {
    return { ok: false, error: 'Это не резервная копия «Мой День».' }
  }
  const version = raw.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'В копии нет версии данных.' }
  }
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      error: 'Копия сделана в более новой версии приложения. Сначала обнови приложение.',
    }
  }

  const data = emptyData()
  for (const table of DATA_TABLES) {
    const rows = raw.data[table]
    if (rows === undefined) continue
    if (!Array.isArray(rows)) return { ok: false, error: `Раздел «${table}» повреждён.` }
    const key = keyOf(table)
    for (const row of rows) {
      if (!isObj(row) || typeof row[key] !== 'string' || row[key] === '') {
        return { ok: false, error: `В разделе «${table}» есть запись без ${key}.` }
      }
    }
    data[table] = rows as Row[]
  }

  const backup: Backup = {
    app: 'moy-den',
    schemaVersion: version,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    data,
  }
  return { ok: true, backup: migrateBackup(backup) }
}

/**
 * Поднять старую копию до текущей версии схемы.
 * Когда появится SCHEMA_VERSION 2, сюда добавится шаг «if (b.schemaVersion < 2) { ... }».
 */
export function migrateBackup(b: Backup): Backup {
  return { ...b, schemaVersion: SCHEMA_VERSION }
}

export type Summary = Record<DataTable, number>

export function summarize(data: BackupData): Summary {
  return Object.fromEntries(DATA_TABLES.map((t) => [t, data[t].length])) as Summary
}

const stamp = (r: Row | undefined) => (r && typeof r.updatedAt === 'string' ? r.updatedAt : '')

/**
 * Объединение: какие записи из копии нужно записать в базу.
 * Новая запись — добавляем. Уже есть — заменяем, только если в копии она изменена позже.
 */
export function mergeRows(existing: Row[], incoming: Row[], key: 'id' | 'date'): Row[] {
  const byKey = new Map(existing.map((r) => [r[key] as string, r]))
  return incoming.filter((r) => {
    const cur = byKey.get(r[key] as string)
    return !cur || stamp(r) > stamp(cur)
  })
}

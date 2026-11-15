import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../db/db'
import { backupFileName, buildBackup, emptyData, mergeRows, parseBackup, summarize } from './backup'

describe('backupFileName', () => {
  it('использует местную дату с нулями', () => {
    expect(backupFileName(new Date(2026, 0, 5, 23, 59))).toBe('moy-den-backup-2026-01-05.json')
  })
})

describe('parseBackup', () => {
  const valid = () => {
    const data = emptyData()
    data.tasks = [{ id: 't1', title: 'Позвонить', updatedAt: '2026-11-01T10:00:00.000Z' }]
    data.days = [{ date: '2026-11-01', mood: 4 }]
    return buildBackup(data, new Date('2026-11-15T00:00:00Z'))
  }

  it('принимает правильную копию (туда и обратно)', () => {
    const r = parseBackup(JSON.stringify(valid()))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.backup.data.tasks).toHaveLength(1)
      expect(r.backup.data.days[0]).toEqual({ date: '2026-11-01', mood: 4 })
      expect(r.backup.schemaVersion).toBe(SCHEMA_VERSION)
    }
  })

  it('недостающие разделы становятся пустыми', () => {
    const r = parseBackup(JSON.stringify({ app: 'moy-den', schemaVersion: 1, data: { wins: [] } }))
    expect(r.ok && r.backup.data.people).toEqual([])
  })

  it('отклоняет мусор', () => {
    expect(parseBackup('не json').ok).toBe(false)
    expect(parseBackup('{"foo":1}').ok).toBe(false)
    expect(parseBackup('[]').ok).toBe(false)
  })

  it('отклоняет копию из более новой версии', () => {
    const b = { ...valid(), schemaVersion: SCHEMA_VERSION + 1 }
    const r = parseBackup(JSON.stringify(b))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/обнови/)
  })

  it('отклоняет записи без id и повреждённые разделы', () => {
    const b1 = valid()
    b1.data.people = [{ name: 'Без id' }]
    expect(parseBackup(JSON.stringify(b1)).ok).toBe(false)

    const b2 = valid() as unknown as { data: Record<string, unknown> }
    b2.data.tasks = 'сломано'
    expect(parseBackup(JSON.stringify(b2)).ok).toBe(false)

    const b3 = valid()
    b3.data.days = [{ id: 'x' }] // у дней ключ — date
    expect(parseBackup(JSON.stringify(b3)).ok).toBe(false)
  })
})

describe('summarize', () => {
  it('считает записи по разделам', () => {
    const d = emptyData()
    d.tasks = [{ id: 'a' }, { id: 'b' }]
    d.people = [{ id: 'p' }]
    const s = summarize(d)
    expect(s.tasks).toBe(2)
    expect(s.people).toBe(1)
    expect(s.habits).toBe(0)
  })
})

describe('mergeRows', () => {
  const old = '2026-11-01T00:00:00.000Z'
  const fresh = '2026-11-10T00:00:00.000Z'

  it('добавляет новые, заменяет только более свежие', () => {
    const existing = [
      { id: 'a', v: 'local', updatedAt: fresh },
      { id: 'b', v: 'local', updatedAt: old },
    ]
    const incoming = [
      { id: 'a', v: 'backup', updatedAt: old }, // в телефоне новее — не трогаем
      { id: 'b', v: 'backup', updatedAt: fresh }, // в копии новее — заменяем
      { id: 'c', v: 'backup', updatedAt: old }, // новой нет — добавляем
    ]
    expect(mergeRows(existing, incoming, 'id').map((r) => r.id)).toEqual(['b', 'c'])
  })

  it('одинаковое время — оставляем то, что в телефоне', () => {
    expect(mergeRows([{ id: 'a', updatedAt: old }], [{ id: 'a', updatedAt: old }], 'id')).toEqual([])
  })

  it('работает с ключом date для записей дня', () => {
    const r = mergeRows([{ date: '2026-11-01', updatedAt: old }], [{ date: '2026-11-01', updatedAt: fresh }], 'date')
    expect(r).toHaveLength(1)
  })
})

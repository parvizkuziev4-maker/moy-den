import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { Dexie } from 'dexie'
import { MoyDenDB, SCHEMA_VERSION } from './db'
import { exportAll, importAll } from './backupIO'
import { parseBackup } from '../lib/backup'
import type { Task } from './types'

let n = 0
const opened: MoyDenDB[] = []
function freshDb() {
  const d = new MoyDenDB(`test-${++n}`)
  opened.push(d)
  return d
}
afterEach(async () => {
  for (const d of opened.splice(0)) {
    d.close()
    await Dexie.delete(d.name)
  }
})

const task = (id: string, title: string, updatedAt: string): Task => ({
  id,
  title,
  notes: '',
  date: '2026-11-15',
  priority: 2,
  done: false,
  repeat: { kind: 'none' },
  subtasks: [],
  order: 0,
  createdAt: updatedAt,
  updatedAt,
})

describe('база данных', () => {
  it('при первом запуске создаёт 6 сфер и настройки', async () => {
    const d = freshDb()
    const areas = await d.areas.orderBy('order').toArray()
    expect(areas.map((a) => a.name)).toEqual(['Бизнес', 'Учёба', 'Семья', 'Здоровье', 'Клуб', 'Личное'])
    expect((await d.settings.get('main'))?.weekStartsOn).toBe(1)
  })

  it('данные сохраняются после закрытия и повторного открытия', async () => {
    const d = freshDb()
    await d.tasks.add(task('t1', 'Купить товар', '2026-11-15T08:00:00.000Z'))
    d.close()
    const again = new MoyDenDB(d.name)
    opened.push(again)
    expect((await again.tasks.get('t1'))?.title).toBe('Купить товар')
    expect(await again.areas.count()).toBe(6) // populate не сработал второй раз
    expect(again.verno).toBe(SCHEMA_VERSION)
  })

  it('не даёт две отметки одной привычки в один день', async () => {
    const d = freshDb()
    const log = { habitId: 'h', date: '2026-11-15', value: 1, note: '', createdAt: '', updatedAt: '' }
    await d.habitLogs.add({ ...log, id: 'l1' })
    await expect(d.habitLogs.add({ ...log, id: 'l2' })).rejects.toThrow()
  })
})

describe('резервная копия', () => {
  it('экспорт → JSON → импорт «заменить» восстанавливает всё', async () => {
    const src = freshDb()
    await src.tasks.add(task('t1', 'Задача', '2026-11-15T08:00:00.000Z'))
    await src.days.put({
      date: '2026-11-15',
      createdAt: '',
      updatedAt: '',
      mood: 5,
      gratitude: ['семья', 'здоровье', 'работа'],
      note: '',
      bestMoment: '',
      lesson: '',
      tomorrowFocus: '',
    })
    const json = JSON.stringify(await exportAll(src))

    const parsed = parseBackup(json)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const dst = freshDb()
    await dst.tasks.add(task('junk', 'Лишнее', '2026-11-15T08:00:00.000Z'))
    await importAll(parsed.backup.data, 'replace', dst)

    expect(await dst.tasks.toArray()).toEqual(await src.tasks.toArray())
    expect((await dst.days.get('2026-11-15'))?.gratitude).toHaveLength(3)
    expect(await dst.areas.count()).toBe(6)
  })

  it('импорт «объединить» не затирает более свежие записи', async () => {
    const dst = freshDb()
    await dst.tasks.bulkAdd([
      task('a', 'Новее в телефоне', '2026-11-10T00:00:00.000Z'),
      task('b', 'Старее в телефоне', '2026-11-01T00:00:00.000Z'),
    ])
    const src = freshDb()
    await src.tasks.bulkAdd([
      task('a', 'Старая из копии', '2026-11-01T00:00:00.000Z'),
      task('b', 'Свежая из копии', '2026-11-10T00:00:00.000Z'),
      task('c', 'Только в копии', '2026-11-01T00:00:00.000Z'),
    ])
    const backup = await exportAll(src)
    backup.data.areas = [] // сферы не трогаем в этом тесте
    backup.data.settings = []

    await importAll(backup.data, 'merge', dst)
    const byId = Object.fromEntries((await dst.tasks.toArray()).map((t) => [t.id, t.title]))
    expect(byId).toEqual({
      a: 'Новее в телефоне',
      b: 'Свежая из копии',
      c: 'Только в копии',
    })
  })
})

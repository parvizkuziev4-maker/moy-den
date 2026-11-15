import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { ALL_HABITS_REF, addHabit, deleteHabit, restoreHabit, setHabitNote, setHabitValue } from './habits'

const D = '2026-11-15'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('отметки привычек', () => {
  it('отметка «да/нет» даёт победу, снятие — убирает', async () => {
    const id = await addHabit({ name: 'Спорт', emoji: '🏃', startDate: D })
    const r = await setHabitValue(id, D, 1)
    expect(r.becameDone).toBe(true)
    const wins = await db.wins.where('refId').equals(id).toArray()
    expect(wins.map((w) => w.text)).toEqual(['🏃 Спорт'])

    await setHabitValue(id, D, 0)
    expect(await db.wins.where('refId').equals(id).count()).toBe(0)
    expect(await db.habitLogs.count()).toBe(0)
  })

  it('счётчик: победа только при достижении цели, текст обновляется', async () => {
    const id = await addHabit({ name: 'Вода', emoji: '💧', type: 'count', target: 3, unit: 'стаканов', startDate: D })
    await setHabitValue(id, D, 1)
    await setHabitValue(id, D, 2)
    expect(await db.wins.where('refId').equals(id).count()).toBe(0)
    await setHabitValue(id, D, 3)
    await setHabitValue(id, D, 4)
    const wins = await db.wins.where('refId').equals(id).toArray()
    expect(wins).toHaveLength(1)
    expect(wins[0]!.text).toBe('💧 Вода: 4 стаканов')
    expect((await db.habitLogs.toArray())[0]!.value).toBe(4)
  })

  it('«все привычки дня выполнены» — победа появляется и исчезает', async () => {
    const a = await addHabit({ name: 'А', startDate: D })
    const b = await addHabit({ name: 'Б', startDate: D })
    expect((await setHabitValue(a, D, 1)).allDoneNow).toBe(false)
    expect((await setHabitValue(b, D, 1)).allDoneNow).toBe(true)
    expect(await db.wins.where('refId').equals(ALL_HABITS_REF).count()).toBe(1)
    // повторная отметка не дублирует
    await setHabitValue(b, D, 1)
    expect(await db.wins.where('refId').equals(ALL_HABITS_REF).count()).toBe(1)
    await setHabitValue(a, D, 0)
    expect(await db.wins.where('refId').equals(ALL_HABITS_REF).count()).toBe(0)
  })

  it('заметка к дню хранится и без отметки', async () => {
    const id = await addHabit({ name: 'Чтение', startDate: D })
    await setHabitNote(id, D, 'Прочитал 30 страниц')
    await setHabitValue(id, D, 1)
    await setHabitValue(id, D, 0)
    const log = await db.habitLogs.where('[habitId+date]').equals([id, D]).first()
    expect(log).toMatchObject({ value: 0, note: 'Прочитал 30 страниц' })
  })

  it('удаление и «Отменить» возвращают отметки и победы', async () => {
    const id = await addHabit({ name: 'Прогулка', startDate: D })
    await setHabitValue(id, D, 1)
    await setHabitValue(id, '2026-11-14', 1)
    const snap = await deleteHabit(id)
    expect(await db.habitLogs.count()).toBe(0)
    await restoreHabit(snap!)
    expect(await db.habitLogs.count()).toBe(2)
    expect(await db.wins.where('refId').equals(id).count()).toBe(2)
  })

  it('порядок: новые в конце', async () => {
    await addHabit({ name: '1' })
    await addHabit({ name: '2' })
    const list = await db.habits.orderBy('order').toArray()
    expect(list.map((h) => h.name)).toEqual(['1', '2'])
  })
})

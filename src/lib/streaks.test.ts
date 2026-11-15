import { describe, expect, it } from 'vitest'
import { allDoneOn, completionRate, isDue, streaks, weekStartKey, type HabitLike, type LogMap } from './streaks'
import { addDaysKey } from './dates'

// 2026-11-15 — воскресенье. 2026-11-09 — понедельник.
const daily: HabitLike = { type: 'check', target: 1, schedule: { kind: 'daily' }, startDate: '2026-01-01' }
const soft1 = { enabled: true, restPerWeek: 1, weekStartsOn: 1 as const }

/** Отметки за дни подряд, заканчивая last (включительно) */
function run(last: string, n: number, value = 1): LogMap {
  const m: LogMap = new Map()
  for (let i = 0; i < n; i++) m.set(addDaysKey(last, -i), value)
  return m
}

describe('weekStartKey', () => {
  it('неделя с понедельника и с воскресенья', () => {
    expect(weekStartKey('2026-11-15', 1)).toBe('2026-11-09')
    expect(weekStartKey('2026-11-09', 1)).toBe('2026-11-09')
    expect(weekStartKey('2026-11-15', 0)).toBe('2026-11-15')
    expect(weekStartKey('2026-11-14', 0)).toBe('2026-11-08')
  })
})

describe('streaks — каждый день', () => {
  it('5 дней подряд включая сегодня', () => {
    expect(streaks(daily, run('2026-11-15', 5), '2026-11-15')).toEqual({ current: 5, best: 5, unit: 'days' })
  })

  it('сегодня ещё не отмечено — серия не сгорает', () => {
    expect(streaks(daily, run('2026-11-14', 4), '2026-11-15').current).toBe(4)
  })

  it('пропуск вчера — серия сгорает (мягкий режим выключен), лучшая сохраняется', () => {
    const logs = run('2026-11-13', 10)
    const s = streaks(daily, logs, '2026-11-15')
    expect(s.current).toBe(0)
    expect(s.best).toBe(10)
  })

  it('через смену месяца и года', () => {
    const s = streaks(daily, run('2027-01-02', 40), '2027-01-02')
    expect(s.current).toBe(40)
  })

  it('пустая история', () => {
    expect(streaks(daily, new Map(), '2026-11-15')).toEqual({ current: 0, best: 0, unit: 'days' })
  })
})

describe('streaks — мягкий режим', () => {
  it('один пропуск в неделю прощается', () => {
    const logs = run('2026-11-15', 3) // пт-сб-вс
    for (const [d, v] of run('2026-11-11', 3)) logs.set(d, v) // пн-вт-ср, пропуск в чт 12-го
    expect(streaks(daily, logs, '2026-11-15', soft1).current).toBe(6)
    expect(streaks(daily, logs, '2026-11-15').current).toBe(3) // без мягкого режима
  })

  it('два пропуска в одну неделю — серия сгорает', () => {
    const logs = run('2026-11-15', 2) // сб-вс
    logs.set('2026-11-11', 1)
    logs.set('2026-11-10', 1) // пропуски чт 12 и пт 13
    expect(streaks(daily, logs, '2026-11-15', soft1).current).toBe(2)
  })

  it('по одному пропуску в разные недели — серия живёт', () => {
    const logs = run('2026-11-15', 15)
    logs.delete('2026-11-12') // эта неделя
    logs.delete('2026-11-05') // прошлая неделя
    expect(streaks(daily, logs, '2026-11-15', soft1).current).toBe(13)
  })

  it('пропуск до начала серии ничего не даёт', () => {
    const logs: LogMap = new Map([['2026-11-15', 1]])
    expect(streaks(daily, logs, '2026-11-15', soft1).current).toBe(1)
  })
})

describe('streaks — выбранные дни недели', () => {
  const mwf: HabitLike = { ...daily, schedule: { kind: 'days', days: [1, 3, 5] } }
  it('дни не по расписанию не ломают серию', () => {
    // пн 2, ср 4, пт 6, пн 9, ср 11, пт 13 ноября
    const logs: LogMap = new Map(
      ['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09', '2026-11-11', '2026-11-13'].map((d) => [d, 1]),
    )
    expect(streaks(mwf, logs, '2026-11-15').current).toBe(6)
  })
  it('пропуск дня по расписанию ломает', () => {
    const logs: LogMap = new Map(['2026-11-09', '2026-11-13'].map((d) => [d, 1]))
    expect(streaks(mwf, logs, '2026-11-15').current).toBe(1)
  })
})

describe('streaks — счётчик с целью', () => {
  const water: HabitLike = { type: 'count', target: 8, schedule: { kind: 'daily' }, startDate: '2026-11-01' }
  it('засчитывается только при достижении цели', () => {
    const logs = run('2026-11-15', 3, 8)
    logs.set('2026-11-12', 5) // не добрал
    expect(streaks(water, logs, '2026-11-15').current).toBe(3)
  })
})

describe('streaks — N раз в неделю', () => {
  const gym: HabitLike = { ...daily, schedule: { kind: 'timesPerWeek', times: 3 } }
  it('считает недели; текущая неделя в процессе не ломает', () => {
    const logs: LogMap = new Map(
      // неделя 26.10: 3 раза, неделя 2.11: 3 раза, неделя 9.11: пока 1
      ['2026-10-26', '2026-10-28', '2026-10-30', '2026-11-02', '2026-11-03', '2026-11-07', '2026-11-10'].map(
        (d) => [d, 1],
      ),
    )
    expect(streaks(gym, logs, '2026-11-15')).toEqual({ current: 2, best: 2, unit: 'weeks' })
  })
  it('isDue: пока норма не набрана', () => {
    const logs: LogMap = new Map(['2026-11-09', '2026-11-10', '2026-11-11'].map((d) => [d, 1]))
    expect(isDue(gym, logs, '2026-11-12', 1)).toBe(false)
    expect(isDue(gym, logs, '2026-11-11', 1)).toBe(true) // отмечена в этот день
    expect(isDue(gym, new Map(), '2026-11-12', 1)).toBe(true)
  })
})

describe('completionRate', () => {
  it('за 7 дней: 5 из 7 (сегодня не отмечено — не считаем)', () => {
    const logs = run('2026-11-14', 5)
    // окно 9–15, сегодня (15) не считается → 6 дней, сделано 5
    expect(completionRate(daily, logs, '2026-11-15', 7)).toBeCloseTo(5 / 6)
  })
  it('новая привычка считается с даты начала', () => {
    const h = { ...daily, startDate: '2026-11-14' }
    expect(completionRate(h, run('2026-11-15', 2), '2026-11-15', 30)).toBe(1)
  })
  it('нечего считать — null', () => {
    expect(completionRate({ ...daily, startDate: '2026-11-15' }, new Map(), '2026-11-15', 7)).toBeNull()
  })
})

describe('allDoneOn', () => {
  it('учитывает только нужные в этот день', () => {
    const a = { ...daily, id: 'a' }
    const b = { ...daily, id: 'b', schedule: { kind: 'days' as const, days: [1] } } // только пн
    const logs = new Map([['a', new Map([['2026-11-15', 1]])]])
    expect(allDoneOn([a, b], logs, '2026-11-15', 1)).toEqual({ due: 1, done: 1, all: true })
    expect(allDoneOn([a, b], logs, '2026-11-16', 1).all).toBe(false)
    expect(allDoneOn([], logs, '2026-11-15', 1).all).toBe(false)
  })
})

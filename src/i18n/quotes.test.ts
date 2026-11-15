import { describe, expect, it } from 'vitest'
import { QUOTES_RU, quoteOfDay } from './quotes'

describe('фраза дня', () => {
  it('фраз не меньше 60, все разные и короткие', () => {
    expect(QUOTES_RU.length).toBeGreaterThanOrEqual(60)
    expect(new Set(QUOTES_RU).size).toBe(QUOTES_RU.length)
    for (const q of QUOTES_RU) expect(q.length).toBeLessThan(90)
  })
  it('весь день одна и та же, в разные дни — меняется', () => {
    expect(quoteOfDay('2026-11-15')).toBe(quoteOfDay('2026-11-15'))
    const week = new Set(Array.from({ length: 14 }, (_, i) => quoteOfDay(`2026-11-${String(i + 1).padStart(2, '0')}`)))
    expect(week.size).toBeGreaterThan(5)
  })
})

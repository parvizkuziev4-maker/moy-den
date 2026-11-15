import { describe, expect, it } from 'vitest'
import { checkPin, hashPin, isValidPin, lockoutSeconds } from './pin'

describe('PIN', () => {
  it('хэш стабильный, 64 символа, сам PIN не хранится', async () => {
    const h = await hashPin('1234')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(h).toBe(await hashPin('1234'))
    expect(h).not.toContain('1234')
    expect(await hashPin('1235')).not.toBe(h)
  })
  it('проверка', async () => {
    const h = await hashPin('0007')
    expect(await checkPin('0007', h)).toBe(true)
    expect(await checkPin('7000', h)).toBe(false)
    expect(await checkPin('любой', undefined)).toBe(true)
  })
  it('только 4 цифры', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('123')).toBe(false)
    expect(isValidPin('12a4')).toBe(false)
  })
  it('пауза после ошибок', () => {
    expect(lockoutSeconds(4)).toBe(0)
    expect(lockoutSeconds(5)).toBe(30)
    expect(lockoutSeconds(10)).toBe(60)
    expect(lockoutSeconds(100)).toBe(300)
  })
})

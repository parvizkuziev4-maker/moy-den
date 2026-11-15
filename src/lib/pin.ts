// PIN-код: храним только SHA-256 хэш (Web Crypto). Это защита от чужих глаз, а не шифрование данных.

export const PIN_LENGTH = 4

export const pinSupported = () => typeof crypto !== 'undefined' && !!crypto.subtle

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`moy-den:${pin}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function checkPin(pin: string, hash: string | undefined): Promise<boolean> {
  if (!hash) return true
  return (await hashPin(pin)) === hash
}

export const isValidPin = (pin: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)

/** Пауза после неудачных попыток: 5 ошибок — 30 секунд, дальше дольше */
export function lockoutSeconds(failures: number): number {
  if (failures < 5) return 0
  return Math.min(300, 30 * 2 ** Math.floor((failures - 5) / 5))
}

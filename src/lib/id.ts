/** Уникальный id. crypto.randomUUID нет по http в локальной сети — тогда собираем UUID v4 сами. */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {
      /* не безопасный контекст */
    }
  }
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export const nowIso = () => new Date().toISOString()

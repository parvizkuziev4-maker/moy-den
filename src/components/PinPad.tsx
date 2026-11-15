import { useEffect, useState } from 'react'
import { Delete } from 'lucide-react'
import { PIN_LENGTH } from '../lib/pin'
import { t } from '../i18n/ru'

/** Клавиатура для PIN-кода: 4 точки и цифры 0–9 */
export function PinPad({
  title,
  error,
  disabled,
  onComplete,
}: {
  title: string
  error?: string
  disabled?: boolean
  /** Вернуть false — точки очистятся и экран «тряхнёт» */
  onComplete: (pin: string) => Promise<boolean | void> | boolean | void
}) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(0)

  async function press(d: string) {
    if (disabled || pin.length >= PIN_LENGTH) return
    const next = pin + d
    setPin(next)
    if (next.length === PIN_LENGTH) {
      const ok = await onComplete(next)
      setPin('')
      if (ok === false) setShake((n) => n + 1)
    }
  }

  // Ввод с клавиатуры (на Mac удобно)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) void press(e.key)
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="flex flex-col items-center">
      <p className="mb-5 text-[18px] font-semibold">{title}</p>
      <div key={shake} className={`mb-3 flex gap-4 ${shake ? 'animate-shake' : ''}`} aria-label={`${pin.length} из ${PIN_LENGTH}`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={`size-4 rounded-full border-2 border-accent transition ${i < pin.length ? 'bg-accent' : ''}`}
          />
        ))}
      </div>
      <p className="mb-5 min-h-6 text-center text-[15px] text-danger" role="alert">
        {error}
      </p>
      <div className="grid grid-cols-3 gap-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k) =>
          k === '' ? (
            <span key="empty" />
          ) : k === 'del' ? (
            <button
              key="del"
              type="button"
              aria-label={t.pin.del}
              onClick={() => setPin((p) => p.slice(0, -1))}
              className="flex size-[76px] items-center justify-center rounded-full text-muted active:bg-surface-2"
            >
              <Delete size={26} />
            </button>
          ) : (
            <button
              key={k}
              type="button"
              disabled={disabled}
              onClick={() => void press(k)}
              className="flex size-[76px] items-center justify-center rounded-full bg-surface text-[30px] font-medium shadow-soft active:bg-surface-2 disabled:opacity-40"
            >
              {k}
            </button>
          ),
        )}
      </div>
    </div>
  )
}

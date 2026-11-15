import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { checkPin, lockoutSeconds } from '../lib/pin'
import { markUnlockedOnce, unlock, useLocked } from '../lib/lock'
import { usePrefs } from '../lib/prefs'
import { PinPad } from './PinPad'
import { Sheet } from './Sheet'
import { wipeAllData } from '../db/wipe'
import { t } from '../i18n/ru'

/** Экран блокировки поверх всего приложения */
export function LockScreen() {
  const locked = useLocked()
  const { pinHash } = usePrefs()
  const [failures, setFailures] = useState(0)
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [forgot, setForgot] = useState(false)
  const [confirmWipe, setConfirmWipe] = useState(false)

  useEffect(() => {
    if (until <= Date.now()) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [until])

  if (!locked) return null
  const wait = Math.max(0, Math.ceil((until - now) / 1000))

  async function onComplete(pin: string) {
    // Хэш ещё не загрузился из базы — ждём
    if (!pinHash) return false
    if (await checkPin(pin, pinHash)) {
      setFailures(0)
      markUnlockedOnce()
      unlock()
      return true
    }
    const f = failures + 1
    setFailures(f)
    const s = lockoutSeconds(f)
    if (s) {
      setUntil(Date.now() + s * 1000)
      setNow(Date.now())
    }
    return false
  }

  return createPortal(
    <div className="pt-safe pb-safe fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg px-6">
      <img src="icon.svg" alt="" className="mb-4 size-16 rounded-2xl" />
      <PinPad
        title={t.pin.enter}
        disabled={wait > 0}
        error={wait > 0 ? t.pin.wait(wait) : failures > 0 ? t.pin.wrong : undefined}
        onComplete={onComplete}
      />
      <button type="button" onClick={() => setForgot(true)} className="mt-6 min-h-11 px-3 text-[15px] text-muted">
        {t.pin.forgot}
      </button>
      <Sheet open={forgot} onClose={() => setForgot(false)} title={t.pin.forgot}>
        <p className="mb-4 text-[15px] leading-relaxed">{t.pin.forgotText}</p>
        <button
          type="button"
          onClick={() => (confirmWipe ? void wipeAllData() : setConfirmWipe(true))}
          className={`mb-4 min-h-12 w-full rounded-2xl font-semibold ${confirmWipe ? 'bg-danger-solid text-white' : 'bg-surface-2 text-danger'}`}
        >
          {confirmWipe ? t.danger.wipeConfirm : t.pin.forgotAction}
        </button>
      </Sheet>
    </div>,
    document.body,
  )
}

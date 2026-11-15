import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { t } from '../i18n/ru'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/** Нижняя «шторка», как в iOS. */
export function Sheet({ open, onClose, title, children }: Props) {
  const keyboard = useKeyboardInset(open)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  // Портал в <body>, чтобы шторка была поверх нижних вкладок.
  return createPortal(
    <div
      className="fixed inset-x-0 top-0 z-50 flex items-end justify-center"
      style={{ bottom: keyboard }}
      role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label={t.common.close}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />
      <div className="sheet-in pb-safe relative max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-bg shadow-soft">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line" aria-hidden />
        <header className="flex items-center gap-2 px-5 pt-2 pb-1">
          <h2 className="flex-1 text-[20px] font-bold">{title}</h2>
          <button
            type="button"
            aria-label={t.common.close}
            onClick={onClose}
            className="-mr-2 flex size-11 items-center justify-center rounded-full text-muted"
          >
            <X size={22} />
          </button>
        </header>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/** Высота клавиатуры iPhone: поднимаем шторку над ней. */
function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!active || !vv) return
    const update = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      setInset(0)
    }
  }, [active])
  return inset
}

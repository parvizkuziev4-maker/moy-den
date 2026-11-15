import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
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
  const panel = useRef<HTMLDivElement>(null)
  useSwipeToClose(panel, open, onClose)
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
      <div
        ref={panel}
        className="sheet-in pb-safe relative max-h-[90dvh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl bg-bg shadow-soft"
      >
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

/**
 * Закрытие свайпом вниз, как в iOS. Тянуть можно за любое место шторки,
 * если её содержимое прокручено в самый верх. Потянул далеко или быстро — закрылась,
 * чуть-чуть — вернулась на место.
 */
function useSwipeToClose(panel: RefObject<HTMLDivElement | null>, open: boolean, onClose: () => void) {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])

  useEffect(() => {
    const el = panel.current
    if (!open || !el) return
    let startX = 0
    let startY = 0
    let startT = 0
    let dy = 0
    let state: 'idle' | 'maybe' | 'drag' | 'scroll' = 'idle'

    const setY = (y: number, animate: boolean) => {
      el.style.transition = animate ? 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)' : 'none'
      el.style.transform = y ? `translateY(${y}px)` : ''
    }

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      startX = e.touches[0]!.clientX
      startY = e.touches[0]!.clientY
      startT = Date.now()
      dy = 0
      state = el.scrollTop <= 0 ? 'maybe' : 'scroll'
    }
    const onMove = (e: TouchEvent) => {
      if (state === 'idle' || state === 'scroll') return
      const mx = e.touches[0]!.clientX - startX
      const my = e.touches[0]!.clientY - startY
      if (state === 'maybe') {
        if (Math.abs(my) < 6 && Math.abs(mx) < 6) return
        // вниз и больше по вертикали — тянем шторку; иначе это обычная прокрутка
        state = my > 0 && Math.abs(my) > Math.abs(mx) && el.scrollTop <= 0 ? 'drag' : 'scroll'
        if (state === 'scroll') return
      }
      e.preventDefault()
      dy = Math.max(0, my)
      setY(dy, false)
    }
    const onEnd = () => {
      if (state === 'drag') {
        const speed = dy / Math.max(1, Date.now() - startT) // px/мс
        if (dy > 110 || (dy > 40 && speed > 0.5)) {
          ;(document.activeElement as HTMLElement | null)?.blur?.()
          setY(el.offsetHeight + 40, true)
          setTimeout(() => close.current(), 200)
        } else {
          setY(0, true)
        }
      }
      state = 'idle'
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [panel, open])
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

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
  const backdrop = useRef<HTMLButtonElement>(null)
  useSwipeToClose(panel, backdrop, open, onClose)
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
        ref={backdrop}
        type="button"
        aria-label={t.common.close}
        onClick={onClose}
        className="sheet-backdrop absolute inset-0 bg-black/45"
      />
      <div
        ref={panel}
        className="sheet-in pb-safe relative max-h-[90dvh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl bg-bg shadow-soft"
        style={{ willChange: 'transform' }}
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
function useSwipeToClose(
  panel: RefObject<HTMLDivElement | null>,
  backdrop: RefObject<HTMLButtonElement | null>,
  open: boolean,
  onClose: () => void,
) {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])

  useEffect(() => {
    const el = panel.current
    const bg = backdrop.current
    if (!open || !el) return
    let startX = 0
    let startY = 0
    let dy = 0
    let frame = 0
    // последние точки касания — для скорости «смахивания»
    let samples: { y: number; t: number }[] = []
    let state: 'idle' | 'maybe' | 'drag' | 'scroll' = 'idle'

    const ease = 'cubic-bezier(0.2, 0.9, 0.3, 1)'
    const paint = (y: number, animate: boolean, ms = 260) => {
      el.style.transition = animate ? `transform ${ms}ms ${ease}` : 'none'
      el.style.transform = y > 0 ? `translate3d(0, ${y}px, 0)` : ''
      if (bg) {
        bg.style.transition = animate ? `opacity ${ms}ms ${ease}` : 'none'
        bg.style.opacity = String(Math.max(0, 1 - y / Math.max(1, el.offsetHeight)))
      }
    }

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      // анимация появления не должна мешать: сразу завершаем её
      el.getAnimations().forEach((a) => a.finish())
      startX = e.touches[0]!.clientX
      startY = e.touches[0]!.clientY
      dy = 0
      samples = [{ y: startY, t: e.timeStamp }]
      state = el.scrollTop <= 0 ? 'maybe' : 'scroll'
    }

    const onMove = (e: TouchEvent) => {
      if (state === 'idle' || state === 'scroll') return
      const y = e.touches[0]!.clientY
      const mx = e.touches[0]!.clientX - startX
      const my = y - startY
      if (state === 'maybe') {
        // тянут вверх или вбок — это обычная прокрутка содержимого
        if (my < 0 || Math.abs(mx) > Math.abs(my) + 2) {
          state = 'scroll'
          return
        }
        // тянут вниз от самого верха: сразу забираем жест, чтобы iPhone не начал «пружинить»
        e.preventDefault()
        if (my < 4) return
        state = 'drag'
        startY = y // без рывка в первый кадр
      }
      e.preventDefault()
      dy = Math.max(0, y - startY)
      samples.push({ y, t: e.timeStamp })
      if (samples.length > 6) samples.shift()
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => paint(dy, false))
    }

    const onEnd = () => {
      cancelAnimationFrame(frame)
      if (state === 'drag') {
        const first = samples[0]!
        const last = samples[samples.length - 1]!
        const speed = (last.y - first.y) / Math.max(1, last.t - first.t) // пикселей в мс, по последним касаниям
        const h = el.offsetHeight
        if (dy > Math.min(140, h * 0.3) || (speed > 0.45 && dy > 20)) {
          ;(document.activeElement as HTMLElement | null)?.blur?.()
          // чем быстрее смахнули, тем быстрее уезжает
          const ms = Math.max(140, Math.min(280, ((h - dy) / Math.max(speed, 1)) * 1.2))
          paint(h + 40, true, ms)
          setTimeout(() => close.current(), ms)
        } else {
          paint(0, true)
        }
      }
      state = 'idle'
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [panel, backdrop, open])
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

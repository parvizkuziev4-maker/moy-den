import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import type { DayKey } from '../../db/types'

interface DragState {
  id: string
  title: string
  x: number
  y: number
  over: DayKey | null
}

/**
 * Перетаскивание задачи на другой день. Работает пальцем и мышью:
 * тянем за ручку, день под пальцем подсвечивается (элементы с data-day), отпускаем — переносим.
 */
export function useDragToDay(onDrop: (id: string, day: DayKey) => void) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const pointerY = useRef(0)

  // Автопрокрутка, когда палец у края экрана
  useEffect(() => {
    if (!drag) return
    let raf = 0
    const tick = () => {
      const y = pointerY.current
      const edge = 110
      if (y < edge) window.scrollBy(0, -Math.ceil((edge - y) / 8))
      else if (y > window.innerHeight - edge - 60) window.scrollBy(0, Math.ceil((y - (window.innerHeight - edge - 60)) / 8))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [drag !== null]) // eslint-disable-line react-hooks/exhaustive-deps

  function dayAt(x: number, y: number): DayKey | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-day]')
    return el?.dataset.day ?? null
  }

  function handleProps(id: string, title: string) {
    return {
      style: { touchAction: 'none' } as const,
      onPointerDown(e: PointerEvent) {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        pointerY.current = e.clientY
        setDrag({ id, title, x: e.clientX, y: e.clientY, over: dayAt(e.clientX, e.clientY) })
      },
      onPointerMove(e: PointerEvent) {
        if (!drag || drag.id !== id) return
        e.stopPropagation()
        pointerY.current = e.clientY
        setDrag({ ...drag, x: e.clientX, y: e.clientY, over: dayAt(e.clientX, e.clientY) })
      },
      onPointerUp(e: PointerEvent) {
        if (!drag || drag.id !== id) return
        e.stopPropagation()
        const day = dayAt(e.clientX, e.clientY)
        setDrag(null)
        if (day) onDrop(id, day)
      },
      onPointerCancel() {
        setDrag(null)
      },
    }
  }

  const ghost =
    drag &&
    createPortal(
      <div
        className="pointer-events-none fixed z-[70] max-w-[70vw] -translate-x-1/2 -translate-y-1/2 truncate rounded-2xl bg-accent px-4 py-3 font-semibold text-on-accent shadow-soft"
        style={{ left: drag.x, top: drag.y }}
        aria-hidden
      >
        {drag.title}
      </div>,
      document.body,
    )

  return { drag, handleProps, ghost }
}

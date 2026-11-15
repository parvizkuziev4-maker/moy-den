import { useState, type PointerEvent } from 'react'

/**
 * Сортировка списка перетаскиванием (палец или мышь).
 * У элементов списка должен быть атрибут data-reorder-id.
 */
export function useReorder(ids: string[], commit: (ids: string[]) => void) {
  const [order, setOrder] = useState<string[] | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)

  function handleProps(id: string) {
    return {
      style: { touchAction: 'none' } as const,
      onPointerDown(e: PointerEvent) {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        setDragId(id)
        setOrder(ids)
      },
      onPointerMove(e: PointerEvent) {
        if (dragId !== id || !order) return
        const over = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>('[data-reorder-id]')?.dataset.reorderId
        if (!over || over === id) return
        const next = order.filter((x) => x !== id)
        next.splice(order.indexOf(over), 0, id)
        setOrder(next)
      },
      onPointerUp() {
        if (order && dragId) commit(order)
        setOrder(null)
        setDragId(null)
      },
      onPointerCancel() {
        setOrder(null)
        setDragId(null)
      },
    }
  }

  return { ids: order ?? ids, dragId, handleProps }
}

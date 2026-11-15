import { createPortal } from 'react-dom'
import { Plus } from 'lucide-react'

/** Большая круглая кнопка «+» над нижними вкладками. */
export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return createPortal(
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="fixed right-[max(16px,env(safe-area-inset-right))] bottom-[var(--above-tabbar)] z-20 flex size-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_8px_24px_-4px_var(--accent)] transition-transform active:scale-90"
    >
      <Plus size={30} strokeWidth={2.4} />
    </button>,
    document.body,
  )
}

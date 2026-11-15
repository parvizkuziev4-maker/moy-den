import { dismissToast, useToast } from '../lib/toast'

export function ToastHost() {
  const toast = useToast()
  if (!toast) return null
  return (
    <div
      key={toast.id}
      role="status"
      aria-live="polite"
      className="animate-fade-up fixed right-[84px] left-4 bottom-[var(--above-tabbar)] z-[45] mx-auto flex max-w-md items-center gap-2 rounded-2xl bg-ink py-1.5 pr-1.5 pl-4 text-bg shadow-soft"
    >
      <span className="min-h-10 flex-1 py-2 text-[15px]">{toast.text}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.run()
            dismissToast()
          }}
          className="min-h-11 rounded-xl px-3 font-bold text-bg underline underline-offset-4"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}

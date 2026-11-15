import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'
import { t } from '../i18n/ru'

/** Тост «Есть новая версия — обновить». */
export function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Проверяем обновления раз в час, пока приложение открыто.
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000)
    },
  })

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="animate-fade-up fixed inset-x-4 bottom-[var(--above-tabbar)] z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-bg shadow-soft"
    >
      <span className="flex-1 text-[15px]">{t.update.available}</span>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="flex min-h-11 items-center gap-1.5 rounded-xl bg-accent px-3 font-semibold text-on-accent"
      >
        <RefreshCw size={16} /> {t.update.action}
      </button>
      <button
        type="button"
        aria-label={t.common.close}
        onClick={() => setNeedRefresh(false)}
        className="flex size-11 items-center justify-center rounded-xl opacity-70"
      >
        <X size={18} />
      </button>
    </div>
  )
}

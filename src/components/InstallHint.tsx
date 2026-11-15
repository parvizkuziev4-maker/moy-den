import { Link } from 'react-router-dom'
import { Share, X } from 'lucide-react'
import { t } from '../i18n/ru'
import { isStandalone } from '../lib/standalone'
import { setPrefs, usePrefs } from '../lib/prefs'

/** Мягкая подсказка, если приложение открыто не с экрана «Домой». */
export function InstallHint() {
  const { installHintDismissed } = usePrefs()
  if (installHintDismissed || isStandalone()) return null

  return (
    <div className="mb-4 flex items-start gap-3 rounded-3xl border border-accent/30 bg-accent-soft p-4">
      <Share size={22} className="mt-0.5 shrink-0 text-accent" aria-hidden />
      <div className="flex-1 text-[15px] leading-snug">
        <p>{t.install.hint}</p>
        <Link to="/install" className="mt-1.5 inline-block font-semibold text-accent">
          {t.install.hintAction} →
        </Link>
      </div>
      <button
        type="button"
        aria-label={t.common.close}
        onClick={() => setPrefs({ installHintDismissed: true })}
        className="-mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted"
      >
        <X size={18} />
      </button>
    </div>
  )
}

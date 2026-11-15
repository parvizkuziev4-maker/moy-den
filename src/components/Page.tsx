import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { t } from '../i18n/ru'

interface Props {
  title: ReactNode
  subtitle?: ReactNode
  /** Кнопки справа в шапке */
  actions?: ReactNode
  /** Показать кнопку «Назад» */
  back?: boolean
  children: ReactNode
}

export function Page({ title, subtitle, actions, back, children }: Props) {
  const navigate = useNavigate()
  return (
    <div className="pt-safe px-page mx-auto max-w-xl pb-40">
      <header className="flex items-start gap-2 pt-3 pb-4">
        {back && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t.common.back}
            className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-full text-accent active:bg-surface-2"
          >
            <ChevronLeft size={28} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[15px] text-muted first-letter:uppercase">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </header>
      <main className="animate-fade-up">{children}</main>
    </div>
  )
}

export function Card({ children, className = 'p-4' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-surface shadow-soft ${className}`}>{children}</section>
}

export function EmptyState({ emoji, text }: { emoji: string; text: string }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="text-5xl" aria-hidden>
        {emoji}
      </span>
      <p className="max-w-xs text-[15px] leading-relaxed text-muted">{text}</p>
    </Card>
  )
}

import { Compass, PlusSquare, Share, Smartphone, type LucideIcon } from 'lucide-react'
import { Page, Card } from '../../components/Page'
import { t } from '../../i18n/ru'

const STEP_ICONS: LucideIcon[] = [Compass, Share, PlusSquare, Smartphone]

export function InstallPage() {
  return (
    <Page title={t.install.title} back>
      <p className="mb-4 px-1 text-[15px] leading-relaxed text-muted">{t.install.intro}</p>
      <ol className="space-y-3">
        {t.install.steps.map((step, i) => {
          const Icon = STEP_ICONS[i] ?? Smartphone
          return (
            <li key={step}>
              <Card className="flex items-center gap-4 p-4">
                <div className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                  <Icon size={28} aria-hidden />
                  <span className="absolute -top-1.5 -left-1.5 flex size-6 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-on-accent">
                    {i + 1}
                  </span>
                </div>
                <p className="text-[16px] leading-snug">{step}</p>
              </Card>
            </li>
          )
        })}
      </ol>
      <p className="mt-5 px-1 text-[14px] leading-relaxed text-muted">{t.install.note}</p>
    </Page>
  )
}

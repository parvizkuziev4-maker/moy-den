import { Link } from 'react-router-dom'
import { BarChart3, Check, ChevronRight, Monitor, Moon, Smartphone, Sun } from 'lucide-react'
import { Page, Card } from '../../components/Page'
import { Chip, Segmented } from '../../components/Segmented'
import { ACCENTS, ACCENT_HEX, setPrefs, usePrefs, type ThemeMode } from '../../lib/prefs'
import { t } from '../../i18n/ru'
import { BackupSection } from './BackupSection'
import { AreasSection, DataSection, PinSection, RemindersSection } from './SettingsSections'

const THEMES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: t.settings.themeLight, icon: Sun },
  { id: 'dark', label: t.settings.themeDark, icon: Moon },
  { id: 'system', label: t.settings.themeSystem, icon: Monitor },
]

export function Label({ children }: { children: string }) {
  return <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">{children}</h2>
}

export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3">
      <span className="flex-1">
        <span className="block text-[16px]">{label}</span>
        {hint && <span className="block text-[13px] text-muted">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="toggle" />
    </label>
  )
}

export function SettingsPage() {
  const prefs = usePrefs()

  return (
    <Page title={t.settings.title} back>
      <div className="space-y-6">
        <div>
          <Label>{t.settings.name}</Label>
          <Card className="p-0">
            <input
              value={prefs.name}
              onChange={(e) => setPrefs({ name: e.target.value })}
              placeholder={t.settings.namePlaceholder}
              autoComplete="given-name"
              aria-label={t.settings.name}
              className="w-full rounded-3xl bg-transparent px-4 py-3.5 outline-none placeholder:text-muted"
            />
          </Card>
        </div>

        <div>
          <Label>{t.settings.theme}</Label>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t.settings.theme}>
            {THEMES.map(({ id, label, icon: Icon }) => {
              const active = prefs.theme === id
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPrefs({ theme: id })}
                  className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl text-[14px] font-medium shadow-soft transition ${
                    active ? 'bg-accent text-on-accent' : 'bg-surface'
                  }`}
                >
                  <Icon size={22} />
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <Label>{t.settings.accent}</Label>
          <Card className="p-4">
            <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label={t.settings.accent}>
              {ACCENTS.map((a) => {
                const active = prefs.accent === a
                return (
                  <button
                    key={a}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={t.accents[a]}
                    onClick={() => setPrefs({ accent: a })}
                    className="mx-auto flex size-11 items-center justify-center rounded-full transition-transform active:scale-90"
                    style={{
                      background: ACCENT_HEX[a],
                      boxShadow: active ? `0 0 0 3px var(--surface), 0 0 0 5px ${ACCENT_HEX[a]}` : undefined,
                    }}
                  >
                    {active && <Check size={20} color="#fff" strokeWidth={3} />}
                  </button>
                )
              })}
            </div>
          </Card>
        </div>

        <div>
          <Label>{t.settings.weekStart}</Label>
          <Segmented
            label={t.settings.weekStart}
            value={String(prefs.weekStartsOn) as '0' | '1'}
            onChange={(v) => setPrefs({ weekStartsOn: Number(v) as 0 | 1 })}
            options={[
              { id: '1', label: t.settings.monday },
              { id: '0', label: t.settings.sunday },
            ]}
          />
        </div>

        <AreasSection />

        <div>
          <Label>{t.tabs.habits}</Label>
          <Card className="p-0">
            <ToggleRow
              label={t.settings.softHabits}
              hint={t.settings.softHabitsHint}
              checked={prefs.softHabits}
              onChange={(v) => setPrefs({ softHabits: v })}
            />
            {prefs.softHabits && (
              <div className="border-t border-line px-4 py-3">
                <p className="mb-2 text-[14px] text-muted">{t.settings.restDays}</p>
                <div className="flex gap-2">
                  {[1, 2].map((n) => (
                    <Chip key={n} active={prefs.restDaysPerWeek === n} onClick={() => setPrefs({ restDaysPerWeek: n })}>
                      {n}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        <div>
          <Label>{t.tabs.today}</Label>
          <Card className="p-0">
            <ToggleRow label={t.settings.quotes} checked={prefs.showQuotes} onChange={(v) => setPrefs({ showQuotes: v })} />
          </Card>
        </div>

        <RemindersSection />
        <PinSection />
        <BackupSection />

        <Card className="p-0">
          <Link to="/stats" className="flex min-h-14 items-center gap-3 border-b border-line px-4">
            <BarChart3 size={22} className="text-accent" />
            <span className="flex-1 text-[16px]">{t.settings.stats}</span>
            <ChevronRight size={20} className="text-muted" />
          </Link>
          <Link to="/install" className="flex min-h-14 items-center gap-3 px-4">
            <Smartphone size={22} className="text-accent" />
            <span className="flex-1 text-[16px]">{t.settings.install}</span>
            <ChevronRight size={20} className="text-muted" />
          </Link>
        </Card>

        <DataSection />

        <div>
          <Label>{t.settings.about}</Label>
          <Card className="space-y-1 p-4 text-[15px]">
            <p className="flex justify-between">
              <span className="text-muted">{t.settings.version}</span>
              <span>{__APP_VERSION__}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted">{t.settings.buildDate}</span>
              <span>{new Date(__BUILD_DATE__).toLocaleString('ru-RU')}</span>
            </p>
          </Card>
        </div>
      </div>
    </Page>
  )
}

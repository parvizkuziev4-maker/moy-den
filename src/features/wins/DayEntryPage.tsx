import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Zap } from 'lucide-react'
import { Card, Page } from '../../components/Page'
import { db } from '../../db/db'
import { emptyDay, saveDay } from '../../db/wins'
import type { DayEntry, DayKey, Win } from '../../db/types'
import { dayLabel, todayKey } from '../../lib/dates'
import { MOODS, capitalize } from '../../lib/reviews'
import { useAreas } from '../plan/usePlanData'
import { WinRow, WinSheet } from './WinParts'
import { t } from '../../i18n/ru'

export function DayEntryPage() {
  const { date: param = 'today' } = useParams()
  const date: DayKey = param === 'today' ? todayKey() : param
  const entry = useLiveQuery(async () => (await db.days.get(date)) ?? null, [date])
  const wins = useLiveQuery(() => db.wins.where('date').equals(date).toArray(), [date]) ?? []
  const areas = useAreas()
  const [editing, setEditing] = useState<Win | null>(null)

  return (
    <Page title={t.day.title} subtitle={capitalize(dayLabel(date))} back>
      {entry !== undefined && <DayForm key={date} date={date} initial={entry ?? emptyDay(date)} />}

      <h2 className="mt-6 mb-2 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">
        {t.day.winsOfDay} · {wins.length}
      </h2>
      <Card className="p-1.5">
        {wins.length === 0 ? (
          <p className="px-3 py-3 text-[15px] text-muted">{t.wins.emptyDay}</p>
        ) : (
          <ul>
            {wins.map((w) => (
              <WinRow key={w.id} win={w} area={w.areaId ? areas.get(w.areaId) : undefined} onOpen={setEditing} />
            ))}
          </ul>
        )}
      </Card>
      <WinSheet win={editing} areas={[...areas.values()]} onClose={() => setEditing(null)} />
    </Page>
  )
}

const field =
  'w-full rounded-xl bg-surface px-3 py-2.5 text-[16px] outline-none ring-accent focus:ring-2 placeholder:text-muted'

function Label({ children }: { children: string }) {
  return <h2 className="mt-5 mb-2 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">{children}</h2>
}

function DayForm({ date, initial }: { date: DayKey; initial: DayEntry }) {
  const [mood, setMood] = useState(initial.mood)
  const [energy, setEnergy] = useState(initial.energy)
  const [text, setText] = useState({
    g0: initial.gratitude[0] ?? '',
    g1: initial.gratitude[1] ?? '',
    g2: initial.gratitude[2] ?? '',
    bestMoment: initial.bestMoment,
    lesson: initial.lesson,
    tomorrowFocus: initial.tomorrowFocus,
    note: initial.note,
  })

  const set = (k: keyof typeof text) => (v: string) => setText((s) => ({ ...s, [k]: v }))
  // Пишем в базу при уходе с поля
  const persist = () =>
    void saveDay(date, {
      gratitude: [text.g0, text.g1, text.g2].map((x) => x.trim()),
      bestMoment: text.bestMoment.trim(),
      lesson: text.lesson.trim(),
      tomorrowFocus: text.tomorrowFocus.trim(),
      note: text.note,
    })

  return (
    <div onBlur={persist}>
      <Label>{t.day.mood}</Label>
      <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={t.day.mood}>
        {MOODS.map((emoji, i) => {
          const v = i + 1
          const active = mood === v
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={t.day.moodNames[i]}
              onClick={() => {
                const next = active ? undefined : v
                setMood(next)
                void saveDay(date, { mood: next })
              }}
              className={`flex min-h-16 flex-col items-center justify-center rounded-2xl transition ${
                active ? 'scale-105 bg-accent-soft ring-2 ring-accent' : 'bg-surface'
              }`}
            >
              <span className="text-[30px]">{emoji}</span>
            </button>
          )
        })}
      </div>
      {mood && <p className="mt-1.5 text-center text-[14px] text-muted">{t.day.moodNames[mood - 1]}</p>}

      <Label>{t.day.energy}</Label>
      <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={t.day.energy}>
        {[1, 2, 3, 4, 5].map((v) => {
          const active = energy === v
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${t.day.energy} ${v}`}
              onClick={() => {
                const next = active ? undefined : v
                setEnergy(next)
                void saveDay(date, { energy: next })
              }}
              className={`flex min-h-12 items-center justify-center rounded-2xl ${
                energy && v <= energy ? 'bg-[#e8a33a] text-white' : 'bg-surface text-muted'
              }`}
            >
              <Zap size={20} fill={energy && v <= energy ? 'currentColor' : 'none'} />
            </button>
          )
        })}
      </div>

      <Label>{t.day.gratitude}</Label>
      <div className="space-y-2">
        {(['g0', 'g1', 'g2'] as const).map((k, i) => (
          <input
            key={k}
            value={text[k]}
            onChange={(e) => set(k)(e.target.value)}
            placeholder={t.day.gratitudePlaceholder(i + 1)}
            aria-label={`${t.day.gratitude} ${i + 1}`}
            className={field}
          />
        ))}
      </div>

      {(
        [
          ['bestMoment', t.day.bestMoment],
          ['lesson', t.day.lesson],
          ['tomorrowFocus', t.day.tomorrowFocus],
        ] as const
      ).map(([k, label]) => (
        <div key={k}>
          <Label>{label}</Label>
          <input value={text[k]} onChange={(e) => set(k)(e.target.value)} aria-label={label} className={field} />
        </div>
      ))}

      <Label>{t.day.note}</Label>
      <textarea
        rows={4}
        value={text.note}
        onChange={(e) => set('note')(e.target.value)}
        aria-label={t.day.note}
        className={`${field} resize-none`}
      />
      <p className="mt-1.5 px-1 text-[13px] text-muted">✓ {t.day.saved}</p>
    </div>
  )
}

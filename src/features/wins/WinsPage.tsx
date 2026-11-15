import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart3, CalendarHeart, FileText, HeartHandshake, Moon, NotebookPen, Search } from 'lucide-react'
import { endOfMonth, startOfMonth } from 'date-fns'
import { Card, EmptyState, Page } from '../../components/Page'
import { Chip, Segmented } from '../../components/Segmented'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import type { Area, DayKey, Win, WinSize } from '../../db/types'
import { addMonthsKey, dayKey, monthLabel, parseDay, todayKey, weekOf, weekRangeLabel } from '../../lib/dates'
import { capitalize, dayHeader, moodEmoji, onThisDay, winsToMarkdown } from '../../lib/reviews'
import { shareOrDownload } from '../../lib/share'
import { usePrefs } from '../../lib/prefs'
import { useAreas } from '../plan/usePlanData'
import { AddWinCard, WinRow, WinSheet } from './WinParts'
import { t } from '../../i18n/ru'

type Tab = 'feed' | 'bank'

export function WinsPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'bank' ? 'bank' : 'feed'
  const areas = useAreas()
  const [editing, setEditing] = useState<Win | null>(null)

  return (
    <Page
      title={t.tabs.wins}
      actions={
        <>
          <Link
            to="/wins/review"
            aria-label={t.wins.review}
            className="flex size-11 items-center justify-center rounded-full bg-surface text-muted shadow-soft"
          >
            <BarChart3 size={21} />
          </Link>
          <Link
            to="/hard"
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-surface px-3 text-[15px] font-semibold text-pink shadow-soft"
          >
            <HeartHandshake size={19} /> {t.wins.hard}
          </Link>
        </>
      }
    >
      <div className="mb-4">
        <Segmented
          label={t.tabs.wins}
          value={tab}
          onChange={(v) => setParams(v === 'feed' ? {} : { tab: v }, { replace: true })}
          options={[
            { id: 'feed', label: t.wins.feed },
            { id: 'bank', label: t.wins.bank },
          ]}
        />
      </div>
      {tab === 'feed' ? (
        <Feed areas={areas} onOpen={setEditing} />
      ) : (
        <Bank areas={areas} onOpen={setEditing} />
      )}
      <WinSheet win={editing} areas={[...areas.values()]} onClose={() => setEditing(null)} />
    </Page>
  )
}

/* ---------- Лента ---------- */

function Feed({ areas, onOpen }: { areas: Map<string, Area>; onOpen: (w: Win) => void }) {
  const today = todayKey()
  const now = new Date()
  const [limit, setLimit] = useState(150)
  const wins = useLiveQuery(() => db.wins.orderBy('date').reverse().limit(limit).toArray(), [limit])
  const total = useLiveQuery(() => db.wins.count(), []) ?? 0
  const days = useLiveQuery(() => db.days.toArray(), [])
  const past = useLiveQuery(
    async () =>
      onThisDay(await db.wins.where('date').anyOf([addMonthsKey(today, -1), addMonthsKey(today, -12)]).toArray(), today),
    [today],
  )
  const todayEntry = days?.find((d) => d.date === today)
  const dayMap = new Map((days ?? []).map((d) => [d.date, d]))

  if (!wins) return null

  const groups = new Map<DayKey, Win[]>()
  for (const w of wins) groups.set(w.date, [...(groups.get(w.date) ?? []), w])
  if (!groups.has(today)) groups.set(today, [])
  const ordered = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))

  const evening = now.getHours() >= 20 && !todayEntry?.mood
  const sundayEvening = now.getDay() === 0 && now.getHours() >= 18

  return (
    <div className="space-y-4">
      <AddWinCard />

      {evening && (
        <Link to={`/wins/day/${today}`} className="block">
          <Card className="flex items-center gap-3 p-4">
            <Moon size={26} className="shrink-0 text-accent" />
            <span>
              <span className="block font-semibold">{t.wins.eveningTitle}</span>
              <span className="block text-[14px] text-muted">{t.wins.eveningText}</span>
            </span>
          </Card>
        </Link>
      )}
      {sundayEvening && (
        <Link to="/wins/review" className="block">
          <Card className="flex items-center gap-3 p-4">
            <BarChart3 size={26} className="shrink-0 text-accent" />
            <span>
              <span className="block font-semibold">{t.wins.weekReady}</span>
              <span className="block text-[14px] text-muted">{t.wins.weekReadyText}</span>
            </span>
          </Card>
        </Link>
      )}
      {past && (past.monthAgo.length > 0 || past.yearAgo.length > 0) && (
        <Card className="p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <CalendarHeart size={20} className="text-accent" /> {t.wins.onThisDay}
          </h2>
          {(
            [
              [t.wins.yearAgo, past.yearAgo],
              [t.wins.monthAgo, past.monthAgo],
            ] as const
          ).map(
            ([label, list]) =>
              list.length > 0 && (
                <div key={label} className="mt-1">
                  <p className="text-[13px] text-muted">{label}</p>
                  <ul>
                    {list.slice(0, 5).map((w) => (
                      <WinRow key={w.id} win={w} area={w.areaId ? areas.get(w.areaId) : undefined} onOpen={onOpen} />
                    ))}
                  </ul>
                </div>
              ),
          )}
        </Card>
      )}

      {total === 0 ? (
        <EmptyState emoji="🏆" text={t.wins.empty} />
      ) : (
        ordered.map(([date, list]) => {
          const entry = dayMap.get(date)
          const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          return (
            <section key={date}>
              <div className="mb-1.5 flex items-center gap-2 px-1">
                <h2 className="flex-1 text-[15px] font-semibold">{dayHeader(date, list.length, today)}</h2>
                <Link
                  to={`/wins/day/${date}`}
                  aria-label={`${t.wins.dayEntry}: ${date}`}
                  className="flex min-h-9 items-center gap-1 rounded-full px-2 text-[14px] text-muted"
                >
                  {entry?.mood ? <span className="text-[18px]">{moodEmoji(entry.mood)}</span> : <NotebookPen size={17} />}
                </Link>
              </div>
              <Card className="p-1.5">
                {sorted.length === 0 ? (
                  <p className="px-3 py-3 text-[15px] text-muted">{t.wins.emptyDay}</p>
                ) : (
                  <ul>
                    {sorted.map((w) => (
                      <WinRow key={w.id} win={w} area={w.areaId ? areas.get(w.areaId) : undefined} onOpen={onOpen} />
                    ))}
                  </ul>
                )}
              </Card>
            </section>
          )
        })
      )}
      {wins.length >= limit && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + 150)}
          className="min-h-11 w-full rounded-2xl bg-surface-2 font-semibold text-muted"
        >
          {t.wins.more}
        </button>
      )}
    </div>
  )
}

/* ---------- Банк побед ---------- */

function Bank({ areas, onOpen }: { areas: Map<string, Area>; onOpen: (w: Win) => void }) {
  const [q, setQ] = useState('')
  const [areaId, setAreaId] = useState<string | null>(null)
  const [size, setSize] = useState<WinSize | null>(null)
  const [limit, setLimit] = useState(100)
  const [exporting, setExporting] = useState(false)
  const all = useLiveQuery(() => db.wins.orderBy('date').reverse().toArray(), [])
  if (!all) return null

  const query = q.trim().toLowerCase()
  const list = all.filter(
    (w) =>
      (!query || w.text.toLowerCase().includes(query)) &&
      (areaId === null || (areaId === '' ? !w.areaId : w.areaId === areaId)) &&
      (size === null || w.size === size),
  )

  return (
    <div className="space-y-3">
      <Card className="flex items-center gap-3 p-4">
        <span className="text-[34px]" aria-hidden>
          🏆
        </span>
        <div className="flex-1">
          <p className="text-[13px] text-muted">{t.wins.total}</p>
          <p className="text-[28px] leading-tight font-bold tabular-nums">{all.length}</p>
        </div>
        <button
          type="button"
          onClick={() => setExporting(true)}
          className="flex min-h-11 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[14px] font-semibold"
        >
          <FileText size={17} /> {t.wins.export}
        </button>
      </Card>

      <label className="flex min-h-12 items-center gap-2 rounded-2xl bg-surface px-3 shadow-soft">
        <Search size={20} className="text-muted" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.wins.search}
          aria-label={t.wins.search}
          className="min-h-11 flex-1 bg-transparent outline-none placeholder:text-muted"
        />
      </label>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <Chip active={areaId === null} onClick={() => setAreaId(null)}>
          {t.wins.allAreas}
        </Chip>
        {[...areas.values()].map((a) => (
          <Chip key={a.id} active={areaId === a.id} color={a.color} onClick={() => setAreaId(a.id)}>
            <span aria-hidden>{a.emoji}</span> {a.name}
          </Chip>
        ))}
        <Chip active={areaId === ''} onClick={() => setAreaId('')}>
          {t.review.noArea}
        </Chip>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip active={size === null} onClick={() => setSize(null)}>
          {t.wins.allSizes}
        </Chip>
        {(['small', 'medium', 'big'] as const).map((s) => (
          <Chip key={s} active={size === s} onClick={() => setSize(s)}>
            {t.wins.sizes[s]}
          </Chip>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="px-1 py-4 text-muted">{all.length ? t.wins.nothingFound : t.wins.empty}</p>
      ) : (
        <Card className="p-1.5">
          <ul>
            {list.slice(0, limit).map((w) => (
              <WinRow key={w.id} win={w} area={w.areaId ? areas.get(w.areaId) : undefined} showDate onOpen={onOpen} />
            ))}
          </ul>
        </Card>
      )}
      {list.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + 100)}
          className="min-h-11 w-full rounded-2xl bg-surface-2 font-semibold text-muted"
        >
          {t.wins.more}
        </button>
      )}

      <ExportSheet open={exporting} onClose={() => setExporting(false)} wins={all} areas={areas} />
    </div>
  )
}

function ExportSheet({
  open,
  onClose,
  wins,
  areas,
}: {
  open: boolean
  onClose: () => void
  wins: Win[]
  areas: Map<string, Area>
}) {
  const { weekStartsOn } = usePrefs()
  async function run(kind: 'week' | 'month' | 'all') {
    const today = todayKey()
    let from = '0000-00-00'
    let to = '9999-99-99'
    let title: string = t.wins.exportTitleAll
    if (kind === 'week') {
      const w = weekOf(today, weekStartsOn)
      ;[from, to] = [w[0]!, w[6]!]
      title = t.wins.exportTitleWeek(weekRangeLabel(w))
    } else if (kind === 'month') {
      from = dayKey(startOfMonth(parseDay(today)))
      to = dayKey(endOfMonth(parseDay(today)))
      title = t.wins.exportTitleMonth(monthLabel(today))
    }
    const list = wins.filter((w) => w.date >= from && w.date <= to)
    const days = new Map((await db.days.where('date').between(from, to, true, true).toArray()).map((d) => [d.date, d]))
    const md = winsToMarkdown(capitalize(title), list, areas, days)
    const name = `moy-den-pobedy-${kind === 'all' ? 'vse' : from}.md`
    onClose()
    await shareOrDownload(name, md, 'text/markdown')
  }
  return (
    <Sheet open={open} onClose={onClose} title={t.wins.export}>
      <div className="space-y-2 pb-4">
        {(
          [
            ['week', t.wins.exportWeek],
            ['month', t.wins.exportMonth],
            ['all', t.wins.exportAll],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => void run(k)}
            className="flex min-h-12 w-full items-center gap-2 rounded-2xl bg-surface px-4 text-left font-semibold shadow-soft"
          >
            <FileText size={18} className="text-accent" /> {label}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

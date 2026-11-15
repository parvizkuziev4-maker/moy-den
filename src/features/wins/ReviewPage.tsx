import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { endOfMonth, startOfMonth } from 'date-fns'
import { ChevronLeft, ChevronRight, Star, Trophy } from 'lucide-react'
import { Card, Page } from '../../components/Page'
import { Segmented } from '../../components/Segmented'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import { loadLogMaps } from '../../db/habits'
import { saveDay } from '../../db/wins'
import type { Area, DayKey, Win } from '../../db/types'
import {
  addDaysKey,
  addMonthsKey,
  dayKey,
  dayLabel,
  monthLabel,
  parseDay,
  todayKey,
  weekOf,
  weekRangeLabel,
  weekdayShort,
} from '../../lib/dates'
import { MOODS, capitalize, compareText, periodStats, type DayStat, type PeriodStats } from '../../lib/reviews'
import { usePrefs } from '../../lib/prefs'
import { useAreas } from '../plan/usePlanData'
import { WinIcon } from './WinParts'
import { t } from '../../i18n/ru'

type Period = 'week' | 'month'

function rangeOf(period: Period, d: DayKey, ws: 0 | 1): [DayKey, DayKey] {
  if (period === 'week') {
    const w = weekOf(d, ws)
    return [w[0]!, w[6]!]
  }
  const date = parseDay(d)
  return [dayKey(startOfMonth(date)), dayKey(endOfMonth(date))]
}

export function ReviewPage() {
  const [params, setParams] = useSearchParams()
  const period: Period = params.get('p') === 'month' ? 'month' : 'week'
  const today = todayKey()
  const d = params.get('d') ?? today
  const { weekStartsOn } = usePrefs()
  const [from, to] = rangeOf(period, d, weekStartsOn)
  const [pFrom, pFullTo] = rangeOf(period, period === 'week' ? addDaysKey(d, -7) : addMonthsKey(d, -1), weekStartsOn)
  // Месяц ещё идёт — сравниваем с тем же числом дней прошлого месяца, чтобы было честно
  const sameDayLastMonth = addMonthsKey(today, -1)
  const pTo = period === 'month' && from <= today && today <= to && sameDayLastMonth < pFullTo ? sameDayLastMonth : pFullTo
  const areas = useAreas()

  const data = useLiveQuery(async () => {
    const isoFrom = new Date(parseDay(pFrom).getTime() - 86400000).toISOString()
    const [wins, days, tasks, habits, logs, weekEnd] = await Promise.all([
      db.wins.where('date').between(pFrom, to, true, true).toArray(),
      db.days.where('date').between(pFrom, to, true, true).toArray(),
      db.tasks.where('doneAt').above(isoFrom).toArray(),
      db.habits.toArray(),
      loadLogMaps(),
      db.days.get(to),
    ])
    const base = { today, wins, days, tasks, habits, logs }
    return {
      cur: periodStats({ ...base, from, to }),
      prev: periodStats({ ...base, from: pFrom, to: pTo }),
      wins: wins.filter((w) => w.date >= from && w.date <= to),
      winOfWeekId: weekEnd?.winOfWeekId,
    }
  }, [from, to, pFrom, pTo, today])

  const go = (p: Period, date: DayKey = d) => setParams({ p, d: date }, { replace: true })
  const step = (n: number) => go(period, period === 'week' ? addDaysKey(d, 7 * n) : addMonthsKey(d, n))
  const isCurrent = from <= today && today <= to

  return (
    <Page title={t.review.title} back>
      <div className="mb-3">
        <Segmented
          label={t.review.title}
          value={period}
          onChange={(p) => go(p)}
          options={[
            { id: 'week', label: t.review.week },
            { id: 'month', label: t.review.month },
          ]}
        />
      </div>
      <div className="mb-3 flex items-center gap-1">
        <button
          type="button"
          aria-label={t.plan.prev}
          onClick={() => step(-1)}
          className="flex size-11 items-center justify-center rounded-full text-accent"
        >
          <ChevronLeft size={24} />
        </button>
        <h2 className="flex-1 text-center text-[17px] font-semibold first-letter:uppercase">
          {period === 'week' ? weekRangeLabel(weekOf(from, weekStartsOn)) : monthLabel(from)}
        </h2>
        <button
          type="button"
          aria-label={t.plan.next}
          onClick={() => step(1)}
          disabled={isCurrent}
          className="flex size-11 items-center justify-center rounded-full text-accent disabled:opacity-30"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {data && (
        <Review
          period={period}
          stats={data.cur}
          prev={data.prev}
          wins={data.wins}
          areas={areas}
          weekEnd={to}
          winOfWeekId={data.winOfWeekId}
        />
      )}
    </Page>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-0.5 text-[26px] leading-tight font-bold tabular-nums">{value}</p>
      {sub && <p className="text-[13px] text-muted">{sub}</p>}
    </Card>
  )
}

function Review({
  period,
  stats,
  prev,
  wins,
  areas,
  weekEnd,
  winOfWeekId,
}: {
  period: Period
  stats: PeriodStats
  prev: PeriodStats
  wins: Win[]
  areas: Map<string, Area>
  weekEnd: DayKey
  winOfWeekId?: string
}) {
  const [choosing, setChoosing] = useState(false)
  const winOfWeek = wins.find((w) => w.id === winOfWeekId)
  const areaRows = [...stats.byArea.entries()].sort((a, b) => b[1] - a[1])
  const maxArea = Math.max(1, ...areaRows.map((r) => r[1]))

  return (
    <div className="space-y-3">
      {period === 'month' && (
        <Card className="bg-accent-soft p-4 text-[16px] font-medium">{compareText(stats.wins, prev.wins)}</Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Tile label={t.review.wins} value={String(stats.wins)} sub={stats.bigWins ? `⭐ ${stats.bigWins}` : undefined} />
        <Tile label={t.review.tasks} value={String(stats.tasksDone)} />
        <Tile
          label={t.review.habits}
          value={stats.habitRate === null ? '—' : `${Math.round(stats.habitRate * 100)}%`}
        />
        <Tile
          label={t.review.mood}
          value={stats.avgMood === null ? '—' : `${MOODS[Math.round(stats.avgMood) - 1]} ${stats.avgMood.toFixed(1)}`}
        />
      </div>

      {stats.bestDay && (
        <Card className="flex items-center gap-3 p-4">
          <Trophy size={26} className="shrink-0 text-[#d4a03a]" />
          <div>
            <p className="text-[13px] text-muted">{t.review.bestDay}</p>
            <p className="font-semibold">
              {t.review.bestDayText(capitalize(dayLabel(stats.bestDay.date)), stats.bestDay.wins)}
            </p>
          </div>
        </Card>
      )}

      {period === 'week' && (
        <Card className="p-4">
          <h3 className="mb-2 flex items-center gap-1.5 font-semibold">
            <Star size={18} className="text-[#e8a33a]" fill="currentColor" /> {t.review.winOfWeek}
          </h3>
          {winOfWeek ? (
            <button type="button" onClick={() => setChoosing(true)} className="flex w-full items-center gap-3 text-left">
              <WinIcon win={winOfWeek} />
              <span className="text-[17px] font-semibold">{winOfWeek.text}</span>
            </button>
          ) : wins.length > 0 ? (
            <button
              type="button"
              onClick={() => setChoosing(true)}
              className="min-h-11 w-full rounded-2xl bg-accent-soft font-semibold text-accent"
            >
              {t.review.chooseWin}
            </button>
          ) : (
            <p className="text-[15px] text-muted">{t.review.noWins}</p>
          )}
        </Card>
      )}

      <Card className="p-4">
        <h3 className="mb-3 font-semibold">{t.review.moodChart}</h3>
        {stats.byDay.some((d) => d.mood) ? (
          <MoodChart days={stats.byDay} period={period} />
        ) : (
          <p className="text-[14px] text-muted">{t.review.noMood}</p>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 font-semibold">{t.review.winsChart}</h3>
        <WinsBars days={stats.byDay} period={period} />
      </Card>

      {areaRows.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 font-semibold">{t.review.areas}</h3>
          <ul className="space-y-2">
            {areaRows.map(([id, n]) => {
              const a = areas.get(id)
              return (
                <li key={id || 'none'}>
                  <div className="mb-0.5 flex justify-between text-[14px]">
                    <span>{a ? `${a.emoji} ${a.name}` : t.review.noArea}</span>
                    <span className="font-semibold tabular-nums">{n}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(n / maxArea) * 100}%`, background: a?.color ?? 'var(--muted)' }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <Sheet open={choosing} onClose={() => setChoosing(false)} title={t.review.winOfWeek}>
        <ul className="space-y-1 pb-4">
          {wins.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => {
                  void saveDay(weekEnd, { winOfWeekId: w.id })
                  setChoosing(false)
                }}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left ${w.id === winOfWeekId ? 'bg-accent-soft' : ''}`}
              >
                <WinIcon win={w} />
                <span className="flex-1">{w.text}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  )
}

const W = 320
const H = 120

/** Линия настроения (1–5) */
export function MoodChart({ days, period }: { days: DayStat[]; period: Period }) {
  const n = Math.max(1, days.length - 1)
  const x = (i: number) => 14 + (i / n) * (W - 28)
  const y = (m: number) => 10 + ((5 - m) / 4) * (H - 30)
  const pts = days.map((d, i) => (d.mood ? { x: x(i), y: y(d.mood), m: d.mood } : null))
  const segments: string[] = []
  let cur = ''
  for (const p of pts) {
    if (!p) {
      if (cur) segments.push(cur)
      cur = ''
      continue
    }
    cur += `${cur ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)} `
  }
  if (cur) segments.push(cur)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t.review.moodChart}>
      {[1, 3, 5].map((m) => (
        <line key={m} x1={10} x2={W - 10} y1={y(m)} y2={y(m)} stroke="var(--border)" strokeDasharray="3 4" />
      ))}
      {segments.map((s, i) => (
        <path key={i} d={s} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {pts.map(
        (p, i) =>
          p && (
            <text key={i} x={p.x} y={p.y + 5} textAnchor="middle" fontSize={period === 'week' ? 16 : 10}>
              {period === 'week' ? MOODS[p.m - 1] : '●'}
            </text>
          ),
      )}
      {period === 'week' &&
        days.map((d, i) => (
          <text key={d.date} x={x(i)} y={H - 4} textAnchor="middle" fontSize={11} className="fill-muted">
            {weekdayShort(d.date)}
          </text>
        ))}
    </svg>
  )
}

/** Столбики побед по дням */
export function WinsBars({ days, period }: { days: DayStat[]; period: Period }) {
  const max = Math.max(1, ...days.map((d) => d.wins))
  const bw = (W - 20) / Math.max(1, days.length)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t.review.winsChart}>
      {days.map((d, i) => {
        const h = (d.wins / max) * (H - 34)
        const x = 10 + i * bw
        return (
          <g key={d.date}>
            <rect
              x={x + bw * 0.18}
              y={H - 18 - h}
              width={bw * 0.64}
              height={Math.max(h, d.wins ? 2 : 0)}
              rx={Math.min(5, bw * 0.2)}
              fill="var(--accent)"
            />
            {period === 'week' && d.wins > 0 && (
              <text x={x + bw / 2} y={H - 22 - h} textAnchor="middle" fontSize={11} className="fill-muted">
                {d.wins}
              </text>
            )}
            {(period === 'week' || i % 5 === 0) && (
              <text x={x + bw / 2} y={H - 4} textAnchor="middle" fontSize={10} className="fill-muted">
                {period === 'week' ? weekdayShort(d.date) : parseDay(d.date).getDate()}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Flame, Trophy } from 'lucide-react'
import { Card, Page } from '../../components/Page'
import { Segmented } from '../../components/Segmented'
import { db } from '../../db/db'
import { loadLogMaps } from '../../db/habits'
import type { Area } from '../../db/types'
import { addDaysKey, parseDay, todayKey } from '../../lib/dates'
import { MOODS, periodStats } from '../../lib/reviews'
import { completionRate, streaks } from '../../lib/streaks'
import { moodByHabit, oneDecimal, tasksByArea } from '../../lib/stats'
import { useAreas } from '../plan/usePlanData'
import { useSoftMode } from '../habits/useHabitData'
import { MoodChart, WinsBars } from '../wins/ReviewPage'
import { t } from '../../i18n/ru'

type Range = 7 | 30

export function StatsPage() {
  const [range, setRange] = useState<Range>(7)
  const today = todayKey()
  const from = addDaysKey(today, -(range - 1))
  const from30 = addDaysKey(today, -29)
  const areas = useAreas()
  const soft = useSoftMode()

  const data = useLiveQuery(async () => {
    const isoFrom = new Date(parseDay(from30).getTime() - 86400000).toISOString()
    const [wins, days, tasks, habits, logs] = await Promise.all([
      db.wins.where('date').aboveOrEqual(from30).toArray(),
      db.days.where('date').aboveOrEqual(addDaysKey(today, -120)).toArray(),
      db.tasks.where('doneAt').above(isoFrom).toArray(),
      db.habits.orderBy('order').toArray(),
      loadLogMaps(),
    ])
    const base = { today, wins, days, tasks, habits, logs, to: today }
    return {
      cur: periodStats({ ...base, from }),
      month: periodStats({ ...base, from: from30 }),
      taskAreas: tasksByArea(tasks, from, today),
      habits: habits.filter((h) => !h.archived),
      logs,
      // разницу меньше 0.3 не показываем — это скорее шум
      obs: moodByHabit(habits, logs, days, addDaysKey(today, -89), today).filter((o) => Math.abs(o.withAvg - o.withoutAvg) >= 0.3),
    }
  }, [from, from30, today])

  return (
    <Page title={t.stats.title} back>
      <div className="mb-4">
        <Segmented
          label={t.stats.title}
          value={String(range) as '7' | '30'}
          onChange={(v) => setRange(Number(v) as Range)}
          options={[
            { id: '7', label: t.stats.week },
            { id: '30', label: t.stats.month },
          ]}
        />
      </div>
      {data && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Tile label={t.stats.tasks} value={String(data.cur.tasksDone)} />
            <Tile label={t.stats.wins} value={String(data.cur.wins)} />
            <Tile label={t.stats.habits} value={data.cur.habitRate === null ? '—' : `${Math.round(data.cur.habitRate * 100)}%`} />
            <Tile
              label={t.stats.mood}
              value={data.cur.avgMood === null ? '—' : `${MOODS[Math.round(data.cur.avgMood) - 1]} ${oneDecimal(data.cur.avgMood)}`}
            />
          </div>

          <Card className="p-4">
            <h2 className="mb-3 font-semibold">{t.stats.winsByDay}</h2>
            <WinsBars days={data.cur.byDay} period={range === 7 ? 'week' : 'month'} />
          </Card>

          <AreaBars title={t.stats.tasksByArea} rows={data.taskAreas} areas={areas} />
          <AreaBars title={t.stats.winsByArea} rows={data.cur.byArea} areas={areas} />

          {data.habits.length > 0 && (
            <Card className="p-4">
              <h2 className="mb-3 font-semibold">{t.stats.habitsTitle}</h2>
              <ul className="space-y-3">
                {data.habits.map((h) => {
                  const l = data.logs.get(h.id) ?? new Map()
                  const rate = completionRate(h, l, today, 30)
                  const s = streaks(h, l, today, soft)
                  return (
                    <li key={h.id}>
                      <div className="mb-1 flex items-center gap-2 text-[15px]">
                        <span aria-hidden>{h.emoji}</span>
                        <span className="flex-1 truncate">{h.name}</span>
                        <span className="flex items-center gap-0.5 text-[13px] text-warn">
                          <Flame size={13} fill="currentColor" /> {s.current}
                        </span>
                        <span className="flex items-center gap-0.5 text-[13px] text-muted">
                          <Trophy size={13} /> {s.best}
                        </span>
                        <span className="w-11 text-right font-semibold tabular-nums">
                          {rate === null ? '—' : `${Math.round(rate * 100)}%`}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full" style={{ width: `${(rate ?? 0) * 100}%`, background: h.color }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          <Card className="p-4">
            <h2 className="mb-3 font-semibold">{t.stats.moodLine}</h2>
            {data.month.byDay.some((d) => d.mood) ? (
              <MoodChart days={data.month.byDay} period="month" />
            ) : (
              <p className="text-[14px] text-muted">{t.review.noMood}</p>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 font-semibold">{t.stats.moodHabits}</h2>
            {data.obs.length === 0 ? (
              <p className="text-[14px] text-muted">{t.stats.moodNeedMore}</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {data.obs.slice(0, 4).map((o) => (
                    <li key={o.habit.id} className="flex gap-2 text-[15px] leading-snug">
                      <span aria-hidden>{o.habit.emoji}</span>
                      <span>{t.stats.moodObs(o.habit.name, oneDecimal(o.withAvg), oneDecimal(o.withoutAvg))}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[13px] text-muted">{t.stats.moodNote}</p>
              </>
            )}
          </Card>
        </div>
      )}
    </Page>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-0.5 text-[26px] leading-tight font-bold tabular-nums">{value}</p>
    </Card>
  )
}

function AreaBars({ title, rows, areas }: { title: string; rows: Map<string, number>; areas: Map<string, Area> }) {
  const list = [...rows.entries()].sort((a, b) => b[1] - a[1])
  if (list.length === 0) return null
  const max = Math.max(1, ...list.map((r) => r[1]))
  return (
    <Card className="p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <ul className="space-y-2">
        {list.map(([id, n]) => {
          const a = areas.get(id)
          return (
            <li key={id || 'none'}>
              <div className="mb-0.5 flex justify-between text-[14px]">
                <span>{a ? `${a.emoji} ${a.name}` : t.review.noArea}</span>
                <span className="font-semibold tabular-nums">{n}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: a?.color ?? 'var(--muted)' }} />
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

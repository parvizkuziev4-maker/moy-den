import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Archive, ArrowUpDown, Check, ChevronRight, Flame, GripVertical } from 'lucide-react'
import { Page, EmptyState } from '../../components/Page'
import { Fab } from '../../components/Fab'
import { useReorder } from '../../components/useReorder'
import { reorderHabits } from '../../db/habits'
import type { DayKey, Habit } from '../../db/types'
import { addDaysKey, parseDay, todayKey, weekdayShort } from '../../lib/dates'
import { allDoneOn, doneThisWeek, isDoneValue, isDue, streaks, type LogMap } from '../../lib/streaks'
import { usePrefs } from '../../lib/prefs'
import { EMPTY_LOG, useHabits, useLogMaps, useSoftMode } from './useHabitData'
import { HabitControl } from './HabitControl'
import { HabitFormSheet } from './HabitForm'
import { t } from '../../i18n/ru'

export function HabitsPage() {
  const today = todayKey()
  const [params, setParams] = useSearchParams()
  const date: DayKey = params.get('d') ?? today
  const habits = useHabits()
  const archived = useHabits(true)
  const logs = useLogMaps()
  const { weekStartsOn } = usePrefs()
  const [adding, setAdding] = useState(false)
  const [reordering, setReordering] = useState(false)

  const due = habits.filter((h) => isDue(h, logs.get(h.id) ?? EMPTY_LOG, date, weekStartsOn))
  const notDue = habits.filter((h) => !due.includes(h))

  return (
    <Page
      title={t.tabs.habits}
      actions={
        habits.length > 1 && (
          <button
            type="button"
            aria-pressed={reordering}
            onClick={() => setReordering((r) => !r)}
            className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[15px] font-semibold shadow-soft ${
              reordering ? 'bg-accent text-on-accent' : 'bg-surface text-muted'
            }`}
          >
            {reordering ? <Check size={18} /> : <ArrowUpDown size={18} />}
            {reordering ? t.habits.reorderDone : t.habits.reorder}
          </button>
        )
      }
    >
      {reordering ? (
        <ReorderList habits={habits} />
      ) : (
        <>
          {habits.length > 0 && (
            <DayStrip
              selected={date}
              today={today}
              onSelect={(d) => setParams(d === today ? {} : { d }, { replace: true })}
              status={(d) => allDoneOn(habits, logs, d, weekStartsOn)}
            />
          )}

          {habits.length === 0 ? (
            <EmptyState emoji="🌱" text={t.habits.empty} />
          ) : (
            <>
              <ul className="space-y-2.5">
                {due.map((h) => (
                  <HabitCard key={h.id} habit={h} logs={logs.get(h.id) ?? EMPTY_LOG} date={date} />
                ))}
              </ul>
              {notDue.length > 0 && (
                <>
                  <h2 className="mt-6 mb-2 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">
                    {t.habits.notToday}
                  </h2>
                  <ul className="space-y-2.5 opacity-70">
                    {notDue.map((h) => (
                      <HabitCard key={h.id} habit={h} logs={logs.get(h.id) ?? EMPTY_LOG} date={date} />
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          {archived.length > 0 && (
            <Link
              to="/habits/archive"
              className="mt-6 flex min-h-12 items-center gap-2 rounded-2xl px-2 text-[15px] text-muted"
            >
              <Archive size={18} /> {t.habits.archiveList} · {archived.length}
              <ChevronRight size={18} className="ml-auto" />
            </Link>
          )}
        </>
      )}

      <Fab label={t.habits.add} onClick={() => setAdding(true)} />
      <HabitFormSheet open={adding} onClose={() => setAdding(false)} />
    </Page>
  )
}

/** 7 последних дней — можно отметить и прошлые */
function DayStrip({
  selected,
  today,
  onSelect,
  status,
}: {
  selected: DayKey
  today: DayKey
  onSelect: (d: DayKey) => void
  status: (d: DayKey) => { all: boolean; due: number; done: number }
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(today, i - 6))
  return (
    <div className="mb-4 grid grid-cols-7 gap-1.5" role="tablist" aria-label={t.habits.lastDays}>
      {days.map((d) => {
        const active = d === selected
        const s = status(d)
        return (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(d)}
            className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl transition ${
              active ? 'bg-accent text-on-accent shadow-soft' : 'bg-surface'
            }`}
          >
            <span className={`text-[12px] font-medium uppercase ${active ? '' : 'text-muted'}`}>
              {weekdayShort(d)}
            </span>
            <span className="text-[17px] font-bold tabular-nums">{parseDay(d).getDate()}</span>
            <span
              className={`size-1.5 rounded-full ${active ? 'bg-on-accent' : 'bg-accent'} ${s.all ? '' : s.done > 0 ? 'opacity-40' : 'opacity-0'}`}
              aria-hidden
            />
          </button>
        )
      })}
    </div>
  )
}

function HabitCard({ habit, logs, date }: { habit: Habit; logs: LogMap; date: DayKey }) {
  const navigate = useNavigate()
  const soft = useSoftMode()
  const today = todayKey()
  const value = logs.get(date) ?? 0
  const s = streaks(habit, logs, today, soft)
  const doneToday = isDoneValue(habit, logs.get(today))

  let sub: React.ReactNode
  if (habit.schedule.kind === 'timesPerWeek') {
    sub = t.habits.weekProgress(doneThisWeek(habit, logs, date, soft.weekStartsOn), habit.schedule.times)
  } else if (s.current === 0 && s.best > 0 && !doneToday) {
    sub = t.habits.restart
  }

  return (
    <li>
      <div
        role="link"
        tabIndex={0}
        onClick={() => navigate(`/habits/${habit.id}`)}
        onKeyDown={(e) => e.key === 'Enter' && navigate(`/habits/${habit.id}`)}
        className="flex cursor-pointer items-center gap-3 rounded-3xl bg-surface p-3 shadow-soft"
      >
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-[24px]"
          style={{ background: `${habit.color}22` }}
          aria-hidden
        >
          {habit.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold">{habit.name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
            {s.current > 0 && (
              <span className="flex items-center gap-0.5 font-semibold text-warn">
                <Flame size={14} fill="currentColor" /> {t.habits.streak(s.current, s.unit)}
              </span>
            )}
            {sub && <span>{sub}</span>}
            {habit.type === 'count' && (
              <span>
                {value}/{habit.target} {habit.unit}
              </span>
            )}
          </div>
          {habit.type === 'count' && (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${Math.min(100, (value / habit.target) * 100)}%`, background: habit.color }}
              />
            </div>
          )}
        </div>
        <HabitControl habit={habit} date={date} value={value} />
      </div>
    </li>
  )
}

function ReorderList({ habits }: { habits: Habit[] }) {
  const byId = new Map(habits.map((h) => [h.id, h]))
  const { ids, dragId, handleProps } = useReorder(
    habits.map((h) => h.id),
    (next) => void reorderHabits(next),
  )
  return (
    <>
      <p className="mb-3 px-1 text-[14px] text-muted">{t.habits.dragHint}</p>
      <ul className="space-y-2">
        {ids.map((id) => {
          const h = byId.get(id)
          if (!h) return null
          return (
            <li
              key={id}
              data-reorder-id={id}
              className={`flex items-center gap-3 rounded-2xl bg-surface p-2 pl-3 shadow-soft transition ${dragId === id ? 'scale-[1.02] ring-2 ring-accent' : ''}`}
            >
              <span className="text-[22px]" aria-hidden>
                {h.emoji}
              </span>
              <span className="flex-1 font-medium">{h.name}</span>
              <button
                type="button"
                aria-label={`${t.habits.dragHandle}: ${h.name}`}
                {...handleProps(id)}
                className="flex size-11 cursor-grab items-center justify-center text-muted"
              >
                <GripVertical size={22} />
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

export function HabitsArchivePage() {
  const archived = useHabits(true)
  const navigate = useNavigate()
  return (
    <Page title={t.habits.archiveList} back>
      {archived.length === 0 ? (
        <EmptyState emoji="🗄️" text={t.habits.archiveEmpty} />
      ) : (
        <ul className="space-y-2">
          {archived.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => navigate(`/habits/${h.id}`)}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-surface px-3 text-left shadow-soft"
              >
                <span className="text-[22px]" aria-hidden>
                  {h.emoji}
                </span>
                <span className="flex-1 font-medium">{h.name}</span>
                <ChevronRight size={18} className="text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}

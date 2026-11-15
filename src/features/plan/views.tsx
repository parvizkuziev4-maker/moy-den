import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, GripVertical, Search } from 'lucide-react'
import { Card, EmptyState } from '../../components/Page'
import type { DayKey, Task } from '../../db/types'
import {
  addDaysKey,
  addMonthsKey,
  dayLabel,
  fullDayLabel,
  monthGrid,
  monthLabel,
  parseDay,
  todayKey,
  weekOf,
  weekRangeLabel,
  weekdayShort,
  type WeekStart,
} from '../../lib/dates'
import { TaskList, TaskRow } from './TaskRow'
import { taskActions } from './PlanContext'
import { useOverdue, useTaskSearch, useTasksBetween, useTasksOn } from './usePlanData'
import { useDragToDay } from './useDragToDay'
import { t } from '../../i18n/ru'

/* ---------- общие кусочки ---------- */

function Nav({
  label,
  onPrev,
  onNext,
  onToday,
  showToday,
}: {
  label: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  showToday: boolean
}) {
  return (
    <div className="mb-3 flex items-center gap-1">
      <button
        type="button"
        aria-label={t.plan.prev}
        onClick={onPrev}
        className="flex size-11 items-center justify-center rounded-full text-accent active:bg-surface-2"
      >
        <ChevronLeft size={24} />
      </button>
      <h2 className="flex-1 text-center text-[17px] font-semibold first-letter:uppercase">{label}</h2>
      <button
        type="button"
        aria-label={t.plan.next}
        onClick={onNext}
        className="flex size-11 items-center justify-center rounded-full text-accent active:bg-surface-2"
      >
        <ChevronRight size={24} />
      </button>
      {showToday && (
        <button
          type="button"
          onClick={onToday}
          className="min-h-9 rounded-full bg-accent-soft px-3 text-[14px] font-semibold text-accent"
        >
          {t.plan.goToday}
        </button>
      )}
    </div>
  )
}

/** Невыполненные + свёрнутый блок «Выполнено» */
function SplitList({ tasks, showDate }: { tasks: Task[]; showDate?: boolean }) {
  const [showDone, setShowDone] = useState(true)
  const undone = tasks.filter((x) => !x.done)
  const done = tasks.filter((x) => x.done)
  return (
    <>
      <TaskList tasks={undone} showDate={showDate} />
      {done.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            aria-expanded={showDone}
            onClick={() => setShowDone((v) => !v)}
            className="mb-1.5 flex min-h-9 items-center gap-1 px-1 text-[14px] font-semibold text-muted"
          >
            <ChevronDown size={16} className={`transition-transform ${showDone ? '' : '-rotate-90'}`} />
            {t.plan.done} · {done.length}
          </button>
          {showDone && <TaskList tasks={done} showDate={showDate} />}
        </div>
      )}
    </>
  )
}

/* ---------- Входящие ---------- */

export function InboxView() {
  const tasks = useTasksOn('')
  if (tasks.length === 0) return <EmptyState emoji="📥" text={t.plan.emptyInbox} />
  return (
    <>
      <p className="mb-3 px-1 text-[14px] text-muted">{t.plan.inboxHint}</p>
      <SplitList tasks={tasks} />
    </>
  )
}

/* ---------- День ---------- */

export function DayView({ date, setDate }: { date: DayKey; setDate: (d: DayKey) => void }) {
  const today = todayKey()
  const tasks = useTasksOn(date)
  const overdue = useOverdue(today)
  const undone = tasks.filter((x) => !x.done)

  return (
    <>
      <Nav
        label={date === today ? `${t.dates.today}, ${fullDayLabel(date).split(', ')[1]}` : fullDayLabel(date)}
        onPrev={() => setDate(addDaysKey(date, -1))}
        onNext={() => setDate(addDaysKey(date, 1))}
        onToday={() => setDate(today)}
        showToday={date !== today}
      />

      {date === today && overdue.length > 0 && (
        <Card className="mb-4 p-3">
          <div className="mb-2 flex items-center gap-2 px-1">
            <h3 className="flex-1 font-semibold text-danger">
              {t.plan.overdue} · {overdue.length}
            </h3>
            <button
              type="button"
              onClick={() => void taskActions.moveMany(overdue, today)}
              className="min-h-9 rounded-full bg-accent-soft px-3 text-[14px] font-semibold text-accent"
            >
              {t.plan.moveToToday}
            </button>
          </div>
          <TaskList tasks={overdue} showDate />
        </Card>
      )}

      {tasks.length === 0 ? (
        <EmptyState emoji="🌤️" text={t.plan.emptyDay} />
      ) : (
        <SplitList tasks={tasks} />
      )}

      {undone.length > 0 && (
        <button
          type="button"
          onClick={() => void taskActions.moveMany(undone, addDaysKey(date, 1))}
          className="mt-5 min-h-11 w-full rounded-2xl bg-surface-2 px-4 text-[15px] font-semibold text-muted"
        >
          {t.plan.moveUndoneToTomorrow}
        </button>
      )}
    </>
  )
}

/* ---------- Неделя ---------- */

export function WeekView({
  date,
  setDate,
  openDay,
  weekStartsOn,
}: {
  date: DayKey
  setDate: (d: DayKey) => void
  openDay: (d: DayKey) => void
  weekStartsOn: WeekStart
}) {
  const today = todayKey()
  const days = weekOf(date, weekStartsOn)
  const tasks = useTasksBetween(days[0]!, days[6]!)
  const { drag, handleProps, ghost } = useDragToDay((id, day) => {
    const task = tasks.find((x) => x.id === id)
    if (task) void taskActions.move(task, day)
  })
  const thisWeek = days.includes(today)

  return (
    <>
      <Nav
        label={weekRangeLabel(days)}
        onPrev={() => setDate(addDaysKey(date, -7))}
        onNext={() => setDate(addDaysKey(date, 7))}
        onToday={() => setDate(today)}
        showToday={!thisWeek}
      />
      <div className="space-y-3">
        {days.map((day) => {
          const list = tasks.filter((x) => x.date === day)
          const isOver = drag?.over === day
          return (
            <section
              key={day}
              data-day={day}
              className={`rounded-3xl p-2 transition ${isOver ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-2/60'}`}
            >
              <button
                type="button"
                onClick={() => openDay(day)}
                className="flex min-h-10 w-full items-center gap-2 px-2 text-left"
              >
                <span
                  className={`text-[15px] font-semibold first-letter:uppercase ${day === today ? 'text-accent' : ''}`}
                >
                  {dayLabel(day, today)}
                </span>
                {day === today || day === addDaysKey(today, 1) || day === addDaysKey(today, -1) ? (
                  <span className="text-[13px] text-muted">
                    {weekdayShort(day)}, {parseDay(day).getDate()}
                  </span>
                ) : null}
                <span className="ml-auto text-[13px] text-muted">
                  {list.length > 0 && `${list.filter((x) => x.done).length}/${list.length}`}
                </span>
              </button>
              {list.length === 0 ? (
                <p className="px-2 pb-2 text-[14px] text-muted">{t.plan.freeDay}</p>
              ) : (
                <ul className="space-y-1.5">
                  {list.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      handle={
                        <button
                          type="button"
                          aria-label={t.plan.dragHandle}
                          {...handleProps(task.id, task.title)}
                          className={`-mr-2 flex size-11 shrink-0 cursor-grab items-center justify-center text-muted ${
                            drag?.id === task.id ? 'opacity-30' : ''
                          }`}
                        >
                          <GripVertical size={20} />
                        </button>
                      }
                    />
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
      {ghost}
    </>
  )
}

/* ---------- Месяц ---------- */

export function MonthView({
  date,
  setDate,
  openDay,
  weekStartsOn,
}: {
  date: DayKey
  setDate: (d: DayKey) => void
  openDay: (d: DayKey) => void
  weekStartsOn: WeekStart
}) {
  const today = todayKey()
  const grid = monthGrid(date, weekStartsOn)
  const tasks = useTasksBetween(grid[0]!, grid[grid.length - 1]!)
  const month = parseDay(date).getMonth()
  const selected = tasks.filter((x) => x.date === date)

  const byDay = new Map<DayKey, Task[]>()
  for (const task of tasks) byDay.set(task.date, [...(byDay.get(task.date) ?? []), task])

  return (
    <>
      <Nav
        label={monthLabel(date)}
        onPrev={() => setDate(addMonthsKey(date, -1))}
        onNext={() => setDate(addMonthsKey(date, 1))}
        onToday={() => setDate(today)}
        showToday={parseDay(today).getMonth() !== month || date.slice(0, 4) !== today.slice(0, 4)}
      />
      <Card className="p-2">
        <div className="grid grid-cols-7 text-center text-[12px] font-semibold text-muted uppercase">
          {grid.slice(0, 7).map((d) => (
            <div key={d} className="py-1">
              {weekdayShort(d)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {grid.map((d) => {
            const list = byDay.get(d) ?? []
            const undone = list.filter((x) => !x.done).length
            const inMonth = parseDay(d).getMonth() === month
            const isSel = d === date
            const isToday = d === today
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDate(d)}
                aria-label={`${fullDayLabel(d)}${list.length ? `, ${t.plan.tasksCount(list.length)}` : ''}`}
                aria-pressed={isSel}
                className="flex min-h-12 flex-col items-center justify-center gap-1"
              >
                <span
                  className={`flex size-8 items-center justify-center rounded-full text-[15px] tabular-nums ${
                    isSel
                      ? 'bg-accent font-bold text-on-accent'
                      : isToday
                        ? 'font-bold text-accent ring-2 ring-accent/40'
                        : inMonth
                          ? ''
                          : 'text-muted/50'
                  }`}
                >
                  {parseDay(d).getDate()}
                </span>
                <span className="flex h-1.5 gap-0.5" aria-hidden>
                  {list.length > 0 &&
                    (undone > 0 ? (
                      Array.from({ length: Math.min(3, undone) }, (_, i) => (
                        <span key={i} className="size-1.5 rounded-full bg-accent" />
                      ))
                    ) : (
                      <span className="size-1.5 rounded-full bg-muted/50" />
                    ))}
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      <div className="mt-4 mb-2 flex items-center px-1">
        <h3 className="flex-1 text-[17px] font-semibold first-letter:uppercase">{dayLabel(date, today)}</h3>
        <button type="button" onClick={() => openDay(date)} className="min-h-9 px-2 text-[15px] font-semibold text-accent">
          {t.plan.openDay} →
        </button>
      </div>
      {selected.length === 0 ? (
        <p className="px-1 text-[15px] text-muted">{t.plan.freeDay}</p>
      ) : (
        <SplitList tasks={selected} />
      )}
    </>
  )
}

/* ---------- Поиск ---------- */

export function SearchView() {
  const [q, setQ] = useState('')
  const results = useTaskSearch(q)
  return (
    <>
      <label className="mb-4 flex min-h-12 items-center gap-2 rounded-2xl bg-surface px-3 shadow-soft">
        <Search size={20} className="text-muted" aria-hidden />
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.plan.searchPlaceholder}
          aria-label={t.plan.searchPlaceholder}
          className="min-h-11 flex-1 bg-transparent outline-none placeholder:text-muted"
        />
      </label>
      {q.trim() && results.length === 0 && <p className="px-1 text-muted">{t.plan.searchEmpty}</p>}
      <TaskList tasks={results} showDate />
    </>
  )
}

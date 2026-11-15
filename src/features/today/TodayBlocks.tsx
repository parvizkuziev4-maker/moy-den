import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { differenceInCalendarDays } from 'date-fns'
import { Cake, Check, ChevronRight, HardDriveDownload, HeartHandshake, Minus, Moon, Plus, Quote, Target, X } from 'lucide-react'
import { useState } from 'react'
import { Card } from '../../components/Page'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import { saveDay } from '../../db/wins'
import { updateTask } from '../../db/tasks'
import type { Habit, Task } from '../../db/types'
import { addDaysKey, todayKey } from '../../lib/dates'
import { MOODS, lowMoodStreak } from '../../lib/reviews'
import { isDoneValue, isDue } from '../../lib/streaks'
import { overdueContacts, upcomingBirthdays } from '../../lib/people'
import { setPrefs, usePrefs } from '../../lib/prefs'
import { useDismissedToday } from '../../lib/dismiss'
import { quoteOfDay } from '../../i18n/quotes'
import { TaskList } from '../plan/TaskRow'
import { taskActions } from '../plan/PlanContext'
import { EMPTY_LOG, setValueWithCelebration, useHabits, useLogMaps } from '../habits/useHabitData'
import { Avatar } from '../people/PeopleParts'
import { t } from '../../i18n/ru'

function SectionTitle({ children, to, link }: { children: React.ReactNode; to?: string; link?: string }) {
  return (
    <div className="mb-2 flex items-center px-1">
      <h2 className="flex-1 text-[13px] font-semibold tracking-wide text-muted uppercase">{children}</h2>
      {to && (
        <Link to={to} className="flex min-h-9 items-center gap-0.5 text-[14px] font-semibold text-accent">
          {link} <ChevronRight size={16} />
        </Link>
      )}
    </div>
  )
}

/** Карточка-подсказка с кнопкой «скрыть до завтра» */
function Nudge({
  icon,
  text,
  action,
  onClose,
  tone = 'accent',
}: {
  icon: React.ReactNode
  text: React.ReactNode
  action?: { to: string; label: string }
  onClose?: () => void
  tone?: 'accent' | 'rose'
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-3xl p-4 ${tone === 'rose' ? 'bg-[#d9578a]/12' : 'bg-accent-soft'}`}
    >
      <span className={`mt-0.5 shrink-0 ${tone === 'rose' ? 'text-pink' : 'text-accent'}`}>{icon}</span>
      <div className="flex-1 text-[15px] leading-snug">
        <p>{text}</p>
        {action && (
          <Link
            to={action.to}
            className={`mt-1.5 inline-block font-semibold ${tone === 'rose' ? 'text-pink' : 'text-accent'}`}
          >
            {action.label} →
          </Link>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          aria-label={t.today.close}
          onClick={onClose}
          className="-mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted"
        >
          <X size={18} />
        </button>
      )}
    </div>
  )
}

/* ---------- Подсказки: тяжёлые дни, резервная копия ---------- */

export function CareNudges() {
  const today = todayKey()
  const { lastBackupAt } = usePrefs()
  const days = useLiveQuery(() => db.days.where('date').aboveOrEqual(addDaysKey(today, -4)).toArray(), [today])
  const hasData = useLiveQuery(async () => (await db.tasks.count()) + (await db.wins.count()) + (await db.people.count()) > 0, [])
  const [lowHidden, hideLow] = useDismissedToday('low-mood', today)
  const [backupHidden, hideBackup] = useDismissedToday('backup', today)

  const low = days && !lowHidden && lowMoodStreak(days, today)
  const staleDays = lastBackupAt ? differenceInCalendarDays(new Date(), new Date(lastBackupAt)) : null
  const backup = hasData && !backupHidden && (staleDays === null || staleDays > 7)

  if (!low && !backup) return null
  return (
    <div className="space-y-3">
      {low && (
        <Nudge
          tone="rose"
          icon={<HeartHandshake size={22} />}
          text={t.today.lowMood}
          action={{ to: '/hard', label: t.today.lowMoodAction }}
          onClose={hideLow}
        />
      )}
      {backup && (
        <Nudge
          icon={<HardDriveDownload size={22} />}
          text={staleDays === null ? t.today.backupNever : t.today.backupStale(staleDays)}
          action={{ to: '/settings', label: t.today.backupAction }}
          onClose={hideBackup}
        />
      )}
    </div>
  )
}

/* ---------- Фраза дня ---------- */

export function QuoteCard() {
  const { showQuotes } = usePrefs()
  if (!showQuotes) return null
  return (
    <figure className="flex gap-3 px-1">
      <Quote size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
      <blockquote className="text-[16px] leading-snug text-muted italic">{quoteOfDay(todayKey())}</blockquote>
    </figure>
  )
}

/* ---------- Настроение дня ---------- */

export function MoodPicker() {
  const today = todayKey()
  const mood = useLiveQuery(async () => (await db.days.get(today))?.mood ?? 0, [today])
  return (
    <Card className="p-4">
      <p className="mb-3 text-[16px] font-semibold">{t.today.moodQ}</p>
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
              onClick={() => void saveDay(today, { mood: active ? undefined : v })}
              className={`flex min-h-14 items-center justify-center rounded-2xl text-[28px] transition ${
                active ? 'scale-105 bg-accent-soft ring-2 ring-accent' : mood ? 'bg-surface-2 opacity-60' : 'bg-surface-2'
              }`}
            >
              {emoji}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

/* ---------- Фокус дня ---------- */

export function FocusCard({ tasks }: { tasks: Task[] }) {
  const [picking, setPicking] = useState(false)
  const focus = tasks.filter((x) => x.focus)
  return (
    <section>
      <div className="mb-2 flex items-center px-1">
        <h2 className="flex flex-1 items-center gap-1.5 text-[13px] font-semibold tracking-wide text-muted uppercase">
          <Target size={15} className="text-accent" /> {t.today.focus}
        </h2>
        {focus.length > 0 && (
          <button type="button" onClick={() => setPicking(true)} className="min-h-9 text-[14px] font-semibold text-accent">
            {t.today.focusEdit}
          </button>
        )}
      </div>
      {focus.length === 0 ? (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex w-full items-center gap-3 rounded-3xl border-2 border-dashed border-line p-4 text-left"
        >
          <Target size={26} className="shrink-0 text-accent" />
          <span>
            <span className="block font-semibold">{t.today.focusChoose}</span>
            <span className="block text-[14px] text-muted">{t.today.focusHint}</span>
          </span>
        </button>
      ) : (
        <div className="rounded-3xl bg-accent-soft p-1.5">
          <TaskList tasks={focus} />
        </div>
      )}
      <Sheet open={picking} onClose={() => setPicking(false)} title={t.today.focusPick}>
        <FocusPicker tasks={tasks} />
      </Sheet>
    </section>
  )
}

function FocusPicker({ tasks }: { tasks: Task[] }) {
  const undone = tasks.filter((x) => !x.done || x.focus)
  const count = tasks.filter((x) => x.focus).length
  if (undone.length === 0) return <p className="pb-4 text-[15px] text-muted">{t.today.focusNoTasks}</p>
  return (
    <div className="pb-4">
      <p className="mb-3 text-[14px] text-muted">{t.today.focusLimit}</p>
      <ul className="space-y-1">
        {undone.map((task) => {
          const on = !!task.focus
          const disabled = !on && count >= 3
          return (
            <li key={task.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={disabled}
                onClick={() => void updateTask(task.id, { focus: !on })}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-surface px-3 text-left disabled:opacity-40"
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 ${on ? 'border-accent bg-accent text-on-accent' : 'border-line'}`}
                >
                  {on && <Check size={15} strokeWidth={3} />}
                </span>
                <span className="text-[16px]">{task.title}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ---------- Задачи ---------- */

export function TodayTasks({ tasks, overdue }: { tasks: Task[]; overdue: Task[] }) {
  const today = todayKey()
  const rest = tasks.filter((x) => !x.focus)
  return (
    <section>
      <SectionTitle to="/plan" link={t.today.allPlan}>
        {t.today.tasks}
      </SectionTitle>
      {overdue.length > 0 && (
        <Card className="mb-2 p-3">
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
      {rest.length === 0 && tasks.length === 0 ? (
        <p className="px-1 text-[15px] text-muted">{t.today.noTasks}</p>
      ) : (
        <TaskList tasks={rest} />
      )}
    </section>
  )
}

/* ---------- Привычки кружками ---------- */

export function TodayHabits() {
  const today = todayKey()
  const habits = useHabits()
  const logs = useLogMaps()
  const { weekStartsOn } = usePrefs()
  const due = habits.filter((h) => isDue(h, logs.get(h.id) ?? EMPTY_LOG, today, weekStartsOn))
  return (
    <section>
      <SectionTitle to="/habits" link={t.today.allHabits}>
        {t.today.habits}
      </SectionTitle>
      {due.length === 0 ? (
        <p className="px-1 text-[15px] text-muted">{habits.length ? t.wins.emptyDay : t.today.noHabits}</p>
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pt-1 pb-2">
          {due.map((h) => (
            <HabitBubble key={h.id} habit={h} value={logs.get(h.id)?.get(today) ?? 0} weekStartsOn={weekStartsOn} />
          ))}
        </div>
      )}
    </section>
  )
}

function HabitBubble({ habit, value, weekStartsOn }: { habit: Habit; value: number; weekStartsOn: 0 | 1 }) {
  const today = todayKey()
  const done = isDoneValue(habit, value)
  const ratio = habit.type === 'count' ? Math.min(1, value / Math.max(1, habit.target)) : done ? 1 : 0
  const set = (v: number) => void setValueWithCelebration(habit, today, v, weekStartsOn)

  return (
    <div className="flex w-[76px] shrink-0 flex-col items-center gap-1">
      <button
        type="button"
        role={habit.type === 'check' ? 'checkbox' : undefined}
        aria-checked={habit.type === 'check' ? done : undefined}
        aria-label={
          habit.type === 'check'
            ? done
              ? t.habits.unmark(habit.name)
              : t.habits.markDone(habit.name)
            : t.today.countPlus(habit.name)
        }
        onClick={() => set(habit.type === 'check' ? (done ? 0 : 1) : value + 1)}
        className="relative flex size-16 items-center justify-center rounded-full transition-transform active:scale-90"
        style={{
          background: `conic-gradient(${habit.color} ${ratio * 360}deg, var(--surface-2) 0)`,
        }}
      >
        <span
          className="flex size-[54px] items-center justify-center rounded-full text-[26px]"
          style={{ background: done ? habit.color : 'var(--surface)' }}
        >
          {done && habit.type === 'check' ? <Check size={28} color="#fff" strokeWidth={3} /> : habit.emoji}
        </span>
      </button>
      <span className="w-full truncate text-center text-[12px] leading-tight">{habit.name}</span>
      {habit.type === 'count' && (
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label={`${t.habits.minus}: ${habit.name}`}
            disabled={value <= 0}
            onClick={() => set(value - 1)}
            className="flex size-7 items-center justify-center rounded-full bg-surface-2 disabled:opacity-40"
          >
            <Minus size={14} />
          </button>
          <span className="min-w-8 text-center text-[12px] font-semibold tabular-nums">
            {value}/{habit.target}
          </span>
          <button
            type="button"
            aria-label={`${t.habits.plus}: ${habit.name}`}
            onClick={() => set(value + 1)}
            className="flex size-7 items-center justify-center rounded-full text-white"
            style={{ background: habit.color }}
          >
            <Plus size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

/* ---------- Вечер ---------- */

export function EveningCard() {
  const today = todayKey()
  const hasMood = useLiveQuery(async () => !!(await db.days.get(today))?.mood, [today])
  if (new Date().getHours() < 20 || hasMood === undefined) return null
  return (
    <Link to="/wins/day/today" className="block">
      <Card className="flex items-center gap-3 p-4">
        <Moon size={26} className="shrink-0 text-accent" />
        <span className="flex-1">
          <span className="block font-semibold">{t.wins.eveningTitle}</span>
          <span className="block text-[14px] text-muted">{t.wins.eveningText}</span>
        </span>
        <ChevronRight size={20} className="text-muted" />
      </Card>
    </Link>
  )
}

/* ---------- Люди: дни рождения и «давно не общался» ---------- */

export function PeopleNudges() {
  const today = todayKey()
  const people = useLiveQuery(() => db.people.toArray(), [])
  if (!people || people.length === 0) return null
  const bdays = upcomingBirthdays(people, today, 7)
  const contacts = overdueContacts(people, today, 3)
  if (bdays.length === 0 && contacts.length === 0) return null

  return (
    <div className="space-y-3">
      {bdays.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <Cake size={19} className="text-pink" /> {t.today.birthdays}
          </h2>
          <ul className="space-y-1">
            {bdays.map(({ person, daysLeft, turns }) => (
              <li key={person.id}>
                <Link to={`/people/${person.id}`} className="flex min-h-11 items-center gap-3">
                  <Avatar person={person} size={36} />
                  <span className="flex-1">
                    <span className="font-medium">{person.name}</span>{' '}
                    <span className={daysLeft === 0 ? 'font-semibold text-pink' : 'text-muted'}>
                      {t.today.birthdayWhen(daysLeft)}
                    </span>
                    {turns && <span className="text-muted"> · {t.people.turns(turns)}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {contacts.length > 0 && (
        <Card className="p-4">
          <h2 className="font-semibold">{t.today.contacts}</h2>
          <p className="mb-2 text-[14px] text-muted">{t.today.contactsHint}</p>
          <ul className="space-y-1">
            {contacts.map((p) => (
              <li key={p.id}>
                <Link to={`/people/${p.id}`} className="flex min-h-11 items-center gap-3">
                  <Avatar person={p} size={36} />
                  <span className="flex-1 font-medium">{p.name}</span>
                  <ChevronRight size={18} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

/* ---------- Знакомство: имя при первом запуске ---------- */

export function NameCard() {
  const { name } = usePrefs()
  const [value, setValue] = useState('')
  if (name.trim()) return null
  return (
    <Card className="p-4">
      <p className="text-[17px] font-semibold">{t.today.hello} 👋</p>
      <p className="mb-3 text-[15px] text-muted">{t.today.helloText}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (value.trim()) setPrefs({ name: value.trim() })
        }}
        className="flex gap-2"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t.settings.namePlaceholder}
          aria-label={t.settings.name}
          autoComplete="given-name"
          enterKeyHint="done"
          className="min-h-12 min-w-0 flex-1 rounded-2xl bg-surface-2 px-4 outline-none ring-accent focus:ring-2 placeholder:text-muted"
        />
        <button type="submit" disabled={!value.trim()} className="min-h-12 rounded-2xl bg-accent px-4 font-semibold text-on-accent disabled:opacity-40">
          {t.today.helloSave}
        </button>
      </form>
    </Card>
  )
}

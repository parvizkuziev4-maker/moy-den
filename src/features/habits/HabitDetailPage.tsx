import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, ArchiveRestore, CalendarPlus, Flame, NotebookPen, Pencil, Trash2, Trophy } from 'lucide-react'
import { Page, Card } from '../../components/Page'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import { deleteHabit, restoreHabit, setHabitNote, updateHabit } from '../../db/habits'
import type { DayKey, Habit } from '../../db/types'
import { addDaysKey, dayLabel, parseDay, todayKey } from '../../lib/dates'
import { completionRate, streaks } from '../../lib/streaks'
import { showToast } from '../../lib/toast'
import { format } from 'date-fns'
import { ru as ruLocale } from 'date-fns/locale'
import { useSoftMode } from './useHabitData'
import { HabitControl } from './HabitControl'
import { HabitFormSheet } from './HabitForm'
import { Heatmap } from './Heatmap'
import { habitEvent, icsFileName } from '../../lib/ics'
import { usePrefs } from '../../lib/prefs'
import { shareIcs } from '../settings/SettingsSections'
import { t } from '../../i18n/ru'

export function HabitDetailPage() {
  const { id = '' } = useParams()
  const habit = useLiveQuery(() => db.habits.get(id), [id])
  const logs = useLiveQuery(() => db.habitLogs.where('habitId').equals(id).toArray(), [id])

  if (habit === undefined || logs === undefined) {
    return <Page title="" back>{null}</Page>
  }
  return <Detail habit={habit} logRows={logs} />
}

function Detail({ habit, logRows }: { habit: Habit; logRows: { date: DayKey; value: number; note: string }[] }) {
  const navigate = useNavigate()
  const soft = useSoftMode()
  const { reminderLeadMinutes } = usePrefs()
  const today = todayKey()
  const [editing, setEditing] = useState(false)
  const [noteDay, setNoteDay] = useState<DayKey | null>(null)

  const logs = new Map(logRows.map((l) => [l.date, l.value]))
  const notes = new Map(logRows.filter((l) => l.note).map((l) => [l.date, l.note]))
  const s = streaks(habit, logs, today, soft)
  const rates = [7, 30, 365].map((n) => [n, completionRate(habit, logs, today, n)] as const)
  const last7 = Array.from({ length: 7 }, (_, i) => addDaysKey(today, -i))
  const noteList = [...notes.entries()].sort((a, b) => b[0].localeCompare(a[0]))

  async function remove() {
    const snap = await deleteHabit(habit.id)
    navigate('/habits', { replace: true })
    if (snap) showToast(t.habits.deleted, { label: t.plan.undo, run: () => void restoreHabit(snap) })
  }

  return (
    <Page
      title={
        <span className="flex items-center gap-2">
          <span aria-hidden>{habit.emoji}</span> {habit.name}
        </span>
      }
      subtitle={t.habits.since(format(parseDay(habit.startDate), 'd MMMM yyyy', { locale: ruLocale }))}
      back
      actions={
        <button
          type="button"
          aria-label={t.habits.edit}
          onClick={() => setEditing(true)}
          className="flex size-11 items-center justify-center rounded-full bg-surface text-muted shadow-soft"
        >
          <Pencil size={20} />
        </button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="flex items-center gap-1 text-[13px] text-muted">
              <Flame size={15} className="text-warn" /> {t.habits.currentStreak}
            </p>
            <p className="mt-1 text-[24px] font-bold">{t.habits.streak(s.current, s.unit)}</p>
          </Card>
          <Card className="p-4">
            <p className="flex items-center gap-1 text-[13px] text-muted">
              <Trophy size={15} className="text-[#d4a03a]" /> {t.habits.bestStreak}
            </p>
            <p className="mt-1 text-[24px] font-bold">{t.habits.streak(s.best, s.unit)}</p>
          </Card>
        </div>
        {s.current === 0 && s.best > 0 && <p className="px-1 text-[15px] text-muted">{t.habits.restart}</p>}

        <div className="grid grid-cols-3 gap-3">
          {rates.map(([n, r]) => (
            <Card key={n} className="p-3 text-center">
              <p className="text-[22px] font-bold" style={{ color: r !== null ? habit.color : undefined }}>
                {r === null ? t.habits.noData : `${Math.round(r * 100)}%`}
              </p>
              <p className="text-[12px] text-muted">{t.habits.rate(n)}</p>
            </Card>
          ))}
        </div>

        <Card className="p-4">
          <h2 className="mb-3 font-semibold">{t.habits.year}</h2>
          <Heatmap habit={habit} logs={logs} today={today} weekStartsOn={soft.weekStartsOn} />
          {soft.enabled && <p className="mt-3 text-[13px] text-muted">{t.habits.softOn}</p>}
        </Card>

        <Card className="p-2">
          <h2 className="px-2 pt-2 pb-1 font-semibold">{t.habits.lastDays}</h2>
          <ul>
            {last7.map((d) => (
              <li key={d} className="flex items-center gap-2 px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] first-letter:uppercase">{dayLabel(d, today)}</p>
                  {notes.get(d) && <p className="truncate text-[13px] text-muted">{notes.get(d)}</p>}
                </div>
                <button
                  type="button"
                  aria-label={t.habits.noteFor(dayLabel(d, today))}
                  onClick={() => setNoteDay(d)}
                  className={`flex size-11 items-center justify-center rounded-full ${notes.get(d) ? 'text-accent' : 'text-muted'}`}
                >
                  <NotebookPen size={19} />
                </button>
                <HabitControl habit={habit} date={d} value={logs.get(d) ?? 0} size="sm" />
              </li>
            ))}
          </ul>
        </Card>

        {noteList.length > 0 && (
          <Card className="p-4">
            <h2 className="mb-2 font-semibold">{t.habits.notes}</h2>
            <ul className="space-y-2">
              {noteList.map(([d, n]) => (
                <li key={d}>
                  <p className="text-[13px] text-muted first-letter:uppercase">{dayLabel(d, today)}</p>
                  <p className="text-[15px] whitespace-pre-wrap">{n}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="space-y-2 pt-2">
          {habit.reminderTime ? (
            <button
              type="button"
              onClick={() => {
                const e = habitEvent(habit, reminderLeadMinutes)
                if (e) void shareIcs([e], icsFileName(habit.name))
              }}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent-soft font-semibold text-accent"
            >
              <CalendarPlus size={18} /> {t.remind.add} · {habit.reminderTime}
            </button>
          ) : (
            <p className="px-1 text-center text-[13px] text-muted">{t.habits.reminderHint}</p>
          )}
          <button
            type="button"
            onClick={() => {
              void updateHabit(habit.id, { archived: !habit.archived })
              if (!habit.archived) {
                showToast(t.habits.archived, {
                  label: t.plan.undo,
                  run: () => void updateHabit(habit.id, { archived: false }),
                })
                navigate('/habits', { replace: true })
              }
            }}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface-2 font-semibold"
          >
            {habit.archived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
            {habit.archived ? t.habits.unarchive : t.habits.archive}
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface-2 font-semibold text-danger"
          >
            <Trash2 size={18} /> {t.habits.delete}
          </button>
        </div>
      </div>

      <HabitFormSheet open={editing} onClose={() => setEditing(false)} habit={habit} />
      <NoteSheet habit={habit} day={noteDay} note={noteDay ? (notes.get(noteDay) ?? '') : ''} onClose={() => setNoteDay(null)} />
    </Page>
  )
}

function NoteSheet({
  habit,
  day,
  note,
  onClose,
}: {
  habit: Habit
  day: DayKey | null
  note: string
  onClose: () => void
}) {
  return (
    <Sheet open={day !== null} onClose={onClose} title={day ? t.habits.noteFor(dayLabel(day)) : ''}>
      {day && <NoteForm key={day} habitId={habit.id} day={day} initial={note} onDone={onClose} />}
    </Sheet>
  )
}

function NoteForm({ habitId, day, initial, onDone }: { habitId: string; day: DayKey; initial: string; onDone: () => void }) {
  const [text, setText] = useState(initial)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void setHabitNote(habitId, day, text.trim()).then(onDone)
      }}
    >
      <textarea
        autoFocus
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.habits.notePlaceholder}
        className="w-full resize-none rounded-xl bg-surface p-3 text-[16px] outline-none ring-accent focus:ring-2 placeholder:text-muted"
      />
      <button type="submit" className="mt-3 min-h-12 w-full rounded-2xl bg-accent font-semibold text-on-accent">
        {t.habits.save}
      </button>
    </form>
  )
}

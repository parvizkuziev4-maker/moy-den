import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarPlus, Check, Plus, Trash2, X } from 'lucide-react'
import { Sheet } from '../../components/Sheet'
import { Chip } from '../../components/Segmented'
import { db } from '../../db/db'
import { updateTask } from '../../db/tasks'
import type { Priority, Repeat, Task } from '../../db/types'
import { addDaysKey, parseDay, todayKey } from '../../lib/dates'
import { newId } from '../../lib/id'
import { taskActions, usePlan } from './PlanContext'
import { icsFileName, taskEvent } from '../../lib/ics'
import { usePrefs } from '../../lib/prefs'
import { shareIcs } from '../settings/SettingsSections'
import { t } from '../../i18n/ru'

function Label({ children }: { children: string }) {
  return <h3 className="mt-5 mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">{children}</h3>
}

const inputCls =
  'min-h-11 rounded-xl bg-surface px-3 text-[16px] outline-none ring-accent focus:ring-2 placeholder:text-muted'

/** Карточка задачи: всё редактируется сразу, без кнопки «Сохранить». */
export function TaskSheet({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const task = useLiveQuery(() => (taskId ? db.tasks.get(taskId) : undefined), [taskId])
  return (
    <Sheet open={taskId !== null && task !== undefined} onClose={onClose} title={t.task.title}>
      {task && <TaskForm key={task.id} task={task} onClose={onClose} />}
    </Sheet>
  )
}

function TaskForm({ task, onClose }: { task: Task; onClose: () => void }) {
  const { areas, people } = usePlan()
  const { reminderLeadMinutes } = usePrefs()
  const today = todayKey()
  const tomorrow = addDaysKey(today, 1)

  // Название и заметки храним локально, пишем в базу при уходе с поля — так курсор не прыгает.
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)
  const [newSub, setNewSub] = useState('')
  // draft — что сейчас в полях, saved — что уже записано в базе
  const draft = useRef({ title: task.title, notes: task.notes })
  const saved = useRef({ title: task.title, notes: task.notes })
  const taskId = task.id

  const saveText = useCallback(() => {
    const tt = draft.current.title.trim()
    const patch: Partial<Task> = {}
    if (tt && tt !== saved.current.title) patch.title = tt
    if (draft.current.notes !== saved.current.notes) patch.notes = draft.current.notes
    if (Object.keys(patch).length === 0) return
    saved.current = { ...saved.current, ...patch }
    void updateTask(taskId, patch)
  }, [taskId])
  // Сохраняем и при закрытии шторки
  useEffect(() => saveText, [saveText])

  const set = (patch: Partial<Task>) => void updateTask(task.id, patch)

  function setRepeat(kind: Repeat['kind']) {
    const base = task.date || today
    const r: Repeat =
      kind === 'custom'
        ? { kind, days: [task.date ? ((parseDay(base).getDay() + 6) % 7) + 1 : 1] }
        : kind === 'monthly'
          ? { kind, day: parseDay(base).getDate() }
          : { kind }
    set({ repeat: r, date: task.date || (kind === 'none' ? '' : today) })
  }

  function addSub() {
    const v = newSub.trim()
    if (!v) return
    set({ subtasks: [...task.subtasks, { id: newId(), title: v, done: false }] })
    setNewSub('')
  }

  const peopleList = [...people.values()]

  return (
    <div className="pb-4">
      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          draft.current.title = e.target.value
        }}
        onBlur={saveText}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        placeholder={t.task.titlePlaceholder}
        aria-label={t.task.titlePlaceholder}
        className={`${inputCls} w-full text-[18px] font-semibold`}
      />

      <Label>{t.task.date}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={task.date === ''} onClick={() => set({ date: '' })}>
          {t.task.inbox}
        </Chip>
        <Chip active={task.date === today} onClick={() => set({ date: today })}>
          {t.dates.today}
        </Chip>
        <Chip active={task.date === tomorrow} onClick={() => set({ date: tomorrow })}>
          {t.dates.tomorrow}
        </Chip>
        <input
          type="date"
          value={task.date}
          onChange={(e) => set({ date: e.target.value })}
          aria-label={t.task.date}
          className={inputCls}
        />
      </div>

      <Label>{t.task.time}</Label>
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={task.time ?? ''}
          onChange={(e) => set({ time: e.target.value || undefined })}
          aria-label={t.task.time}
          className={inputCls}
        />
        {task.time && (
          <button
            type="button"
            onClick={() => set({ time: undefined })}
            className="min-h-11 rounded-xl px-3 text-[15px] text-muted"
          >
            {t.task.noTime}
          </button>
        )}
      </div>

      {task.time ? (
        <button
          type="button"
          onClick={() => {
            const e = taskEvent(task, reminderLeadMinutes)
            if (e) void shareIcs([e], icsFileName(task.title))
          }}
          className="mt-2 flex min-h-11 items-center gap-2 rounded-xl bg-accent-soft px-3 text-[15px] font-semibold text-accent"
        >
          <CalendarPlus size={18} /> {t.remind.add}
        </button>
      ) : (
        <p className="mt-1.5 text-[13px] text-muted">{t.remind.needTime}</p>
      )}

      <Label>{t.task.priority}</Label>
      <div className="flex flex-wrap gap-2">
        {([1, 2, 3] as Priority[]).map((p) => (
          <Chip key={p} active={task.priority === p} onClick={() => set({ priority: p })}>
            {t.priority[p]}
          </Chip>
        ))}
      </div>

      <Label>{t.task.area}</Label>
      <div className="flex flex-wrap gap-2">
        <Chip active={!task.areaId} onClick={() => set({ areaId: undefined })}>
          {t.task.noArea}
        </Chip>
        {[...areas.values()].map((a) => (
          <Chip key={a.id} active={task.areaId === a.id} color={a.color} onClick={() => set({ areaId: a.id })}>
            <span aria-hidden>{a.emoji}</span> {a.name}
          </Chip>
        ))}
      </div>

      <Label>{t.task.repeat}</Label>
      <div className="flex flex-wrap gap-2">
        {(['none', 'daily', 'weekdays', 'weekly', 'monthly', 'custom'] as const).map((k) => (
          <Chip key={k} active={task.repeat.kind === k} onClick={() => setRepeat(k)}>
            {t.repeat[k]}
          </Chip>
        ))}
      </div>
      {task.repeat.kind === 'custom' && (
        <div className="mt-2 flex gap-1.5">
          {t.task.weekdays.map((name, i) => {
            const day = i + 1
            const r = task.repeat as Extract<Repeat, { kind: 'custom' }>
            const on = r.days.includes(day)
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  set({ repeat: { kind: 'custom', days: on ? r.days.filter((d) => d !== day) : [...r.days, day] } })
                }
                className={`size-11 rounded-full text-[14px] font-semibold ${on ? 'bg-accent text-on-accent' : 'bg-surface-2'}`}
              >
                {name}
              </button>
            )
          })}
        </div>
      )}

      <Label>{t.task.subtasks}</Label>
      <ul className="space-y-1">
        {task.subtasks.map((s) => (
          <li key={s.id} className="flex items-center gap-1 rounded-xl bg-surface pr-1">
            <button
              type="button"
              role="checkbox"
              aria-checked={s.done}
              aria-label={s.title}
              onClick={() =>
                set({ subtasks: task.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })
              }
              className="flex size-11 items-center justify-center"
            >
              <span
                className={`flex size-5 items-center justify-center rounded-md border-2 ${s.done ? 'border-accent bg-accent text-on-accent' : 'border-line'}`}
              >
                {s.done && <Check size={13} strokeWidth={3.5} />}
              </span>
            </button>
            <span className={`flex-1 text-[15px] ${s.done ? 'text-muted line-through' : ''}`}>{s.title}</span>
            <button
              type="button"
              aria-label={`${t.plan.delete}: ${s.title}`}
              onClick={() => set({ subtasks: task.subtasks.filter((x) => x.id !== s.id) })}
              className="flex size-11 items-center justify-center text-muted"
            >
              <X size={18} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-1.5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          addSub()
        }}
      >
        <input
          value={newSub}
          onChange={(e) => setNewSub(e.target.value)}
          placeholder={t.task.addSubtask}
          aria-label={t.task.addSubtask}
          enterKeyHint="done"
          className={`${inputCls} flex-1`}
        />
        <button
          type="submit"
          aria-label={t.task.addSubtask}
          className="flex size-11 items-center justify-center rounded-xl bg-surface-2 text-accent"
        >
          <Plus size={22} />
        </button>
      </form>

      <Label>{t.task.person}</Label>
      {peopleList.length === 0 ? (
        <p className="text-[14px] text-muted">{t.task.noPeopleYet}</p>
      ) : (
        <select
          value={task.personId ?? ''}
          onChange={(e) => set({ personId: e.target.value || undefined })}
          aria-label={t.task.person}
          className={`${inputCls} w-full`}
        >
          <option value="">{t.task.noPerson}</option>
          {peopleList.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      <Label>{t.task.notes}</Label>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value)
          draft.current.notes = e.target.value
        }}
        onBlur={saveText}
        rows={3}
        placeholder={t.task.notesPlaceholder}
        aria-label={t.task.notes}
        className={`${inputCls} w-full resize-none py-2.5`}
      />

      <button
        type="button"
        onClick={() => {
          onClose()
          void taskActions.remove(task)
        }}
        className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface-2 font-semibold text-danger"
      >
        <Trash2 size={18} /> {t.task.delete}
      </button>
    </div>
  )
}

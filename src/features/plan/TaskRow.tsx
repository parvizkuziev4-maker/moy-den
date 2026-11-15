import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { ArrowRight, Check, Clock, Flag, ListChecks, Repeat, Trash2, User } from 'lucide-react'
import type { Task } from '../../db/types'
import { dayLabel } from '../../lib/dates'
import { repeatLabel } from '../../lib/recurrence'
import { taskActions, usePlan } from './PlanContext'
import { t } from '../../i18n/ru'

const ACTIONS_W = 160 // ширина кнопок «Завтра» и «Удалить» под строкой
const DONE_AT = 72 // насколько протянуть вправо, чтобы выполнить

interface Props {
  task: Task
  /** Показать дату (в поиске и просроченных) */
  showDate?: boolean
  /** Ручка для перетаскивания (в «Неделе») */
  handle?: ReactNode
}

/**
 * Строка задачи.
 * Свайп вправо — выполнить. Свайп влево — кнопки «Завтра» и «Удалить». Нажатие — открыть карточку.
 */
export function TaskRow({ task, showDate, handle }: Props) {
  const { areas, people, openTask } = usePlan()
  const area = task.areaId ? areas.get(task.areaId) : undefined
  const person = task.personId ? people.get(task.personId) : undefined

  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [open, setOpen] = useState(false)
  const [pop, setPop] = useState(0)
  const gesture = useRef<{ x: number; y: number; base: number; axis: 'x' | 'y' | null } | null>(null)
  const moved = useRef(false)

  const offset = dragging ? dx : open ? -ACTIONS_W : 0

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    gesture.current = { x: e.clientX, y: e.clientY, base: open ? -ACTIONS_W : 0, axis: null }
    moved.current = false
  }
  function onPointerMove(e: PointerEvent) {
    const g = gesture.current
    if (!g) return
    const mx = e.clientX - g.x
    const my = e.clientY - g.y
    if (g.axis === null) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return
      g.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
      if (g.axis === 'x') {
        e.currentTarget.setPointerCapture(e.pointerId)
        setDragging(true)
        moved.current = true
      }
    }
    if (g.axis !== 'x') return
    setDx(Math.max(-ACTIONS_W - 40, Math.min(DONE_AT + 40, g.base + mx)))
  }
  function onPointerEnd() {
    const g = gesture.current
    gesture.current = null
    if (!g || g.axis !== 'x') return
    setDragging(false)
    if (dx >= DONE_AT) {
      setOpen(false)
      void toggle()
    } else {
      setOpen(dx < -ACTIONS_W / 2)
    }
  }

  async function toggle() {
    setPop((n) => n + 1)
    await taskActions.toggle(task)
  }

  const subDone = task.subtasks.filter((s) => s.done).length
  const meta: ReactNode[] = []
  if (showDate) meta.push(<span key="d">{task.date ? dayLabel(task.date) : t.plan.views.inbox}</span>)
  if (task.time)
    meta.push(
      <span key="t" className="flex items-center gap-1">
        <Clock size={13} /> {task.time}
      </span>,
    )
  if (area)
    meta.push(
      <span key="a" className="flex items-center gap-1">
        <span className="size-2 rounded-full" style={{ background: area.color }} /> {area.name}
      </span>,
    )
  if (task.subtasks.length)
    meta.push(
      <span key="s" className="flex items-center gap-1">
        <ListChecks size={13} /> {subDone}/{task.subtasks.length}
      </span>,
    )
  if (task.repeat.kind !== 'none')
    meta.push(
      <span key="r" className="flex items-center gap-1" title={repeatLabel(task.repeat)}>
        <Repeat size={13} /> {repeatLabel(task.repeat)}
      </span>,
    )
  if (person)
    meta.push(
      <span key="p" className="flex items-center gap-1">
        <User size={13} /> {person.name}
      </span>,
    )

  return (
    <li className="relative overflow-hidden rounded-2xl">
      {/* Что видно под строкой при свайпе */}
      <div className="absolute inset-0 flex" aria-hidden={!open}>
        <div
          className="flex flex-1 items-center bg-accent pl-5 text-on-accent"
          style={{ opacity: offset > 0 ? Math.min(1, offset / DONE_AT) : 0 }}
        >
          <Check size={24} strokeWidth={3} />
          <span className="ml-2 font-semibold">{task.done ? t.plan.markUndone : t.plan.complete}</span>
        </div>
        <div className="flex" style={{ width: ACTIONS_W, visibility: offset < 0 ? 'visible' : 'hidden' }}>
          <button
            type="button"
            tabIndex={open ? 0 : -1}
            onClick={() => {
              setOpen(false)
              void taskActions.tomorrow(task)
            }}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 bg-[#3678b4] text-[13px] font-semibold text-white"
          >
            <ArrowRight size={20} /> {t.plan.tomorrow}
          </button>
          <button
            type="button"
            tabIndex={open ? 0 : -1}
            onClick={() => {
              setOpen(false)
              void taskActions.remove(task)
            }}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 bg-danger-solid text-[13px] font-semibold text-white"
          >
            <Trash2 size={20} /> {t.plan.delete}
          </button>
        </div>
      </div>

      <div
        className={`relative flex items-start gap-1 bg-surface py-1.5 pr-3 pl-1 ${dragging ? '' : 'transition-transform duration-200'}`}
        style={{ transform: `translateX(${offset}px)`, touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={task.done}
          aria-label={task.done ? t.plan.markUndone : t.plan.markDone}
          onClick={() => void toggle()}
          className="flex size-11 shrink-0 items-center justify-center"
        >
          <span
            key={pop}
            className={`flex size-6 items-center justify-center rounded-full border-2 transition-colors ${
              pop ? 'animate-pop' : ''
            } ${task.done ? 'border-accent bg-accent text-on-accent' : task.priority === 1 ? 'border-accent' : 'border-line'}`}
          >
            {task.done && <Check size={15} strokeWidth={3.5} />}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (moved.current) return
            if (open) return setOpen(false)
            openTask(task.id)
          }}
          className="min-h-11 min-w-0 flex-1 py-2.5 text-left"
        >
          <span className="flex items-start gap-1.5">
            <span
              className={`text-[16px] leading-snug break-words ${task.done ? 'text-muted line-through' : ''}`}
            >
              {task.title}
            </span>
            {task.priority === 1 && !task.done && (
              <Flag size={14} className="mt-1 shrink-0 text-accent" aria-label={t.priority[1]} />
            )}
          </span>
          {meta.length > 0 && (
            <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted">
              {meta}
            </span>
          )}
        </button>
        {handle}
      </div>
    </li>
  )
}

export function TaskList({ tasks, showDate }: { tasks: Task[]; showDate?: boolean }) {
  return (
    <ul className="space-y-1.5">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} showDate={showDate} />
      ))}
    </ul>
  )
}

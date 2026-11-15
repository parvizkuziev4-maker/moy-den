import { createContext, useContext } from 'react'
import { db } from '../../db/db'
import type { Area, DayKey, Person, Task } from '../../db/types'
import { deleteTask, moveTasks, restoreTask, toggleTask, tomorrowFor } from '../../db/tasks'
import { dayLabel, todayKey } from '../../lib/dates'
import { showToast } from '../../lib/toast'
import { confetti } from '../../lib/confetti'
import { t } from '../../i18n/ru'

export interface PlanCtx {
  areas: Map<string, Area>
  people: Map<string, Person>
  openTask: (id: string) => void
}

export const PlanContext = createContext<PlanCtx>({
  areas: new Map(),
  people: new Map(),
  openTask: () => {},
})

export const usePlan = () => useContext(PlanContext)

// Действия с задачами + сообщения и «Отменить». Используются и в «Плане», и на экране «Сегодня».
export const taskActions = {
  async toggle(task: Task) {
    const nowDone = await toggleTask(task.id)
    if (!nowDone || !task.date) return
    // Все задачи этого дня выполнены — праздник!
    const rest = await db.tasks.where('date').equals(task.date).filter((x) => !x.done).count()
    if (rest === 0) {
      confetti()
      showToast(t.plan.allDone)
    }
  },

  async remove(task: Task) {
    const snap = await deleteTask(task.id)
    if (snap) showToast(t.plan.deleted, { label: t.plan.undo, run: () => void restoreTask(snap) })
  },

  async move(task: Task, date: DayKey | '') {
    if (task.date === date) return
    const prev = task.date
    await moveTasks([task.id], date)
    const label = date ? dayLabel(date) : t.plan.views.inbox
    showToast(t.plan.movedTo(label), { label: t.plan.undo, run: () => void moveTasks([task.id], prev) })
  },

  async tomorrow(task: Task) {
    await taskActions.move(task, tomorrowFor(task, todayKey()))
  },

  async moveMany(tasks: Task[], date: DayKey) {
    if (tasks.length === 0) return
    const before = tasks.map((x) => [x.id, x.date] as const)
    await moveTasks(
      tasks.map((x) => x.id),
      date,
    )
    showToast(t.plan.movedTo(dayLabel(date)), {
      label: t.plan.undo,
      run: () => void Promise.all(before.map(([id, d]) => moveTasks([id], d))),
    })
  },
}

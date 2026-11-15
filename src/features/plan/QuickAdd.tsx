import { useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { Sheet } from '../../components/Sheet'
import { Chip } from '../../components/Segmented'
import { addTask } from '../../db/tasks'
import type { DayKey } from '../../db/types'
import { addDaysKey, dayLabel, todayKey } from '../../lib/dates'
import { showToast } from '../../lib/toast'
import { t } from '../../i18n/ru'

/** Быстрое добавление: одна строка и Enter. Шторка остаётся открытой — можно добавить несколько подряд. */
export function QuickAdd({
  open,
  onClose,
  defaultDate,
}: {
  open: boolean
  onClose: () => void
  defaultDate: DayKey | ''
}) {
  return (
    <Sheet open={open} onClose={onClose} title={t.plan.add}>
      {open && <QuickAddForm key={defaultDate} defaultDate={defaultDate} />}
    </Sheet>
  )
}

function QuickAddForm({ defaultDate }: { defaultDate: DayKey | '' }) {
  const today = todayKey()
  const tomorrow = addDaysKey(today, 1)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState<DayKey | ''>(defaultDate)
  const [count, setCount] = useState(0)

  const options: (DayKey | '')[] = [today, tomorrow, '']
  if (defaultDate && !options.includes(defaultDate)) options.unshift(defaultDate)

  async function submit() {
    const v = title.trim()
    if (!v) return
    setTitle('') // очищаем сразу, чтобы следующий текст не склеился с этим
    await addTask({ title: v, date })
    setCount((n) => n + 1)
    showToast(`${t.plan.added}: ${v}`)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.plan.addPlaceholder}
          aria-label={t.plan.addPlaceholder}
          enterKeyHint="send"
          className="min-h-12 flex-1 rounded-2xl bg-surface px-4 text-[17px] outline-none ring-accent focus:ring-2 placeholder:text-muted"
        />
        <button
          type="submit"
          aria-label={t.plan.addButton}
          disabled={!title.trim()}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition disabled:opacity-40"
        >
          <ArrowUp size={24} strokeWidth={2.6} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((d) => (
          <Chip key={d || 'inbox'} active={date === d} onClick={() => setDate(d)}>
            {d ? dayLabel(d, today) : t.plan.views.inbox}
          </Chip>
        ))}
      </div>
      {count > 0 && <p className="mt-3 text-[14px] text-muted">+{count} ✓</p>}
    </form>
  )
}

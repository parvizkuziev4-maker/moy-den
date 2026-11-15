import { useState } from 'react'
import { Check, Minus, Plus } from 'lucide-react'
import type { DayKey, Habit } from '../../db/types'
import { isDoneValue } from '../../lib/streaks'
import { usePrefs } from '../../lib/prefs'
import { setValueWithCelebration } from './useHabitData'
import { t } from '../../i18n/ru'

/** Кнопка отметки привычки: кружок для «да/нет», − и + для счётчика. */
export function HabitControl({
  habit,
  date,
  value,
  size = 'md',
}: {
  habit: Habit
  date: DayKey
  value: number
  size?: 'md' | 'sm'
}) {
  const { weekStartsOn } = usePrefs()
  const done = isDoneValue(habit, value)
  const [pop, setPop] = useState(0)
  const set = (v: number) => {
    setPop((n) => n + 1)
    void setValueWithCelebration(habit, date, v, weekStartsOn)
  }
  const circle = size === 'md' ? 'size-12' : 'size-10'

  if (habit.type === 'check') {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? t.habits.unmark(habit.name) : t.habits.markDone(habit.name)}
        onClick={(e) => {
          e.stopPropagation()
          set(done ? 0 : 1)
        }}
        className={`flex shrink-0 items-center justify-center rounded-full border-[2.5px] transition-colors ${circle} ${pop ? 'animate-pop' : ''}`}
        key={pop}
        style={{ borderColor: habit.color, background: done ? habit.color : 'transparent', color: '#fff' }}
      >
        {done && <Check size={size === 'md' ? 26 : 20} strokeWidth={3.2} />}
      </button>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={`${t.habits.minus}: ${habit.name}`}
        disabled={value <= 0}
        onClick={() => set(value - 1)}
        className="flex size-11 items-center justify-center rounded-full bg-surface-2 disabled:opacity-40"
      >
        <Minus size={20} />
      </button>
      <span
        key={pop}
        className={`min-w-9 text-center text-[17px] font-bold tabular-nums ${pop ? 'animate-pop' : ''}`}
        style={{ color: done ? habit.color : undefined }}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={`${t.habits.plus}: ${habit.name}`}
        onClick={() => set(value + 1)}
        className="flex size-11 items-center justify-center rounded-full text-white"
        style={{ background: habit.color }}
      >
        <Plus size={22} strokeWidth={2.6} />
      </button>
    </div>
  )
}

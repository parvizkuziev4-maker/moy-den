import { useState } from 'react'
import { Check } from 'lucide-react'
import { Sheet } from '../../components/Sheet'
import { Chip, Segmented } from '../../components/Segmented'
import { HABIT_TEMPLATES, addHabit, updateHabit, type HabitTemplate } from '../../db/habits'
import type { Habit, HabitSchedule } from '../../db/types'
import { showToast } from '../../lib/toast'
import { useHabits } from './useHabitData'
import { t } from '../../i18n/ru'

const EMOJIS = ['✨', '💧', '🏃', '📖', '🎓', '🤲', '🚶', '🌅', '🍏', '🌙', '💪', '🧘', '✍️', '💊', '🥗', '📵', '💰', '❤️', '🎯', '🙏']
const COLORS = ['#e8913a', '#e5654b', '#d9578a', '#8b6fd6', '#3b82c4', '#2a9d82', '#5aa55a', '#d4a03a']

const inputCls =
  'min-h-11 w-full rounded-xl bg-surface px-3 text-[16px] outline-none ring-accent focus:ring-2 placeholder:text-muted'

function Label({ children }: { children: string }) {
  return <h3 className="mt-5 mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">{children}</h3>
}

/** Шторка: новая привычка (шаблоны + своя) или изменение существующей. */
export function HabitFormSheet({
  open,
  onClose,
  habit,
}: {
  open: boolean
  onClose: () => void
  habit?: Habit
}) {
  return (
    <Sheet open={open} onClose={onClose} title={habit ? t.habits.edit : t.habits.add}>
      {open && (habit ? <HabitForm habit={habit} onDone={onClose} /> : <NewHabit onDone={onClose} />)}
    </Sheet>
  )
}

function NewHabit({ onDone }: { onDone: () => void }) {
  const existing = useHabits()
  const names = new Set(existing.map((h) => h.name))
  const left = HABIT_TEMPLATES.filter((tpl) => !names.has(tpl.name))

  async function addTemplate(tpl: HabitTemplate) {
    const { key: _k, ...rest } = tpl
    void _k
    await addHabit(rest)
    showToast(t.habits.added(tpl.name))
  }

  return (
    <>
      {left.length > 0 && (
        <>
          <h3 className="mb-1 text-[13px] font-semibold tracking-wide text-muted uppercase">{t.habits.templates}</h3>
          <p className="mb-2 text-[14px] text-muted">{t.habits.templatesHint}</p>
          <div className="flex flex-wrap gap-2">
            {left.map((tpl) => (
              <button
                key={tpl.key}
                type="button"
                onClick={() => void addTemplate(tpl)}
                className="flex min-h-11 items-center gap-1.5 rounded-full bg-surface px-3.5 text-[15px] font-medium shadow-soft active:scale-95"
              >
                <span aria-hidden>{tpl.emoji}</span> {tpl.name}
              </button>
            ))}
          </div>
          <h3 className="mt-6 text-[13px] font-semibold tracking-wide text-muted uppercase">{t.habits.custom}</h3>
        </>
      )}
      <HabitForm onDone={onDone} />
    </>
  )
}

function HabitForm({ habit, onDone }: { habit?: Habit; onDone: () => void }) {
  const [name, setName] = useState(habit?.name ?? '')
  const [emoji, setEmoji] = useState(habit?.emoji ?? '✨')
  const [color, setColor] = useState(habit?.color ?? COLORS[0]!)
  const [type, setType] = useState<Habit['type']>(habit?.type ?? 'check')
  const [target, setTarget] = useState(habit?.target && habit.type === 'count' ? habit.target : 8)
  const [unit, setUnit] = useState(habit?.unit ?? '')
  const [schedule, setSchedule] = useState<HabitSchedule>(habit?.schedule ?? { kind: 'daily' })
  const [reminder, setReminder] = useState(habit?.reminderTime ?? '')

  async function save() {
    const n = name.trim()
    if (!n) return
    const data = {
      name: n,
      emoji: emoji.trim() || '✨',
      color,
      type,
      target: type === 'count' ? Math.max(1, target) : 1,
      unit: type === 'count' ? unit.trim() : '',
      schedule,
      reminderTime: reminder || undefined,
    }
    if (habit) {
      await updateHabit(habit.id, data)
    } else {
      await addHabit(data)
      showToast(t.habits.added(n))
    }
    onDone()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      className="pb-4"
    >
      <Label>{t.habits.name}</Label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.habits.namePlaceholder}
        aria-label={t.habits.name}
        className={inputCls}
      />

      <Label>{t.habits.emoji}</Label>
      <div className="flex flex-wrap gap-1.5">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            aria-pressed={emoji === e}
            onClick={() => setEmoji(e)}
            className={`flex size-11 items-center justify-center rounded-xl text-[22px] ${emoji === e ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface'}`}
          >
            {e}
          </button>
        ))}
        <input
          value={EMOJIS.includes(emoji) ? '' : emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="🙂"
          aria-label={t.habits.emoji}
          className="size-11 rounded-xl bg-surface text-center text-[22px] outline-none ring-accent focus:ring-2"
        />
      </div>

      <Label>{t.habits.color}</Label>
      <div className="flex flex-wrap gap-2">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={color === c}
            onClick={() => setColor(c)}
            className="flex size-11 items-center justify-center rounded-full"
            style={{ background: c, boxShadow: color === c ? `0 0 0 3px var(--bg), 0 0 0 5px ${c}` : undefined }}
          >
            {color === c && <Check size={20} color="#fff" strokeWidth={3} />}
          </button>
        ))}
      </div>

      <Label>{t.habits.type}</Label>
      <Segmented
        label={t.habits.type}
        value={type}
        onChange={setType}
        options={[
          { id: 'check', label: t.habits.typeCheck },
          { id: 'count', label: t.habits.typeCount },
        ]}
      />
      {type === 'count' && (
        <div className="mt-3 flex gap-2">
          <label className="w-28">
            <span className="mb-1 block text-[13px] text-muted">{t.habits.target}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className={inputCls}
            />
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-[13px] text-muted">{t.habits.unit}</span>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder={t.habits.unitPlaceholder}
              className={inputCls}
            />
          </label>
        </div>
      )}

      <Label>{t.habits.schedule}</Label>
      <Segmented
        label={t.habits.schedule}
        value={schedule.kind}
        onChange={(k) =>
          setSchedule(
            k === 'days' ? { kind: 'days', days: [1, 2, 3, 4, 5] } : k === 'timesPerWeek' ? { kind: 'timesPerWeek', times: 3 } : { kind: 'daily' },
          )
        }
        options={[
          { id: 'daily', label: t.habits.daily },
          { id: 'days', label: t.habits.days },
          { id: 'timesPerWeek', label: t.habits.timesPerWeek },
        ]}
      />
      {schedule.kind === 'days' && (
        <div className="mt-3 flex justify-between gap-1">
          {t.task.weekdays.map((wd, i) => {
            const day = i + 1
            const on = schedule.days.includes(day)
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setSchedule((s) => {
                    const cur = s.kind === 'days' ? s.days : []
                    return {
                      kind: 'days',
                      days: cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day].sort(),
                    }
                  })
                }
                className={`size-11 rounded-full text-[14px] font-semibold ${on ? 'bg-accent text-on-accent' : 'bg-surface'}`}
              >
                {wd}
              </button>
            )
          })}
        </div>
      )}
      {schedule.kind === 'timesPerWeek' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Chip key={n} active={schedule.times === n} onClick={() => setSchedule({ kind: 'timesPerWeek', times: n })}>
              {t.habits.timesLabel(n)}
            </Chip>
          ))}
        </div>
      )}

      <Label>{t.habits.reminder}</Label>
      <input
        type="time"
        value={reminder}
        onChange={(e) => setReminder(e.target.value)}
        aria-label={t.habits.reminder}
        className={`${inputCls} w-auto`}
      />
      <p className="mt-1 text-[13px] text-muted">{t.habits.reminderHint}</p>

      <button
        type="submit"
        disabled={!name.trim() || (schedule.kind === 'days' && schedule.days.length === 0)}
        className="mt-6 min-h-12 w-full rounded-2xl bg-accent font-semibold text-on-accent disabled:opacity-50"
      >
        {habit ? t.habits.save : t.habits.create}
      </button>
    </form>
  )
}

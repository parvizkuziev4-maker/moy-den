import { useEffect, useRef } from 'react'
import type { DayKey, Habit } from '../../db/types'
import { addDaysKey, monthLabel, parseDay, type WeekStart } from '../../lib/dates'
import { isScheduled, weekStartKey, type LogMap } from '../../lib/streaks'
import { t } from '../../i18n/ru'

const CELL = 13
const GAP = 3
const WEEKS = 53

/** Тепловая карта за год, как на GitHub: колонка — неделя, строка — день недели. */
export function Heatmap({
  habit,
  logs,
  today,
  weekStartsOn,
}: {
  habit: Habit
  logs: LogMap
  today: DayKey
  weekStartsOn: WeekStart
}) {
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // показываем самые свежие недели
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  const firstWeek = addDaysKey(weekStartKey(today, weekStartsOn), -7 * (WEEKS - 1))
  const target = habit.type === 'count' ? Math.max(1, habit.target) : 1
  const cells: React.ReactNode[] = []
  const months: React.ReactNode[] = []
  let doneCount = 0
  let lastMonth = -1

  for (let w = 0; w < WEEKS; w++) {
    const weekStart = addDaysKey(firstWeek, w * 7)
    const m = parseDay(weekStart).getMonth()
    if (m !== lastMonth) {
      if (w < WEEKS - 2) {
        months.push(
          <text key={`m${w}`} x={w * (CELL + GAP)} y={10} className="fill-muted text-[10px]">
            {monthLabel(weekStart).split(' ')[0]!.slice(0, 3)}
          </text>,
        )
      }
      lastMonth = m
    }
    for (let d = 0; d < 7; d++) {
      const day = addDaysKey(weekStart, d)
      if (day > today) continue
      const v = logs.get(day) ?? 0
      const ratio = Math.min(1, v / target)
      if (ratio >= 1) doneCount++
      const scheduled = isScheduled(habit, day)
      cells.push(
        <rect
          key={day}
          x={w * (CELL + GAP)}
          y={16 + d * (CELL + GAP)}
          width={CELL}
          height={CELL}
          rx={3}
          fill={ratio > 0 ? habit.color : 'var(--surface-2)'}
          fillOpacity={ratio > 0 ? 0.3 + 0.7 * ratio : scheduled ? 1 : 0.45}
        >
          <title>{`${day}: ${v}${habit.type === 'count' ? ` / ${target}` : ''}`}</title>
        </rect>,
      )
    }
  }

  const width = WEEKS * (CELL + GAP)
  const height = 16 + 7 * (CELL + GAP)

  return (
    <div>
      <div ref={scroller} className="-mx-1 overflow-x-auto px-1 pb-1">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${t.habits.year}: ${doneCount}`}
          className="block"
        >
          {months}
          {cells}
        </svg>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[12px] text-muted" aria-hidden>
        {t.habits.heatLess}
        {[0, 0.4, 0.7, 1].map((o) => (
          <span
            key={o}
            className="inline-block size-3 rounded-[3px]"
            style={{ background: o ? habit.color : 'var(--surface-2)', opacity: o ? 0.3 + 0.7 * o : 1 }}
          />
        ))}
        {t.habits.heatMore}
      </div>
    </div>
  )
}

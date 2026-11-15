import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowUp, CircleCheck, Repeat, Sparkles, Star, Trash2 } from 'lucide-react'
import { Card } from '../../components/Page'
import { Sheet } from '../../components/Sheet'
import { Chip } from '../../components/Segmented'
import { db } from '../../db/db'
import { addWin, deleteWin, restoreWin, updateWin } from '../../db/wins'
import type { Area, Win, WinSize } from '../../db/types'
import { dayLabel, todayKey } from '../../lib/dates'
import { showToast } from '../../lib/toast'
import { confetti } from '../../lib/confetti'
import { t } from '../../i18n/ru'

const SIZES: WinSize[] = ['small', 'medium', 'big']

export function WinIcon({ win }: { win: Win }) {
  const cls = 'size-9 shrink-0 flex items-center justify-center rounded-xl'
  if (win.source === 'task')
    return (
      <span className={`${cls} bg-[#2a9d82]/15 text-[#2a9d82]`} title={t.wins.source.task}>
        <CircleCheck size={19} />
      </span>
    )
  if (win.source === 'habit')
    return (
      <span className={`${cls} bg-[#8b6fd6]/15 text-[#8b6fd6]`} title={t.wins.source.habit}>
        <Repeat size={18} />
      </span>
    )
  return (
    <span className={`${cls} bg-accent-soft text-accent`} title={t.wins.source.manual}>
      <Sparkles size={18} />
    </span>
  )
}

export function WinRow({
  win,
  area,
  showDate,
  onOpen,
}: {
  win: Win
  area?: Area
  showDate?: boolean
  onOpen: (w: Win) => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(win)}
        className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left active:bg-surface-2"
      >
        <WinIcon win={win} />
        <span className="min-w-0 flex-1">
          <span className={`block text-[16px] leading-snug break-words ${win.size === 'big' ? 'font-semibold' : ''}`}>
            {win.text}
          </span>
          {(area || showDate) && (
            <span className="mt-0.5 flex items-center gap-2 text-[13px] text-muted">
              {showDate && <span className="first-letter:uppercase">{dayLabel(win.date)}</span>}
              {area && (
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full" style={{ background: area.color }} /> {area.name}
                </span>
              )}
            </span>
          )}
        </span>
        {win.size === 'big' && <Star size={20} className="shrink-0 text-[#e8a33a]" fill="currentColor" aria-label={t.wins.sizes.big} />}
        {win.size === 'medium' && <Star size={16} className="shrink-0 text-[#e8a33a]" aria-label={t.wins.sizes.medium} />}
      </button>
    </li>
  )
}

/** Карточка «Сегодня ты сделал: N» + ввод победы в одну строку + подсказки. */
export function AddWinCard() {
  const today = todayKey()
  const count = useLiveQuery(() => db.wins.where('date').equals(today).count(), [today]) ?? 0
  const [text, setText] = useState('')
  const [size, setSize] = useState<WinSize>('small')
  const input = useRef<HTMLInputElement>(null)

  async function submit() {
    const v = text.trim()
    if (!v) return
    setText('')
    await addWin({ text: v, size })
    if (size === 'big') confetti()
    setSize('small')
    showToast(t.wins.added)
  }

  return (
    <Card className="p-4">
      <p className="mb-3 text-[17px] font-semibold">{t.wins.todayDid(count)} ✨</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="flex items-center gap-2"
      >
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.wins.addPlaceholder}
          aria-label={t.wins.add}
          enterKeyHint="done"
          className="min-h-12 min-w-0 flex-1 rounded-2xl bg-surface-2 px-4 text-[16px] outline-none ring-accent focus:ring-2 placeholder:text-muted"
        />
        <button
          type="submit"
          aria-label={t.wins.add}
          disabled={!text.trim()}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent disabled:opacity-40"
        >
          <ArrowUp size={24} strokeWidth={2.6} />
        </button>
      </form>
      <div className="mt-2.5 flex gap-1.5" role="radiogroup" aria-label={t.wins.size}>
        {SIZES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={size === s}
            onClick={() => setSize(s)}
            className={`flex min-h-9 items-center gap-1 rounded-full px-3 text-[14px] font-medium ${
              size === s ? 'bg-accent text-on-accent' : 'bg-surface-2 text-muted'
            }`}
          >
            {s === 'big' && <Star size={14} fill="currentColor" />}
            {t.wins.sizes[s]}
          </button>
        ))}
      </div>
      {!text && (
        <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {t.wins.prompts.map(([q, start]) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setText(start)
                input.current?.focus()
              }}
              className="min-h-9 shrink-0 rounded-full border border-line px-3 text-[14px] text-muted"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}

/** Шторка редактирования победы */
export function WinSheet({ win, areas, onClose }: { win: Win | null; areas: Area[]; onClose: () => void }) {
  return (
    <Sheet open={win !== null} onClose={onClose} title={t.wins.edit}>
      {win && <WinForm key={win.id} win={win} areas={areas} onClose={onClose} />}
    </Sheet>
  )
}

function WinForm({ win, areas, onClose }: { win: Win; areas: Area[]; onClose: () => void }) {
  const [text, setText] = useState(win.text)
  const [date, setDate] = useState(win.date)
  const [size, setSize] = useState(win.size)
  const [areaId, setAreaId] = useState(win.areaId)

  async function save() {
    if (!text.trim()) return
    await updateWin(win.id, { text: text.trim(), date: date || win.date, size, areaId })
    onClose()
  }

  async function remove() {
    onClose()
    const snap = await deleteWin(win.id)
    if (snap) showToast(t.wins.deleted, { label: t.plan.undo, run: () => void restoreWin(snap) })
  }

  const label = 'mt-5 mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase'
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      className="pb-4"
    >
      <p className="mb-2 text-[13px] text-muted">{t.wins.source[win.source]}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        aria-label={t.wins.text}
        className="w-full resize-none rounded-xl bg-surface p-3 text-[17px] outline-none ring-accent focus:ring-2"
      />
      <h3 className={label}>{t.wins.date}</h3>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        aria-label={t.wins.date}
        className="min-h-11 rounded-xl bg-surface px-3 outline-none ring-accent focus:ring-2"
      />
      <h3 className={label}>{t.wins.size}</h3>
      <div className="flex flex-wrap gap-2">
        {SIZES.map((s) => (
          <Chip key={s} active={size === s} onClick={() => setSize(s)}>
            {s === 'big' && <Star size={14} fill="currentColor" />} {t.wins.sizes[s]}
          </Chip>
        ))}
      </div>
      <h3 className={label}>{t.wins.area}</h3>
      <div className="flex flex-wrap gap-2">
        <Chip active={!areaId} onClick={() => setAreaId(undefined)}>
          {t.task.noArea}
        </Chip>
        {areas.map((a) => (
          <Chip key={a.id} active={areaId === a.id} color={a.color} onClick={() => setAreaId(a.id)}>
            <span aria-hidden>{a.emoji}</span> {a.name}
          </Chip>
        ))}
      </div>
      <button type="submit" className="mt-6 min-h-12 w-full rounded-2xl bg-accent font-semibold text-on-accent">
        {t.habits.save}
      </button>
      <button
        type="button"
        onClick={() => void remove()}
        className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface-2 font-semibold text-danger"
      >
        <Trash2 size={18} /> {t.wins.delete}
      </button>
    </form>
  )
}

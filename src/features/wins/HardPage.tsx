import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, MessageCircle, Phone, RefreshCw, UserPlus } from 'lucide-react'
import { Card, Page } from '../../components/Page'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import { addWin } from '../../db/wins'
import { nowIso } from '../../lib/id'
import type { Person, Win } from '../../db/types'
import { dayLabel, todayKey } from '../../lib/dates'
import { capitalize, pickPastWins } from '../../lib/reviews'
import { WinIcon } from './WinParts'
import { t } from '../../i18n/ru'

/** Спокойный экран «Мне тяжело» */
export function HardPage() {
  return (
    <Page title={t.hard.title} subtitle={t.hard.intro} back>
      <div className="space-y-4">
        <PastWins />
        <Breathing />
        <SmallSteps />
        <CallList />
        <p className="px-2 pt-2 pb-4 text-[15px] leading-relaxed text-muted">{t.hard.calm}</p>
      </div>
    </Page>
  )
}

function PastWins() {
  const today = todayKey()
  const [seed, setSeed] = useState(0)
  const [picked, setPicked] = useState<Win[] | null>(null)

  // Случайные победы выбираем один раз (и по кнопке «Показать другие»), а не при каждом изменении базы
  useEffect(() => {
    let alive = true
    void db.wins.toArray().then((all) => alive && setPicked(pickPastWins(all, today, 5)))
    return () => {
      alive = false
    }
  }, [seed, today])

  if (!picked) return null
  return (
    <Card className="p-4">
      <h2 className="mb-2 text-[18px] font-semibold">{t.hard.lookWhat} 💛</h2>
      {picked.length === 0 ? (
        <p className="text-[15px] text-muted">{t.hard.noPast}</p>
      ) : (
        <>
          <ul className="space-y-1">
            {picked.map((w) => (
              <li key={w.id} className="flex items-center gap-3 py-1.5">
                <WinIcon win={w} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] leading-snug">{w.text}</span>
                  <span className="block text-[13px] text-muted">{capitalize(dayLabel(w.date, today))}</span>
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            className="mt-2 flex min-h-10 items-center gap-1.5 text-[15px] font-semibold text-accent"
          >
            <RefreshCw size={16} /> {t.hard.shuffle}
          </button>
        </>
      )}
    </Card>
  )
}

type Phase = 'idle' | 'inhale' | 'hold' | 'exhale' | 'done'
const PHASES: { phase: Exclude<Phase, 'idle' | 'done'>; secs: number }[] = [
  { phase: 'inhale', secs: 4 },
  { phase: 'hold', secs: 4 },
  { phase: 'exhale', secs: 6 },
]
const CYCLES = 6 // 6 × 14 с ≈ 1,5 минуты

/** Дыхание 4-4-6 с плавным кругом */
function Breathing() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [left, setLeft] = useState(0)
  const [cycle, setCycle] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => () => clearInterval(timer.current), [])

  function start() {
    clearInterval(timer.current)
    let c = 0
    let p = 0
    let s = PHASES[0]!.secs
    setCycle(1)
    setPhase(PHASES[0]!.phase)
    setLeft(s)
    timer.current = setInterval(() => {
      s--
      if (s > 0) return setLeft(s)
      p++
      if (p === PHASES.length) {
        p = 0
        c++
        if (c >= CYCLES) {
          clearInterval(timer.current)
          setPhase('done')
          return
        }
        setCycle(c + 1)
      }
      s = PHASES[p]!.secs
      setPhase(PHASES[p]!.phase)
      setLeft(s)
    }, 1000)
  }

  function stop() {
    clearInterval(timer.current)
    setPhase('idle')
  }

  const running = phase === 'inhale' || phase === 'hold' || phase === 'exhale'
  const big = phase === 'inhale' || phase === 'hold'
  const duration = phase === 'inhale' ? 4 : phase === 'exhale' ? 6 : 0.4

  return (
    <Card className="p-4">
      <h2 className="text-[18px] font-semibold">{t.hard.breathe}</h2>
      <p className="mt-0.5 text-[14px] text-muted">{t.hard.breatheHint}</p>
      <div className="my-6 flex h-56 items-center justify-center" aria-live="polite">
        <div className="relative flex size-56 items-center justify-center">
          <div
            className="breath-circle absolute rounded-full bg-accent/25"
            style={{
              width: '100%',
              height: '100%',
              transform: `scale(${big ? 1 : 0.45})`,
              transition: `transform ${duration}s ease-in-out`,
            }}
          />
          <div
            className="breath-circle absolute rounded-full bg-accent/50"
            style={{
              width: '70%',
              height: '70%',
              transform: `scale(${big ? 1 : 0.5})`,
              transition: `transform ${duration}s ease-in-out`,
            }}
          />
          <div className="relative text-center">
            {running ? (
              <>
                <p className="text-[22px] font-semibold">{t.hard[phase]}</p>
                <p className="text-[30px] font-bold tabular-nums">{left}</p>
                <p className="text-[12px] text-muted">
                  {cycle}/{CYCLES}
                </p>
              </>
            ) : phase === 'done' ? (
              <p className="max-w-36 text-[17px] font-semibold">{t.hard.breatheDone}</p>
            ) : (
              <span className="text-[36px]">🌿</span>
            )}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={running ? stop : start}
        className={`min-h-12 w-full rounded-2xl font-semibold ${running ? 'bg-surface-2' : 'bg-accent text-on-accent'}`}
      >
        {running ? t.hard.stop : t.hard.start}
      </button>
    </Card>
  )
}

function SmallSteps() {
  const [done, setDone] = useState<Set<number>>(new Set())
  return (
    <Card className="p-4">
      <h2 className="text-[18px] font-semibold">{t.hard.steps}</h2>
      <p className="mb-2 text-[14px] text-muted">{t.hard.stepsHint}</p>
      <ul>
        {t.hard.stepList.map(([step, winText], i) => {
          const on = done.has(i)
          return (
            <li key={step} className="flex items-center gap-1">
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => {
                  if (on) return
                  setDone((s) => new Set(s).add(i))
                  void addWin({ text: winText })
                }}
                className="flex min-h-12 flex-1 items-center gap-3 text-left"
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-accent bg-accent text-on-accent' : 'border-line'}`}
                >
                  {on && <Check size={16} strokeWidth={3} />}
                </span>
                <span className={`text-[16px] ${on ? 'text-muted line-through' : ''}`}>{step}</span>
              </button>
              {i === 3 && (
                <Link to="/plan" className="min-h-10 px-2 py-2 text-[14px] font-semibold text-accent">
                  {t.hard.goPlan} →
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

const tgLink = (tg: string) => `https://t.me/${tg.replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '')}`

function CallList() {
  const people = useLiveQuery(() => db.people.orderBy('name').toArray(), [])
  const [choosing, setChoosing] = useState(false)
  if (!people) return null
  const circle = people.filter((p) => p.supportCircle)

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center">
        <h2 className="flex-1 text-[18px] font-semibold">{t.hard.callList}</h2>
        {people.length > 0 && (
          <button
            type="button"
            onClick={() => setChoosing(true)}
            className="flex min-h-10 items-center gap-1 px-1 text-[14px] font-semibold text-accent"
          >
            <UserPlus size={17} /> {t.hard.choose}
          </button>
        )}
      </div>
      {circle.length === 0 ? (
        <p className="text-[15px] text-muted">
          {people.length === 0 ? (
            <Link to="/people" className="text-accent">
              {t.hard.callEmpty}
            </Link>
          ) : (
            t.hard.callEmpty
          )}
        </p>
      ) : (
        <ul className="space-y-1">
          {circle.map((p) => (
            <PersonCall key={p.id} person={p} />
          ))}
        </ul>
      )}
      <Sheet open={choosing} onClose={() => setChoosing(false)} title={t.hard.choose}>
        <ul className="space-y-1 pb-4">
          {people.map((p) => (
            <li key={p.id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-surface px-3">
                <span className="flex-1">{p.name}</span>
                <input
                  type="checkbox"
                  className="toggle"
                  checked={p.supportCircle}
                  onChange={(e) => void db.people.update(p.id, { supportCircle: e.target.checked, updatedAt: nowIso() })}
                />
              </label>
            </li>
          ))}
        </ul>
      </Sheet>
    </Card>
  )
}

function PersonCall({ person }: { person: Person }) {
  return (
    <li className="flex items-center gap-2 py-1">
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-semibold text-accent">
        {person.photo ? <img src={person.photo} alt="" className="size-full object-cover" /> : person.name.slice(0, 1)}
      </span>
      <span className="flex-1 font-medium">{person.name}</span>
      {person.phone && (
        <a
          href={`tel:${person.phone.replace(/[^\d+]/g, '')}`}
          aria-label={`${t.hard.call}: ${person.name}`}
          className="flex size-11 items-center justify-center rounded-full bg-[#2a9d82] text-white"
        >
          <Phone size={19} />
        </a>
      )}
      {person.telegram && (
        <a
          href={tgLink(person.telegram)}
          target="_blank"
          rel="noreferrer"
          aria-label={`${t.hard.telegram}: ${person.name}`}
          className="flex size-11 items-center justify-center rounded-full bg-[#3b9be0] text-white"
        >
          <MessageCircle size={19} />
        </a>
      )}
    </li>
  )
}

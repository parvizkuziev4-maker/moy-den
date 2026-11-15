import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, Repeat, Sun, Trophy, Users, type LucideIcon } from 'lucide-react'
import { t } from '../i18n/ru'

const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: t.tabs.today, icon: Sun },
  { to: '/plan', label: t.tabs.plan, icon: CalendarDays },
  { to: '/habits', label: t.tabs.habits, icon: Repeat },
  { to: '/wins', label: t.tabs.wins, icon: Trophy },
  { to: '/people', label: t.tabs.people, icon: Users },
]
const N = TABS.length
const PAD = 4 // внутренний отступ капсулы (p-1)

/** Какая вкладка активна (экран «Мне тяжело» относится к «Победам») */
function activeIndex(path: string): number {
  if (path === '/') return 0
  if (path.startsWith('/hard')) return 3
  return TABS.findIndex((tab) => tab.to !== '/' && path.startsWith(tab.to))
}

/**
 * Пока страница прокручивается, на <html> висит класс is-scrolling — панель на это время
 * без живого размытия (см. index.css). Класс меняется только в начале и в конце прокрутки,
 * поэтому сам обработчик почти ничего не стоит.
 */
function useScrollingClass() {
  useEffect(() => {
    const root = document.documentElement
    let timer: ReturnType<typeof setTimeout> | undefined
    let on = false
    const onScroll = () => {
      if (!on) {
        on = true
        root.classList.add('is-scrolling')
      }
      clearTimeout(timer)
      timer = setTimeout(() => {
        on = false
        root.classList.remove('is-scrolling')
      }, 160)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      clearTimeout(timer)
      root.classList.remove('is-scrolling')
    }
  }, [])
}

/**
 * Нижняя панель в стиле Liquid Glass.
 * Нажал — переходишь на вкладку. Зажал и ведёшь пальцем — стеклянная линза плавно едет за пальцем,
 * отпустил — открывается вкладка под пальцем.
 */
export function TabBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const active = activeIndex(pathname)
  useScrollingClass()

  const bar = useRef<HTMLDivElement>(null)
  // положение линзы в пикселях, пока палец на панели (null — линза стоит на активной вкладке)
  const [drag, setDrag] = useState<{ x: number; hover: number } | null>(null)
  const [jump, setJump] = useState(false)
  const frame = useRef(0)
  const handled = useRef(false)

  const geom = () => {
    const r = bar.current!.getBoundingClientRect()
    const inner = r.width - PAD * 2
    return { left: r.left + PAD, inner, tabW: inner / N }
  }
  const lensXFor = (clientX: number) => {
    const { left, inner, tabW } = geom()
    return Math.max(0, Math.min(inner - tabW, clientX - left - tabW / 2))
  }
  const indexAt = (clientX: number) => {
    const { left, tabW } = geom()
    return Math.max(0, Math.min(N - 1, Math.floor((clientX - left) / tabW)))
  }

  function onDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId) // палец можно увести с панели — она всё равно следит
    } catch {
      /* не страшно */
    }
    // линза «прыгает» под палец с пружинкой, дальше едет за ним
    setJump(true)
    setDrag({ x: lensXFor(e.clientX), hover: indexAt(e.clientX) })
    setTimeout(() => setJump(false), 220)
  }
  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (drag === null) return
    const next = { x: lensXFor(e.clientX), hover: indexAt(e.clientX) }
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => setDrag(next))
  }
  function onUp(e: PointerEvent<HTMLDivElement>) {
    if (drag === null) return
    cancelAnimationFrame(frame.current)
    const i = indexAt(e.clientX)
    handled.current = true
    setTimeout(() => (handled.current = false), 400)
    setDrag(null)
    if (i !== active) navigate(TABS[i]!.to)
  }
  function onCancel() {
    cancelAnimationFrame(frame.current)
    setDrag(null)
  }

  const dragging = drag !== null
  const hover = drag ? drag.hover : active
  const lensTransform = dragging
    ? `translateX(${drag.x}px) scale(1.1)`
    : `translateX(${Math.max(0, active) * 100}%)`
  const lensTransition = dragging
    ? jump
      ? 'transform 0.22s cubic-bezier(0.34, 1.36, 0.5, 1)'
      : 'transform 70ms linear'
    : undefined // обычное «перетекание» из CSS

  return (
    <nav aria-label="Разделы" className="tabbar-float fixed inset-x-0 z-30">
      <div
        ref={bar}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        className="glass-bar relative mx-auto max-w-md touch-none rounded-full p-1 select-none"
      >
        <span
          aria-hidden
          className={`glass-lens absolute top-1 bottom-1 left-1 rounded-full ${dragging ? 'glass-lens-held' : ''}`}
          style={{
            width: `calc((100% - ${PAD * 2}px) / ${N})`,
            transform: lensTransform,
            transition: lensTransition,
            opacity: active < 0 && !dragging ? 0 : 1,
          }}
        />
        <ul className="relative flex">
          {TABS.map(({ to, label, icon: Icon }, i) => {
            const lit = i === hover
            return (
              <li key={to} className="flex-1">
                <NavLink
                  to={to}
                  end={to === '/'}
                  aria-current={i === active ? 'page' : undefined}
                  draggable={false}
                  onClick={(e) => {
                    // переход уже сделан жестом — второй раз не нужен (клавиатура работает как обычно)
                    if (handled.current) {
                      e.preventDefault()
                      handled.current = false
                    }
                  }}
                  className={`flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-full text-[10.5px] font-semibold transition-colors duration-200 ${
                    lit ? 'text-accent' : 'text-ink/75'
                  }`}
                >
                  <Icon
                    size={23}
                    strokeWidth={lit ? 2.4 : 1.9}
                    aria-hidden
                    className={`transition-transform duration-300 ${lit ? 'scale-110' : ''}`}
                  />
                  <span>{label}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}

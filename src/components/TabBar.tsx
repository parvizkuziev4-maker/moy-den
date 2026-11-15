import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
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
  const lens = useRef<HTMLSpanElement>(null)
  // палец на панели? (меняется только при касании и отпускании — без перерисовок на каждом движении)
  const [dragging, setDragging] = useState(false)
  // вкладка под пальцем (обновляется только когда палец переходит на другую вкладку)
  const [hover, setHover] = useState<number | null>(null)
  const hoverRef = useRef<number | null>(null)
  const geomRef = useRef({ left: 0, inner: 0, tabW: 0 })
  const handled = useRef(false)

  const SPRING = 'transform 0.42s cubic-bezier(0.34, 1.36, 0.5, 1), opacity 0.2s ease'

  // Линза в покое стоит на активной вкладке; переезд — с пружинкой
  useLayoutEffect(() => {
    const el = lens.current
    if (!el || dragging) return
    el.style.transition = SPRING
    el.style.transform = `translate3d(${Math.max(0, active) * 100}%, 0, 0)`
    el.style.opacity = active < 0 ? '0' : '1'
  }, [active, dragging])

  /** Поставить линзу под палец — напрямую в стиль, в том же кадре, без анимации «догоняния» */
  function follow(clientX: number, transition: string) {
    const { left, inner, tabW } = geomRef.current
    const x = Math.max(0, Math.min(inner - tabW, clientX - left - tabW / 2))
    const el = lens.current!
    el.style.transition = transition
    el.style.transform = `translate3d(${x}px, 0, 0) scale(1.1)`
    el.style.opacity = '1'
    const i = Math.max(0, Math.min(N - 1, Math.floor((clientX - left) / tabW)))
    if (i !== hoverRef.current) {
      hoverRef.current = i
      setHover(i)
    }
  }

  function onDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId) // палец можно увести с панели — она всё равно следит
    } catch {
      /* не страшно */
    }
    // размеры меряем один раз на касание, а не на каждом движении
    const r = bar.current!.getBoundingClientRect()
    const inner = r.width - PAD * 2
    geomRef.current = { left: r.left + PAD, inner, tabW: inner / N }
    setDragging(true)
    // короткий подъезд под палец без «пружины», дальше — строго за пальцем
    follow(e.clientX, 'transform 0.16s cubic-bezier(0.2, 0.9, 0.3, 1)')
  }
  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging) return
    follow(e.clientX, 'none')
  }
  function finish(goTo: number | null) {
    hoverRef.current = null
    setHover(null)
    setDragging(false)
    if (goTo !== null && goTo !== active) navigate(TABS[goTo]!.to)
  }
  function onUp(e: PointerEvent<HTMLDivElement>) {
    if (!dragging) return
    const { left, tabW } = geomRef.current
    handled.current = true
    setTimeout(() => (handled.current = false), 400)
    finish(Math.max(0, Math.min(N - 1, Math.floor((e.clientX - left) / tabW))))
  }
  function onCancel() {
    if (dragging) finish(null)
  }

  const lit = hover ?? active

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
          ref={lens}
          aria-hidden
          className={`glass-lens absolute top-1 bottom-1 left-1 rounded-full ${dragging ? 'glass-lens-held' : ''}`}
          style={{ width: `calc((100% - ${PAD * 2}px) / ${N})` }}
        />
        <ul className="relative flex">
          {TABS.map(({ to, label, icon: Icon }, i) => {
            const on = i === lit
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
                  className={`flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-full text-[10.5px] font-semibold transition-colors duration-150 ${
                    on ? 'text-accent' : 'text-ink/75'
                  }`}
                >
                  {/* под пальцем меняется только цвет — без увеличения иконки, чтобы не было «двойного» движения */}
                  <Icon
                    size={23}
                    strokeWidth={on ? 2.4 : 1.9}
                    aria-hidden
                    className={dragging ? '' : `transition-transform duration-300 ${i === active ? 'scale-110' : ''}`}
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

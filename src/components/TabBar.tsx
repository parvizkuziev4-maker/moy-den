import { useEffect, useLayoutEffect, useRef, type PointerEvent } from 'react'
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
  const activeRef = useRef(active)
  useScrollingClass()

  const bar = useRef<HTMLDivElement>(null)
  const lens = useRef<HTMLSpanElement>(null)
  const links = useRef<(HTMLAnchorElement | null)[]>([])
  const hoverRef = useRef<number | null>(null)
  const geomRef = useRef({ left: 0, inner: 0, tabW: 0 })
  const handled = useRef(false)
  // касание: 'pending' — ещё непонятно, нажатие это или ведение пальцем
  const gesture = useRef<{ mode: 'idle' | 'pending' | 'drag'; startX: number; timer?: ReturnType<typeof setTimeout> }>({
    mode: 'idle',
    startX: 0,
  })

  // «Моторчик» линзы в режиме ведения: каждый кадр экрана мягко подтягивает линзу к пальцу.
  // Во время ведения React панель НЕ перерисовывает — всё меняется напрямую в стилях.
  const motor = useRef({ raf: 0, last: 0, x: 0, target: 0, scale: 1 })

  // Спокойное «перетекание» на вкладку: около полусекунды, с мягкой пружинкой в конце
  const GLIDE =
    'transform 0.55s cubic-bezier(0.3, 1.18, 0.45, 1), opacity 0.25s ease, background-color 0.25s ease, box-shadow 0.25s ease'
  const SOFT = 'opacity 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease'

  /** Линза в покое — на активной вкладке */
  function placeAtRest(index: number) {
    const el = lens.current
    if (!el) return
    el.style.transition = GLIDE
    // та же форма записи, что и при ведении (сдвиг + масштаб) — тогда возврат плавный, без скачка
    el.style.transform = `translate3d(${Math.max(0, index) * 100}%, 0, 0) scale(1)`
    el.style.opacity = index < 0 ? '0' : '1'
  }

  useEffect(() => {
    const m = motor.current
    return () => cancelAnimationFrame(m.raf)
  }, [])

  useLayoutEffect(() => {
    activeRef.current = active
    if (gesture.current.mode !== 'drag') placeAtRest(active)
  }, [active])

  const tabAt = (clientX: number) => {
    const { left, tabW } = geomRef.current
    return Math.max(0, Math.min(N - 1, Math.floor((clientX - left) / tabW)))
  }

  /** Подсветка вкладки под пальцем — напрямую, без перерисовки */
  function paintHover(i: number | null) {
    if (i === hoverRef.current) return
    if (hoverRef.current !== null) links.current[hoverRef.current]?.removeAttribute('data-lit')
    if (i !== null) links.current[i]?.setAttribute('data-lit', '')
    hoverRef.current = i
  }

  /** Новая цель для линзы — центр под пальцем (саму линзу двигает «моторчик») */
  function aim(clientX: number) {
    const { left, inner, tabW } = geomRef.current
    motor.current.target = Math.max(0, Math.min(inner - tabW, clientX - left - tabW / 2))
    paintHover(tabAt(clientX))
  }

  function runMotor() {
    const m = motor.current
    const el = lens.current
    if (!el) return
    const tick = (now: number) => {
      const dt = Math.min(64, now - (m.last || now))
      m.last = now
      // догоняет ~65% пути за кадр 60 Гц; на 120 Гц шаги вдвое мельче — плавно на любом экране
      const k = 1 - Math.pow(0.35, dt / 16.67)
      m.x += (m.target - m.x) * k
      m.scale += (1.1 - m.scale) * k
      if (Math.abs(m.target - m.x) < 0.3) m.x = m.target
      el.style.transform = `translate3d(${m.x.toFixed(2)}px, 0, 0) scale(${m.scale.toFixed(3)})`
      m.raf = requestAnimationFrame(tick)
    }
    cancelAnimationFrame(m.raf)
    m.last = 0
    m.raf = requestAnimationFrame(tick)
  }

  /** Перейти в режим «веду пальцем»: линза плавно подъезжает под палец и дальше идёт за ним */
  function startDrag(clientX: number) {
    const g = gesture.current
    clearTimeout(g.timer)
    g.mode = 'drag'
    const el = lens.current!
    // начинаем ровно с того места, где линза сейчас видна (даже если она ещё ехала)
    const box = el.getBoundingClientRect()
    const m = motor.current
    m.x = box.left + box.width / 2 - geomRef.current.left - geomRef.current.tabW / 2
    m.scale = 1
    el.style.transition = SOFT
    el.style.opacity = '1'
    el.classList.add('glass-lens-held')
    bar.current!.classList.add('is-dragging')
    aim(clientX)
    runMotor()
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
    const g = gesture.current
    g.mode = 'pending'
    g.startX = e.clientX
    const x = e.clientX
    // подержал палец — значит, хочет вести
    g.timer = setTimeout(() => g.mode === 'pending' && startDrag(x), 220)
  }
  function onMove(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current
    if (g.mode === 'pending') {
      if (Math.abs(e.clientX - g.startX) > 8) startDrag(e.clientX)
      return
    }
    if (g.mode === 'drag') aim(e.clientX)
  }
  function end(goTo: number | null) {
    const g = gesture.current
    clearTimeout(g.timer)
    cancelAnimationFrame(motor.current.raf)
    const wasDrag = g.mode === 'drag'
    g.mode = 'idle'
    paintHover(null)
    bar.current?.classList.remove('is-dragging')
    lens.current?.classList.remove('glass-lens-held')
    const target = goTo ?? activeRef.current
    if (wasDrag || target !== activeRef.current) placeAtRest(target)
    if (goTo !== null && goTo !== activeRef.current) {
      handled.current = true
      setTimeout(() => (handled.current = false), 400)
      navigate(TABS[goTo]!.to)
    }
  }
  function onUp(e: PointerEvent<HTMLDivElement>) {
    if (gesture.current.mode === 'idle') return
    // и нажатие, и ведение заканчиваются переходом на вкладку под пальцем;
    // при нажатии линза просто плавно перетекает со старой вкладки
    end(tabAt(e.clientX))
  }
  function onCancel() {
    if (gesture.current.mode !== 'idle') end(null)
  }

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
          className="glass-lens absolute top-1 bottom-1 left-1 rounded-full"
          style={{ width: `calc((100% - ${PAD * 2}px) / ${N})` }}
        />
        <ul className="relative flex">
          {TABS.map(({ to, label, icon: Icon }, i) => {
            const on = i === active
            return (
              <li key={to} className="flex-1">
                <NavLink
                  ref={(el) => {
                    links.current[i] = el
                  }}
                  to={to}
                  end={to === '/'}
                  aria-current={on ? 'page' : undefined}
                  draggable={false}
                  onClick={(e) => {
                    // переход уже сделан жестом — второй раз не нужен (клавиатура работает как обычно)
                    if (handled.current) {
                      e.preventDefault()
                      handled.current = false
                    }
                  }}
                  className={`tab-link flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-full text-[10.5px] font-semibold transition-colors duration-150 ${
                    on ? 'text-accent' : 'text-ink/75'
                  }`}
                >
                  <Icon
                    size={23}
                    strokeWidth={on ? 2.4 : 1.9}
                    aria-hidden
                    className={`transition-transform duration-300 ${on ? 'scale-110' : ''}`}
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

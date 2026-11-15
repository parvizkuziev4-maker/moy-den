import { NavLink, useLocation } from 'react-router-dom'
import { CalendarDays, Repeat, Sun, Trophy, Users, type LucideIcon } from 'lucide-react'
import { t } from '../i18n/ru'

const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: t.tabs.today, icon: Sun },
  { to: '/plan', label: t.tabs.plan, icon: CalendarDays },
  { to: '/habits', label: t.tabs.habits, icon: Repeat },
  { to: '/wins', label: t.tabs.wins, icon: Trophy },
  { to: '/people', label: t.tabs.people, icon: Users },
]

/** Какая вкладка активна (экран «Мне тяжело» относится к «Победам») */
function activeIndex(path: string): number {
  if (path === '/') return 0
  if (path.startsWith('/hard')) return 3
  return TABS.findIndex((tab) => tab.to !== '/' && path.startsWith(tab.to))
}

/** Нижняя панель в стиле Liquid Glass: парящая стеклянная капсула со «стеклянной линзой» под активной вкладкой. */
export function TabBar() {
  const { pathname } = useLocation()
  const active = activeIndex(pathname)

  return (
    <nav aria-label="Разделы" className="tabbar-float fixed inset-x-0 z-30">
      <div className="glass-bar relative mx-auto max-w-md rounded-full p-1">
        {/* линза под активной вкладкой — плавно перетекает между вкладками */}
        <span
          aria-hidden
          className="glass-lens absolute top-1 bottom-1 left-1 rounded-full"
          style={{
            width: `calc((100% - 0.5rem) / ${TABS.length})`,
            transform: `translateX(${Math.max(0, active) * 100}%)`,
            opacity: active < 0 ? 0 : 1,
          }}
        />
        <ul className="relative flex">
          {TABS.map(({ to, label, icon: Icon }, i) => {
            const isActive = i === active
            return (
              <li key={to} className="flex-1">
                <NavLink
                  to={to}
                  end={to === '/'}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-full text-[10.5px] font-semibold transition-[color,transform] duration-300 active:scale-90 ${
                    isActive ? 'text-accent' : 'text-ink/75'
                  }`}
                >
                  <Icon
                    size={23}
                    strokeWidth={isActive ? 2.4 : 1.9}
                    aria-hidden
                    className={`transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}
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

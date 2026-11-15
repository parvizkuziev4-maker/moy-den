import { NavLink } from 'react-router-dom'
import { CalendarDays, Repeat, Sun, Trophy, Users, type LucideIcon } from 'lucide-react'
import { t } from '../i18n/ru'

const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: t.tabs.today, icon: Sun },
  { to: '/plan', label: t.tabs.plan, icon: CalendarDays },
  { to: '/habits', label: t.tabs.habits, icon: Repeat },
  { to: '/wins', label: t.tabs.wins, icon: Trophy },
  { to: '/people', label: t.tabs.people, icon: Users },
]

export function TabBar() {
  return (
    <nav
      aria-label="Разделы"
      className="pb-safe pl-safe pr-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/85 backdrop-blur-xl"
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-[52px] flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-accent' : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={24} strokeWidth={isActive ? 2.4 : 1.9} aria-hidden />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

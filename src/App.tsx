import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes, Navigate } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { UpdateToast } from './components/UpdateToast'
import { ToastHost } from './components/ToastHost'
import { LockScreen } from './components/LockScreen'
import { TodayPage } from './features/today/TodayPage'

// Разделы грузятся по требованию — приложение быстрее открывается.
// Для офлайна все части всё равно заранее сохраняются (service worker).
const named = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })))

const PlanPage = named(() => import('./features/plan/PlanPage'), 'PlanPage')
const HabitsPage = named(() => import('./features/habits/HabitsPage'), 'HabitsPage')
const HabitsArchivePage = named(() => import('./features/habits/HabitsPage'), 'HabitsArchivePage')
const HabitDetailPage = named(() => import('./features/habits/HabitDetailPage'), 'HabitDetailPage')
const WinsPage = named(() => import('./features/wins/WinsPage'), 'WinsPage')
const DayEntryPage = named(() => import('./features/wins/DayEntryPage'), 'DayEntryPage')
const HardPage = named(() => import('./features/wins/HardPage'), 'HardPage')
const ReviewPage = named(() => import('./features/wins/ReviewPage'), 'ReviewPage')
const PeoplePage = named(() => import('./features/people/PeoplePage'), 'PeoplePage')
const PersonPage = named(() => import('./features/people/PersonPage'), 'PersonPage')
const MeetingPage = named(() => import('./features/people/MeetingPage'), 'MeetingPage')
const SettingsPage = named(() => import('./features/settings/SettingsPage'), 'SettingsPage')
const StatsPage = named(() => import('./features/stats/StatsPage'), 'StatsPage')
const InstallPage = named(() => import('./features/settings/InstallPage'), 'InstallPage')

export function App() {
  return (
    <HashRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/habits" element={<HabitsPage />} />
          <Route path="/habits/archive" element={<HabitsArchivePage />} />
          <Route path="/habits/:id" element={<HabitDetailPage />} />
          <Route path="/wins" element={<WinsPage />} />
          <Route path="/wins/day/:date" element={<DayEntryPage />} />
          <Route path="/wins/review" element={<ReviewPage />} />
          <Route path="/hard" element={<HardPage />} />
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/people/:id" element={<PersonPage />} />
          <Route path="/people/:id/meet" element={<MeetingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/install" element={<InstallPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <TabBar />
      <UpdateToast />
      <ToastHost />
      <LockScreen />
    </HashRouter>
  )
}

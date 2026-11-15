import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, HeartHandshake, Settings } from 'lucide-react'
import { Page } from '../../components/Page'
import { Fab } from '../../components/Fab'
import { InstallHint } from '../../components/InstallHint'
import { greetingFor, longDate, todayKey } from '../../lib/dates'
import { usePrefs } from '../../lib/prefs'
import { PlanContext } from '../plan/PlanContext'
import { TaskSheet } from '../plan/TaskSheet'
import { QuickAdd } from '../plan/QuickAdd'
import { useAreas, useOverdue, usePeopleMap, useTasksOn } from '../plan/usePlanData'
import { AddWinCard } from '../wins/WinParts'
import {
  CareNudges,
  EveningCard,
  FocusCard,
  MoodPicker,
  NameCard,
  PeopleNudges,
  QuoteCard,
  TodayHabits,
  TodayTasks,
} from './TodayBlocks'
import { t } from '../../i18n/ru'

/** Главный экран: всё важное на сегодня в одном месте */
export function TodayPage() {
  const { name } = usePrefs()
  const now = new Date()
  const today = todayKey()
  const greeting = name.trim() ? `${greetingFor(now)}, ${name.trim()}` : greetingFor(now)

  const tasks = useTasksOn(today)
  const overdue = useOverdue(today)
  const areas = useAreas()
  const people = usePeopleMap()
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const ctx = useMemo(() => ({ areas, people, openTask: setOpenTaskId }), [areas, people, setOpenTaskId])

  return (
    <PlanContext.Provider value={ctx}>
      <Page
        title={greeting}
        subtitle={longDate(now)}
        actions={
          <>
          <Link
            to="/stats"
            aria-label={t.settings.stats}
            className="flex size-11 items-center justify-center rounded-full bg-surface text-muted shadow-soft"
          >
            <BarChart3 size={21} />
          </Link>
          <Link
            to="/settings"
            aria-label={t.common.settings}
            className="flex size-11 items-center justify-center rounded-full bg-surface text-muted shadow-soft"
          >
            <Settings size={22} />
          </Link>
          </>
        }
      >
        <InstallHint />
        <div className="space-y-5">
          <NameCard />
          <CareNudges />
          <QuoteCard />
          <MoodPicker />
          <FocusCard tasks={tasks} />
          <TodayTasks tasks={tasks} overdue={overdue} />
          <TodayHabits />
          <AddWinCard />
          <EveningCard />
          <PeopleNudges />
          <Link
            to="/hard"
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-surface font-semibold text-pink shadow-soft"
          >
            <HeartHandshake size={20} /> {t.wins.hard}
          </Link>
        </div>
      </Page>
      <Fab label={t.plan.add} onClick={() => setAdding(true)} />
      <QuickAdd open={adding} onClose={() => setAdding(false)} defaultDate={today} />
      <TaskSheet taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </PlanContext.Provider>
  )
}

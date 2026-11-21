import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClipboardPaste, Search, X } from 'lucide-react'
import { Page } from '../../components/Page'
import { Fab } from '../../components/Fab'
import { Segmented } from '../../components/Segmented'
import type { DayKey } from '../../db/types'
import { todayKey } from '../../lib/dates'
import { usePrefs } from '../../lib/prefs'
import { PlanContext } from './PlanContext'
import { useAreas, usePeopleMap } from './usePlanData'
import { DayView, InboxView, MonthView, SearchView, WeekView } from './views'
import { TaskSheet } from './TaskSheet'
import { QuickAdd } from './QuickAdd'
import { PastePlan } from './PastePlan'
import { t } from '../../i18n/ru'

type View = 'inbox' | 'day' | 'week' | 'month'
const VIEWS: View[] = ['inbox', 'day', 'week', 'month']

export function PlanPage() {
  // Вид и дата живут в адресе (#/plan?v=week&d=2026-11-15) — кнопка «Назад» и ссылки работают.
  const [params, setParams] = useSearchParams()
  const view = (VIEWS.includes(params.get('v') as View) ? params.get('v') : 'day') as View
  const date: DayKey = params.get('d') ?? todayKey()
  const { weekStartsOn } = usePrefs()

  const [searching, setSearching] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [pasting, setPasting] = useState(false)

  const areas = useAreas()
  const people = usePeopleMap()
  const ctx = useMemo(() => ({ areas, people, openTask: setOpenTaskId }), [areas, people])

  const go = (v: View, d: DayKey = date) => setParams({ v, d }, { replace: true })
  const setDate = (d: DayKey) => go(view, d)
  const openDay = (d: DayKey) => go('day', d)

  return (
    <PlanContext.Provider value={ctx}>
      <Page
        title={t.tabs.plan}
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              aria-label={t.pastePlan.open}
              onClick={() => setPasting(true)}
              className="flex size-11 items-center justify-center rounded-full bg-surface text-muted shadow-soft"
            >
              <ClipboardPaste size={22} />
            </button>
            <button
              type="button"
              aria-label={searching ? t.common.close : t.plan.search}
              onClick={() => setSearching((s) => !s)}
              className="flex size-11 items-center justify-center rounded-full bg-surface text-muted shadow-soft"
            >
              {searching ? <X size={22} /> : <Search size={22} />}
            </button>
          </div>
        }
      >
        {searching ? (
          <SearchView />
        ) : (
          <>
            <div className="mb-4">
              <Segmented
                label={t.tabs.plan}
                value={view}
                onChange={(v) => go(v)}
                options={VIEWS.map((id) => ({ id, label: t.plan.views[id] }))}
              />
            </div>
            {view === 'inbox' && <InboxView />}
            {view === 'day' && <DayView date={date} setDate={setDate} />}
            {view === 'week' && (
              <WeekView
                date={date}
                setDate={setDate}
                openDay={openDay}
                weekStartsOn={weekStartsOn}
              />
            )}
            {view === 'month' && (
              <MonthView
                date={date}
                setDate={setDate}
                openDay={openDay}
                weekStartsOn={weekStartsOn}
              />
            )}
          </>
        )}
      </Page>

      <Fab label={t.plan.add} onClick={() => setAdding(true)} />
      <QuickAdd
        open={adding}
        onClose={() => setAdding(false)}
        defaultDate={view === 'inbox' ? '' : date}
      />
      <TaskSheet taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
      <PastePlan
        open={pasting}
        onClose={() => setPasting(false)}
        onAdded={(d) => {
          setSearching(false)
          if (d) openDay(d)
        }}
      />
    </PlanContext.Provider>
  )
}

import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Cake, Check, ChevronDown, ListPlus, MessageCircle, MessagesSquare, Pencil, Phone, Plus, Star, Trash2, Users } from 'lucide-react'
import { Card, Page } from '../../components/Page'
import { db } from '../../db/db'
import {
  addTopic,
  deleteInteraction,
  deletePerson,
  deleteTopic,
  restoreInteraction,
  restorePerson,
  taskFromFollowUp,
  toggleTopic,
  updatePerson,
} from '../../db/people'
import { sortTasks } from '../../db/tasks'
import type { Interaction, Person, Topic } from '../../db/types'
import { dayLabel, todayKey } from '../../lib/dates'
import { capitalize } from '../../lib/reviews'
import { daysSinceContact, isContactOverdue, nextBirthday, phoneLink, telegramLink } from '../../lib/people'
import { showToast } from '../../lib/toast'
import { PlanContext } from '../plan/PlanContext'
import { TaskList } from '../plan/TaskRow'
import { TaskSheet } from '../plan/TaskSheet'
import { useAreas, usePeopleMap } from '../plan/usePlanData'
import { Avatar, InteractionSheet, PersonFormSheet } from './PeopleParts'
import { t } from '../../i18n/ru'

export function PersonPage() {
  const { id = '' } = useParams()
  const person = useLiveQuery(async () => (await db.people.get(id)) ?? null, [id])
  if (person === undefined) return <Page title="" back>{null}</Page>
  if (person === null) return <Page title={t.people.nothingFound} back>{null}</Page>
  return <PersonView person={person} />
}

function PersonView({ person }: { person: Person }) {
  const navigate = useNavigate()
  const today = todayKey()
  const [editing, setEditing] = useState(false)
  const [logging, setLogging] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const topics = useLiveQuery(() => db.topics.where('personId').equals(person.id).toArray(), [person.id]) ?? []
  const talks = useLiveQuery(async () => (await db.interactions.where('personId').equals(person.id).toArray()).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [person.id]) ?? []
  const tasks = useLiveQuery(async () => sortTasks(await db.tasks.where('personId').equals(person.id).toArray()), [person.id]) ?? []
  const areas = useAreas()
  const people = usePeopleMap()
  const ctx = useMemo(() => ({ areas, people, openTask: setOpenTaskId }), [areas, people, setOpenTaskId])

  const since = daysSinceContact(person, today)
  const overdue = isContactOverdue(person, today)
  const bd = nextBirthday(person.birthday, today)
  const [bdDay, bdMonth] = (() => {
    const m = person.birthday?.match(/(\d{2})-(\d{2})$/)
    return m ? [Number(m[2]), Number(m[1])] : [0, 0]
  })()

  async function remove() {
    const snap = await deletePerson(person.id)
    navigate('/people', { replace: true })
    if (snap) showToast(t.people.deleted, { label: t.plan.undo, run: () => void restorePerson(snap) })
  }

  return (
    <PlanContext.Provider value={ctx}>
      <Page
        title=""
        back
        actions={
          <>
            <button
              type="button"
              aria-label={person.favorite ? t.people.unfav : t.people.fav}
              aria-pressed={person.favorite}
              onClick={() => void updatePerson(person.id, { favorite: !person.favorite })}
              className="flex size-11 items-center justify-center rounded-full bg-surface text-[#e8a33a] shadow-soft"
            >
              <Star size={20} fill={person.favorite ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              aria-label={t.people.edit}
              onClick={() => setEditing(true)}
              className="flex size-11 items-center justify-center rounded-full bg-surface text-muted shadow-soft"
            >
              <Pencil size={19} />
            </button>
          </>
        }
      >
        <div className="-mt-10 mb-4 flex flex-col items-center text-center">
          <Avatar person={person} size={96} />
          <h1 className="mt-3 text-[26px] leading-tight font-bold">{person.name}</h1>
          <p className="text-[15px] text-muted">
            {t.people.groups[person.group]}
            {person.tags.length > 0 && ` · ${person.tags.join(', ')}`}
          </p>
          <p className={`mt-1 text-[14px] ${overdue ? 'font-semibold text-warn' : 'text-muted'}`}>
            {overdue && `${t.people.overdue} · `}
            {since === null ? t.people.never : t.people.daysAgo(since)}
          </p>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <ActionButton href={person.phone ? phoneLink(person.phone) : undefined} icon={<Phone size={22} />} label={t.people.call} color="#2a9d82" />
          <ActionButton href={person.telegram ? telegramLink(person.telegram) : undefined} external icon={<MessageCircle size={22} />} label={t.people.write} color="#3b9be0" />
          <button type="button" onClick={() => setLogging(true)} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-surface text-[13px] font-semibold shadow-soft">
            <MessagesSquare size={22} className="text-accent" /> {t.people.logTalk}
          </button>
        </div>

        <Link
          to={`/people/${person.id}/meet`}
          className="mb-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-accent font-semibold text-on-accent shadow-soft"
        >
          <Users size={20} /> {t.people.beforeMeeting}
        </Link>

        <div className="space-y-4">
          {(bd || person.howWeMet || person.phone) && (
            <Card className="space-y-1.5 p-4 text-[15px]">
              {bd && (
                <p className="flex items-center gap-2">
                  <Cake size={17} className="text-pink" />
                  <span>
                    {bdDay} {t.people.months[bdMonth - 1]}
                    {bd.daysLeft <= 30 && <span className="text-muted"> · {t.people.birthdayIn(bd.daysLeft)}</span>}
                    {bd.turns && bd.daysLeft <= 30 ? <span className="text-muted"> ({t.people.turns(bd.turns)})</span> : null}
                  </span>
                </p>
              )}
              {person.howWeMet && (
                <p>
                  <span className="text-muted">{t.people.howWeMet}: </span>
                  {person.howWeMet}
                </p>
              )}
              {person.phone && <p className="text-muted">{person.phone}</p>}
            </Card>
          )}

          <TopicList personId={person.id} kind="topic" topics={topics} />
          <TopicList personId={person.id} kind="ask" topics={topics} />

          <Card className="p-4">
            <h2 className="mb-2 font-semibold">{t.people.history}</h2>
            {talks.length === 0 ? (
              <p className="text-[15px] text-muted">{t.people.noHistory}</p>
            ) : (
              <ul className="space-y-3">
                {talks.map((it) => (
                  <TalkItem key={it.id} it={it} />
                ))}
              </ul>
            )}
            <button type="button" onClick={() => setLogging(true)} className="mt-3 flex min-h-10 items-center gap-1.5 text-[15px] font-semibold text-accent">
              <Plus size={18} /> {t.people.logTalk}
            </button>
          </Card>

          <NotesCard person={person} />

          {tasks.length > 0 && (
            <div>
              <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">{t.people.tasks}</h2>
              <TaskList tasks={tasks} showDate />
            </div>
          )}

          <button type="button" onClick={() => void remove()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface-2 font-semibold text-danger">
            <Trash2 size={18} /> {t.people.deletePerson}
          </button>
        </div>
      </Page>

      <PersonFormSheet open={editing} onClose={() => setEditing(false)} person={person} />
      <InteractionSheet personId={person.id} open={logging} onClose={() => setLogging(false)} />
      <TaskSheet taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </PlanContext.Provider>
  )
}

function ActionButton({ href, icon, label, color, external }: { href?: string; icon: React.ReactNode; label: string; color: string; external?: boolean }) {
  const cls = 'flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-surface text-[13px] font-semibold shadow-soft'
  if (!href)
    return (
      <span className={`${cls} opacity-40`} aria-disabled>
        <span style={{ color }}>{icon}</span> {label}
      </span>
    )
  return (
    <a href={href} className={cls} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
      <span style={{ color }}>{icon}</span> {label}
    </a>
  )
}

export function TopicList({ personId, kind, topics }: { personId: string; kind: Topic['kind']; topics: Topic[] }) {
  const [text, setText] = useState('')
  const [showDone, setShowDone] = useState(false)
  const mine = topics.filter((x) => x.kind === kind).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const open = mine.filter((x) => x.status === 'open')
  const done = mine.filter((x) => x.status === 'discussed').sort((a, b) => (b.discussedAt ?? '').localeCompare(a.discussedAt ?? ''))
  const title = kind === 'topic' ? t.people.topics : t.people.asks
  const placeholder = kind === 'topic' ? t.people.addTopic : t.people.addAsk

  return (
    <Card className="p-4">
      <h2 className="mb-1 font-semibold">{title}</h2>
      <ul>
        {open.map((x) => (
          <TopicItem key={x.id} topic={x} />
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const v = text.trim()
          if (!v) return
          setText('')
          void addTopic(v, personId, kind)
        }}
        className="mt-1 flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          enterKeyHint="done"
          className="min-h-11 min-w-0 flex-1 rounded-xl bg-surface-2 px-3 outline-none ring-accent focus:ring-2 placeholder:text-muted"
        />
        <button type="submit" aria-label={placeholder} className="flex size-11 items-center justify-center rounded-xl bg-surface-2 text-accent">
          <Plus size={22} />
        </button>
      </form>
      {done.length > 0 && (
        <>
          <button type="button" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)} className="mt-2 flex min-h-9 items-center gap-1 text-[14px] font-semibold text-muted">
            <ChevronDown size={16} className={showDone ? '' : '-rotate-90'} /> {t.people.discussedList(done.length)}
          </button>
          {showDone && (
            <ul>
              {done.map((x) => (
                <TopicItem key={x.id} topic={x} />
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  )
}

function TopicItem({ topic }: { topic: Topic }) {
  const done = topic.status === 'discussed'
  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${t.people.discussed}: ${topic.text}`}
        onClick={() => void toggleTopic(topic.id)}
        className="-ml-2 flex size-11 shrink-0 items-center justify-center"
      >
        <span className={`flex size-6 items-center justify-center rounded-full border-2 ${done ? 'border-accent bg-accent text-on-accent' : 'border-line'}`}>
          {done && <Check size={14} strokeWidth={3} />}
        </span>
      </button>
      <span className="min-w-0 flex-1 py-2">
        <span className={`block text-[16px] leading-snug ${done ? 'text-muted line-through' : ''}`}>{topic.text}</span>
        {done && topic.discussedAt && <span className="text-[12px] text-muted">{capitalize(dayLabel(topic.discussedAt.slice(0, 10)))}</span>}
      </span>
      <button
        type="button"
        aria-label={`${t.people.deleteTopic}: ${topic.text}`}
        onClick={async () => {
          const snap = await deleteTopic(topic.id)
          if (snap) showToast(t.people.deleteTopic, { label: t.plan.undo, run: () => void db.topics.put(snap) })
        }}
        className="flex size-11 shrink-0 items-center justify-center text-muted"
      >
        <Trash2 size={17} />
      </button>
    </li>
  )
}

export function TalkItem({ it, compact }: { it: Interaction; compact?: boolean }) {
  return (
    <li className="flex gap-3">
      <span className="text-[22px] leading-none" aria-hidden>
        {t.people.typeEmoji[it.type]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-muted">
          {capitalize(dayLabel(it.date))} · {t.people.types[it.type]}
        </p>
        {it.summary && <p className={`whitespace-pre-wrap ${compact ? 'text-[18px]' : 'text-[15px]'}`}>{it.summary}</p>}
        {it.followUp && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-[14px]">
              <span className="text-muted">→ </span>
              {it.followUp}
            </span>
            {!compact && (
              <button
                type="button"
                onClick={async () => {
                  await taskFromFollowUp(it)
                  showToast(t.people.taskAdded)
                }}
                className="flex min-h-8 items-center gap-1 rounded-full bg-accent-soft px-2.5 text-[13px] font-semibold text-accent"
              >
                <ListPlus size={14} /> {t.people.followUpTask}
              </button>
            )}
          </div>
        )}
      </div>
      {!compact && (
        <button
          type="button"
          aria-label={t.people.deleteTalk}
          onClick={async () => {
            const snap = await deleteInteraction(it.id)
            if (snap) showToast(t.people.deleteTalk, { label: t.plan.undo, run: () => void restoreInteraction(snap) })
          }}
          className="-mt-2 flex size-10 shrink-0 items-center justify-center text-muted"
        >
          <Trash2 size={16} />
        </button>
      )}
    </li>
  )
}

function NotesCard({ person }: { person: Person }) {
  const [notes, setNotes] = useState(person.notes)
  return (
    <Card className="p-4">
      <h2 className="mb-2 font-semibold">{t.people.notes}</h2>
      <textarea
        rows={4}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => notes !== person.notes && void updatePerson(person.id, { notes })}
        placeholder={t.people.notesPlaceholder}
        aria-label={t.people.notes}
        className="w-full resize-none rounded-xl bg-surface-2 p-3 text-[16px] outline-none ring-accent focus:ring-2 placeholder:text-muted"
      />
    </Card>
  )
}

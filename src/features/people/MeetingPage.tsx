import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, MessagesSquare } from 'lucide-react'
import { Page } from '../../components/Page'
import { db } from '../../db/db'
import { toggleTopic } from '../../db/people'
import type { Topic } from '../../db/types'
import { nextBirthday } from '../../lib/people'
import { todayKey } from '../../lib/dates'
import { Avatar, InteractionSheet } from './PeopleParts'
import { TalkItem } from './PersonPage'
import { t } from '../../i18n/ru'

/** «Перед встречей»: всё главное о человеке крупно на одном экране */
export function MeetingPage() {
  const { id = '' } = useParams()
  const person = useLiveQuery(() => db.people.get(id), [id])
  const topics = useLiveQuery(() => db.topics.where('personId').equals(id).filter((x) => x.status === 'open').sortBy('createdAt'), [id]) ?? []
  const talks =
    useLiveQuery(async () => (await db.interactions.where('personId').equals(id).toArray()).sort((a, b) => b.date.localeCompare(a.date)), [id]) ?? []
  const tasks = useLiveQuery(() => db.tasks.where('personId').equals(id).filter((x) => !x.done).toArray(), [id]) ?? []
  const [logging, setLogging] = useState(false)

  if (!person) return <Page title="" back>{null}</Page>

  const asks = topics.filter((x) => x.kind === 'ask')
  const open = topics.filter((x) => x.kind === 'topic')
  // «Что я обещал»: открытые задачи с этим человеком + «что сделать после» из последних разговоров
  const promised = [
    ...tasks.map((x) => ({ key: x.id, text: x.title })),
    ...talks
      .slice(0, 5)
      .filter((x) => x.followUp && !tasks.some((tk) => tk.title === x.followUp))
      .map((x) => ({ key: x.id, text: x.followUp })),
  ]
  const bd = nextBirthday(person.birthday, todayKey())

  return (
    <Page title="" back>
      <div className="-mt-10 mb-5 flex items-center gap-4">
        <Avatar person={person} size={72} />
        <div className="min-w-0">
          <h1 className="text-[30px] leading-tight font-bold">{person.name}</h1>
          <p className="text-[15px] text-muted">{t.people.beforeMeeting}</p>
          {bd && bd.daysLeft <= 14 && <p className="text-[15px] font-semibold text-pink">🎂 {t.people.birthdayIn(bd.daysLeft)}</p>}
        </div>
      </div>

      <div className="space-y-5">
        <Block title={`❓ ${t.people.asks}`} empty={asks.length === 0}>
          <TopicBig topics={asks} />
        </Block>
        <Block title={`💡 ${t.people.openTopics}`} empty={open.length === 0}>
          <TopicBig topics={open} />
        </Block>
        <Block title={`🤝 ${t.people.promised}`} empty={promised.length === 0}>
          <ul className="space-y-2">
            {promised.map((p) => (
              <li key={p.key} className="text-[19px] leading-snug">
                • {p.text}
              </li>
            ))}
          </ul>
        </Block>
        <Block title={`🕰 ${t.people.lastTalks}`} empty={talks.length === 0}>
          <ul className="space-y-4">
            {talks.slice(0, 3).map((it) => (
              <TalkItem key={it.id} it={it} compact />
            ))}
          </ul>
        </Block>
        {person.notes && (
          <Block title={`📝 ${t.people.notes}`}>
            <p className="text-[17px] leading-relaxed whitespace-pre-wrap">{person.notes}</p>
          </Block>
        )}

        <button
          type="button"
          onClick={() => setLogging(true)}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[17px] font-semibold text-on-accent shadow-soft"
        >
          <MessagesSquare size={22} /> {t.people.logTalk}
        </button>
      </div>
      <InteractionSheet personId={person.id} open={logging} onClose={() => setLogging(false)} />
    </Page>
  )
}

function Block({ title, empty, children }: { title: string; empty?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-surface p-4 shadow-soft">
      <h2 className="mb-2 text-[15px] font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {empty ? <p className="text-[16px] text-muted">{t.people.nothingYet}</p> : children}
    </section>
  )
}

function TopicBig({ topics }: { topics: Topic[] }) {
  return (
    <ul className="space-y-1">
      {topics.map((x) => (
        <li key={x.id}>
          <button
            type="button"
            onClick={() => void toggleTopic(x.id)}
            className="flex min-h-12 w-full items-center gap-3 text-left"
            aria-label={`${t.people.discussed}: ${x.text}`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-line text-transparent active:border-accent active:bg-accent active:text-on-accent">
              <Check size={18} strokeWidth={3} />
            </span>
            <span className="text-[19px] leading-snug">{x.text}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

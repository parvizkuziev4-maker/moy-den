import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Cake, Check, FileSpreadsheet, Lightbulb, Plus, Search, Star, Trash2, UserRoundPlus } from 'lucide-react'
import { Card, EmptyState, Page } from '../../components/Page'
import { Fab } from '../../components/Fab'
import { Chip, Segmented } from '../../components/Segmented'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import { addTopic, assignTopic, deleteTopic, toggleTopic } from '../../db/people'
import { PERSON_GROUPS, type DayKey, type Person, type PersonGroup, type Topic } from '../../db/types'
import { todayKey } from '../../lib/dates'
import { daysSinceContact, isContactOverdue, nextBirthday, peopleToCsv, sortPeople, type PeopleSort } from '../../lib/people'
import { shareOrDownload } from '../../lib/share'
import { showToast } from '../../lib/toast'
import { Avatar, PersonFormSheet } from './PeopleParts'
import { t } from '../../i18n/ru'

export function PeoplePage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'bank' ? 'bank' : 'list'
  const [adding, setAdding] = useState(false)
  const navigate = useNavigate()

  return (
    <Page title={t.tabs.people}>
      <div className="mb-4">
        <Segmented
          label={t.tabs.people}
          value={tab}
          onChange={(v) => setParams(v === 'list' ? {} : { tab: v }, { replace: true })}
          options={[
            { id: 'list', label: t.people.list },
            { id: 'bank', label: t.people.bank },
          ]}
        />
      </div>
      {tab === 'list' ? <PeopleList /> : <TopicBank />}
      {tab === 'list' && (
        <>
          <Fab label={t.people.add} onClick={() => setAdding(true)} />
          <PersonFormSheet open={adding} onClose={() => setAdding(false)} onCreated={(id) => navigate(`/people/${id}`)} />
        </>
      )}
    </Page>
  )
}

/* ---------- Список ---------- */

function PeopleList() {
  const today = todayKey()
  const people = useLiveQuery(() => db.people.toArray(), [])
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<PersonGroup | null>(null)
  const [sort, setSort] = useState<PeopleSort>('name')
  if (!people) return null
  if (people.length === 0) return <EmptyState emoji="🤝" text={t.people.empty} />

  const query = q.trim().toLowerCase()
  const usedGroups = PERSON_GROUPS.filter((g) => people.some((p) => p.group === g))
  const list = sortPeople(
    people.filter(
      (p) =>
        (!group || p.group === group) &&
        (!query ||
          p.name.toLowerCase().includes(query) ||
          p.tags.some((x) => x.toLowerCase().includes(query)) ||
          p.notes.toLowerCase().includes(query)),
    ),
    sort,
    today,
  )

  return (
    <div className="space-y-3">
      <label className="flex min-h-12 items-center gap-2 rounded-2xl bg-surface px-3 shadow-soft">
        <Search size={20} className="text-muted" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.people.search}
          aria-label={t.people.search}
          className="min-h-11 flex-1 bg-transparent outline-none placeholder:text-muted"
        />
      </label>
      {usedGroups.length > 1 && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          <Chip active={group === null} onClick={() => setGroup(null)}>
            {t.people.allGroups}
          </Chip>
          {usedGroups.map((g) => (
            <Chip key={g} active={group === g} onClick={() => setGroup(g)}>
              {t.people.groups[g]}
            </Chip>
          ))}
        </div>
      )}
      <Segmented
        label={t.people.sort.name}
        value={sort}
        onChange={setSort}
        options={(['name', 'contact', 'recent'] as const).map((id) => ({ id, label: t.people.sort[id] }))}
      />

      {list.length === 0 ? (
        <p className="px-1 py-4 text-muted">{t.people.nothingFound}</p>
      ) : (
        <ul className="space-y-2">
          {list.map((p) => (
            <PersonRow key={p.id} person={p} today={today} />
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => void shareOrDownload(`moy-den-lyudi-${today}.csv`, peopleToCsv(sortPeople(people, 'name', today)), 'text/csv')}
        className="mt-4 flex min-h-11 items-center gap-2 px-2 text-[15px] text-muted"
      >
        <FileSpreadsheet size={18} /> {t.people.exportCsv}
      </button>
    </div>
  )
}

function PersonRow({ person: p, today }: { person: Person; today: DayKey }) {
  const since = daysSinceContact(p, today)
  const overdue = isContactOverdue(p, today)
  const bd = nextBirthday(p.birthday, today)
  return (
    <li>
      <Link to={`/people/${p.id}`} className="flex items-center gap-3 rounded-3xl bg-surface p-3 shadow-soft">
        <Avatar person={p} size={48} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[16px] font-semibold">{p.name}</span>
            {p.favorite && <Star size={14} className="shrink-0 text-[#e8a33a]" fill="currentColor" aria-label={t.people.favorite} />}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
            <span>{t.people.groups[p.group]}</span>
            {overdue ? (
              <span className="rounded-full bg-[#e8913a]/15 px-2 font-semibold text-warn">{t.people.overdue}</span>
            ) : (
              since !== null && <span>{t.people.daysAgo(since)}</span>
            )}
            {bd && bd.daysLeft <= 7 && (
              <span className="flex items-center gap-0.5 text-pink">
                <Cake size={13} /> {bd.daysLeft === 0 ? t.dates.today : `${bd.daysLeft} дн.`}
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  )
}

/* ---------- Банк тем ---------- */

function TopicBank() {
  const topics = useLiveQuery(
    async () => (await db.topics.toArray()).filter((x) => !x.personId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [],
  )
  const people = useLiveQuery(() => db.people.orderBy('name').toArray(), []) ?? []
  const [text, setText] = useState('')
  const [giving, setGiving] = useState<Topic | null>(null)

  async function add() {
    const v = text.trim()
    if (!v) return
    setText('')
    await addTopic(v)
  }

  if (!topics) return null
  const open = topics.filter((x) => x.status === 'open')
  const done = topics.filter((x) => x.status === 'discussed')

  return (
    <div className="space-y-3">
      <p className="px-1 text-[14px] text-muted">{t.people.bankHint}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
        className="flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.people.addTopic}
          aria-label={t.people.addTopic}
          enterKeyHint="done"
          className="min-h-12 min-w-0 flex-1 rounded-2xl bg-surface px-4 shadow-soft outline-none ring-accent focus:ring-2 placeholder:text-muted"
        />
        <button type="submit" aria-label={t.people.addTopic} disabled={!text.trim()} className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent disabled:opacity-40">
          <Plus size={24} />
        </button>
      </form>

      {topics.length === 0 ? (
        <EmptyState emoji="💡" text={t.people.bankEmpty} />
      ) : (
        <Card className="p-1.5">
          <ul>
            {[...open, ...done].map((topic) => (
              <li key={topic.id} className="flex items-center gap-1">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={topic.status === 'discussed'}
                  aria-label={`${t.people.discussed}: ${topic.text}`}
                  onClick={() => void toggleTopic(topic.id)}
                  className="flex size-11 shrink-0 items-center justify-center"
                >
                  {topic.status === 'discussed' ? (
                    <span className="flex size-6 items-center justify-center rounded-full bg-accent text-on-accent">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  ) : (
                    <Lightbulb size={20} className="text-accent" />
                  )}
                </button>
                <span className={`flex-1 py-2 text-[16px] ${topic.status === 'discussed' ? 'text-muted line-through' : ''}`}>{topic.text}</span>
                {people.length > 0 && (
                  <button type="button" aria-label={`${t.people.giveTo}: ${topic.text}`} onClick={() => setGiving(topic)} className="flex size-11 items-center justify-center text-muted">
                    <UserRoundPlus size={19} />
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`${t.people.deleteTopic}: ${topic.text}`}
                  onClick={async () => {
                    const snap = await deleteTopic(topic.id)
                    if (snap) showToast(t.people.deleteTopic, { label: t.plan.undo, run: () => void db.topics.put(snap) })
                  }}
                  className="flex size-11 items-center justify-center text-muted"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Sheet open={giving !== null} onClose={() => setGiving(null)} title={t.people.giveTo}>
        {giving && <p className="mb-3 text-[15px] text-muted">«{giving.text}»</p>}
        <ul className="space-y-1 pb-4">
          {people.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={async () => {
                  if (!giving) return
                  await assignTopic(giving.id, p.id)
                  setGiving(null)
                  showToast(t.people.given(p.name))
                }}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left active:bg-surface-2"
              >
                <Avatar person={p} size={36} />
                <span className="font-medium">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  )
}

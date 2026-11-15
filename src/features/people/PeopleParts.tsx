import { useRef, useState } from 'react'
import { Camera, Star, Trash2 } from 'lucide-react'
import { Sheet } from '../../components/Sheet'
import { Chip, Segmented } from '../../components/Segmented'
import { addInteraction, addPerson, updatePerson } from '../../db/people'
import { PERSON_GROUPS, type Interaction, type Person, type PersonGroup } from '../../db/types'
import { compressPhoto } from '../../lib/image'
import { initials } from '../../lib/people'
import { todayKey } from '../../lib/dates'
import { showToast } from '../../lib/toast'
import { t } from '../../i18n/ru'

const GROUP_COLORS: Record<PersonGroup, string> = {
  family: '#e5654b',
  friends: '#e8913a',
  partners: '#3b82c4',
  suppliers: '#2a9d82',
  clients: '#8b6fd6',
  club: '#d4a03a',
  study: '#5aa55a',
  other: '#8a7f75',
}

export function Avatar({ person, size = 48 }: { person: Pick<Person, 'name' | 'photo' | 'group'>; size?: number }) {
  const color = GROUP_COLORS[person.group]
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold"
      style={{ width: size, height: size, background: `${color}26`, color, fontSize: size * 0.38 }}
      aria-hidden
    >
      {person.photo ? <img src={person.photo} alt="" className="size-full object-cover" /> : initials(person.name)}
    </span>
  )
}

export const groupColor = (g: PersonGroup) => GROUP_COLORS[g]

const inputCls =
  'min-h-11 w-full rounded-xl bg-surface px-3 text-[16px] outline-none ring-accent focus:ring-2 placeholder:text-muted'

function Label({ children }: { children: string }) {
  return <h3 className="mt-5 mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">{children}</h3>
}

/* ---------- Новый человек / изменить ---------- */

export function PersonFormSheet({
  open,
  onClose,
  person,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  person?: Person
  onCreated?: (id: string) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={person ? t.people.edit : t.people.add}>
      {open && <PersonForm person={person} onDone={onClose} onCreated={onCreated} />}
    </Sheet>
  )
}

function splitBirthday(b?: string) {
  const full = b && /^(\d{4})-(\d{2})-(\d{2})$/.exec(b)
  if (full) return { year: full[1]!, month: String(Number(full[2])), day: String(Number(full[3])) }
  const short = b && /^(\d{2})-(\d{2})$/.exec(b)
  if (short) return { year: '', month: String(Number(short[1])), day: String(Number(short[2])) }
  return { year: '', month: '', day: '' }
}

function PersonForm({
  person,
  onDone,
  onCreated,
}: {
  person?: Person
  onDone: () => void
  onCreated?: (id: string) => void
}) {
  const [name, setName] = useState(person?.name ?? '')
  const [photo, setPhoto] = useState(person?.photo)
  const [group, setGroup] = useState<PersonGroup>(person?.group ?? 'friends')
  const [howWeMet, setHowWeMet] = useState(person?.howWeMet ?? '')
  const [phone, setPhone] = useState(person?.phone ?? '')
  const [telegram, setTelegram] = useState(person?.telegram ?? '')
  const [bday, setBday] = useState(splitBirthday(person?.birthday))
  const [every, setEvery] = useState(person?.contactEveryDays ?? 0)
  const [tags, setTags] = useState(person?.tags.join(', ') ?? '')
  const [favorite, setFavorite] = useState(person?.favorite ?? false)
  const fileInput = useRef<HTMLInputElement>(null)

  async function onPhoto(file?: File) {
    if (!file) return
    try {
      setPhoto(await compressPhoto(file))
    } catch {
      showToast(t.people.photoError)
    }
  }

  async function save() {
    const n = name.trim()
    if (!n) return
    const pad = (s: string) => s.padStart(2, '0')
    const birthday =
      bday.day && bday.month
        ? /^\d{4}$/.test(bday.year)
          ? `${bday.year}-${pad(bday.month)}-${pad(bday.day)}`
          : `${pad(bday.month)}-${pad(bday.day)}`
        : undefined
    const data = {
      name: n,
      photo,
      group,
      howWeMet: howWeMet.trim(),
      phone: phone.trim(),
      telegram: telegram.trim(),
      birthday,
      contactEveryDays: every,
      tags: tags
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      favorite,
    }
    if (person) {
      await updatePerson(person.id, data)
      onDone()
    } else {
      const id = await addPerson(data)
      onDone()
      onCreated?.(id)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      className="pb-4"
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          aria-label={t.people.choosePhoto}
          className="relative shrink-0"
        >
          <Avatar person={{ name: name || '?', photo, group }} size={76} />
          <span className="absolute -right-0.5 -bottom-0.5 flex size-7 items-center justify-center rounded-full bg-accent text-on-accent shadow-soft">
            <Camera size={15} />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.people.namePlaceholder}
            aria-label={t.people.name}
            className={`${inputCls} text-[18px] font-semibold`}
          />
          {photo && (
            <button type="button" onClick={() => setPhoto(undefined)} className="mt-1 flex min-h-9 items-center gap-1 text-[14px] text-muted">
              <Trash2 size={14} /> {t.people.removePhoto}
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void onPhoto(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>

      <Label>{t.people.group}</Label>
      <div className="flex flex-wrap gap-2">
        {PERSON_GROUPS.map((g) => (
          <Chip key={g} active={group === g} color={GROUP_COLORS[g]} onClick={() => setGroup(g)}>
            {t.people.groups[g]}
          </Chip>
        ))}
      </div>

      <Label>{t.people.phone}</Label>
      <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+992 …" aria-label={t.people.phone} className={inputCls} />

      <Label>{t.people.telegram}</Label>
      <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder={t.people.telegramPlaceholder} aria-label={t.people.telegram} autoCapitalize="none" className={inputCls} />

      <Label>{t.people.birthday}</Label>
      <div className="flex gap-2">
        <select aria-label={t.people.day} value={bday.day} onChange={(e) => setBday((b) => ({ ...b, day: e.target.value }))} className={`${inputCls} w-20`}>
          <option value="">—</option>
          {Array.from({ length: 31 }, (_, i) => (
            <option key={i} value={String(i + 1)}>
              {i + 1}
            </option>
          ))}
        </select>
        <select aria-label={t.people.month} value={bday.month} onChange={(e) => setBday((b) => ({ ...b, month: e.target.value }))} className={`${inputCls} flex-1`}>
          <option value="">—</option>
          {t.people.months.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </select>
        <input
          inputMode="numeric"
          maxLength={4}
          value={bday.year}
          onChange={(e) => setBday((b) => ({ ...b, year: e.target.value.replace(/\D/g, '') }))}
          placeholder="год"
          aria-label={t.people.year}
          className={`${inputCls} w-24`}
        />
      </div>

      <Label>{t.people.contactEvery}</Label>
      <div className="flex flex-wrap gap-2">
        {t.people.contactOptions.map(([n, label]) => (
          <Chip key={n} active={every === n} onClick={() => setEvery(n)}>
            {label}
          </Chip>
        ))}
      </div>

      <Label>{t.people.howWeMet}</Label>
      <input value={howWeMet} onChange={(e) => setHowWeMet(e.target.value)} aria-label={t.people.howWeMet} className={inputCls} />

      <Label>{t.people.tags}</Label>
      <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t.people.tagsPlaceholder} aria-label={t.people.tags} className={inputCls} />

      <label className="mt-5 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-surface px-3">
        <Star size={20} className="text-[#e8a33a]" fill={favorite ? 'currentColor' : 'none'} />
        <span className="flex-1">{t.people.favorite}</span>
        <input type="checkbox" className="toggle" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
      </label>

      <button type="submit" disabled={!name.trim()} className="mt-6 min-h-12 w-full rounded-2xl bg-accent font-semibold text-on-accent disabled:opacity-50">
        {person ? t.people.save : t.people.create}
      </button>
    </form>
  )
}

/* ---------- Записать разговор ---------- */

export function InteractionSheet({ personId, open, onClose }: { personId: string; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={t.people.logTalk}>
      {open && <InteractionForm personId={personId} onDone={onClose} />}
    </Sheet>
  )
}

function InteractionForm({ personId, onDone }: { personId: string; onDone: () => void }) {
  const [type, setType] = useState<Interaction['type']>('meeting')
  const [date, setDate] = useState(todayKey())
  const [summary, setSummary] = useState('')
  const [followUp, setFollowUp] = useState('')

  async function save() {
    await addInteraction({ personId, type, date: date || todayKey(), summary, followUp })
    showToast(t.people.talkSaved)
    onDone()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      className="pb-4"
    >
      <Segmented
        label={t.people.logTalk}
        value={type}
        onChange={setType}
        options={(['meeting', 'call', 'message'] as const).map((id) => ({ id, label: `${t.people.typeEmoji[id]} ${t.people.types[id]}` }))}
      />
      <Label>{t.wins.date}</Label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t.wins.date} className={`${inputCls} w-auto`} />
      <Label>{t.people.summary}</Label>
      <textarea autoFocus rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} aria-label={t.people.summary} className={`${inputCls} resize-none py-2.5`} />
      <Label>{t.people.followUp}</Label>
      <input value={followUp} onChange={(e) => setFollowUp(e.target.value)} aria-label={t.people.followUp} className={inputCls} />
      <button type="submit" className="mt-6 min-h-12 w-full rounded-2xl bg-accent font-semibold text-on-accent">
        {t.people.save}
      </button>
    </form>
  )
}

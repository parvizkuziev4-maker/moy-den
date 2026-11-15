import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarPlus, Check, ChevronRight, Lock, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Card } from '../../components/Page'
import { Chip } from '../../components/Segmented'
import { Sheet } from '../../components/Sheet'
import { PinPad } from '../../components/PinPad'
import { db } from '../../db/db'
import { hasDemo, loadDemo, removeDemo } from '../../db/demo'
import { exportAll } from '../../db/backupIO'
import { wipeAllData } from '../../db/wipe'
import type { Area } from '../../db/types'
import { backupFileName } from '../../lib/backup'
import { buildIcs, habitEvent, type IcsEvent } from '../../lib/ics'
import { newId, nowIso } from '../../lib/id'
import { checkPin, hashPin, pinSupported } from '../../lib/pin'
import { setPinFlag, markUnlockedOnce } from '../../lib/lock'
import { setPrefs, usePrefs } from '../../lib/prefs'
import { shareOrDownload } from '../../lib/share'
import { showToast } from '../../lib/toast'
import { t } from '../../i18n/ru'

function Label({ children }: { children: string }) {
  return <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">{children}</h2>
}

/* ---------- Сферы жизни ---------- */

const AREA_COLORS = ['#3b82c4', '#8b6fd6', '#e5654b', '#2a9d82', '#e8913a', '#d9578a', '#5aa55a', '#d4a03a']
const AREA_EMOJIS = ['💼', '📚', '🏡', '💪', '🤝', '✨', '💰', '🕌', '🎨', '✈️', '🧠', '❤️']

export function AreasSection() {
  const areas = useLiveQuery(() => db.areas.orderBy('order').toArray(), []) ?? []
  const [editing, setEditing] = useState<Area | 'new' | null>(null)
  return (
    <div>
      <Label>{t.areas.title}</Label>
      <Card className="p-1.5">
        <ul>
          {areas.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => setEditing(a)} className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-2.5 text-left active:bg-surface-2">
                <span className="text-[20px]" aria-hidden>
                  {a.emoji}
                </span>
                <span className="flex-1 text-[16px]">{a.name}</span>
                <span className="size-3 rounded-full" style={{ background: a.color }} aria-hidden />
                <ChevronRight size={18} className="text-muted" />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setEditing('new')} className="flex min-h-12 w-full items-center gap-2 px-2.5 font-semibold text-accent">
          <Plus size={20} /> {t.areas.add}
        </button>
      </Card>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? t.areas.add : t.areas.edit}>
        {editing && (
          <AreaForm key={editing === 'new' ? 'new' : editing.id} area={editing === 'new' ? undefined : editing} order={areas.length} onDone={() => setEditing(null)} />
        )}
      </Sheet>
    </div>
  )
}

function AreaForm({ area, order, onDone }: { area?: Area; order: number; onDone: () => void }) {
  const [name, setName] = useState(area?.name ?? '')
  const [emoji, setEmoji] = useState(area?.emoji ?? '✨')
  const [color, setColor] = useState(area?.color ?? AREA_COLORS[0]!)

  async function save() {
    const n = name.trim()
    if (!n) return
    const now = nowIso()
    if (area) await db.areas.update(area.id, { name: n, emoji, color, updatedAt: now })
    else await db.areas.add({ id: newId(), name: n, emoji, color, order, createdAt: now, updatedAt: now })
    onDone()
  }
  async function remove() {
    if (!area) return
    await db.areas.delete(area.id)
    onDone()
    showToast(t.areas.deleted, { label: t.plan.undo, run: () => void db.areas.put(area) })
  }

  const label = 'mt-5 mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase'
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      className="pb-4"
    >
      <input
        autoFocus={!area}
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label={t.areas.name}
        placeholder={t.areas.name}
        className="min-h-11 w-full rounded-xl bg-surface px-3 text-[17px] outline-none ring-accent focus:ring-2"
      />
      <h3 className={label}>{t.areas.emoji}</h3>
      <div className="flex flex-wrap gap-1.5">
        {AREA_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            aria-pressed={emoji === e}
            onClick={() => setEmoji(e)}
            className={`flex size-11 items-center justify-center rounded-xl text-[22px] ${emoji === e ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface'}`}
          >
            {e}
          </button>
        ))}
      </div>
      <h3 className={label}>{t.areas.color}</h3>
      <div className="flex flex-wrap gap-2">
        {AREA_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={color === c}
            onClick={() => setColor(c)}
            className="flex size-11 items-center justify-center rounded-full"
            style={{ background: c, boxShadow: color === c ? `0 0 0 3px var(--bg), 0 0 0 5px ${c}` : undefined }}
          >
            {color === c && <Check size={20} color="#fff" strokeWidth={3} />}
          </button>
        ))}
      </div>
      <button type="submit" disabled={!name.trim()} className="mt-6 min-h-12 w-full rounded-2xl bg-accent font-semibold text-on-accent disabled:opacity-50">
        {t.habits.save}
      </button>
      {area && (
        <>
          <button type="button" onClick={() => void remove()} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface-2 font-semibold text-danger">
            <Trash2 size={18} /> {t.areas.delete}
          </button>
          <p className="mt-1.5 text-center text-[13px] text-muted">{t.areas.deleteHint}</p>
        </>
      )}
    </form>
  )
}

/* ---------- Напоминания ---------- */

export async function shareIcs(events: IcsEvent[], fileName: string) {
  await shareOrDownload(fileName, buildIcs(events), 'text/calendar')
}

export function RemindersSection() {
  const { reminderLeadMinutes } = usePrefs()
  const habits = useLiveQuery(async () => (await db.habits.orderBy('order').toArray()).filter((h) => !h.archived), []) ?? []
  const events = habits.flatMap((h) => {
    const e = habitEvent(h, reminderLeadMinutes)
    return e ? [e] : []
  })
  return (
    <div>
      <Label>{t.remind.title}</Label>
      <Card className="space-y-3 p-4">
        <div>
          <p className="mb-2 text-[14px] text-muted">{t.remind.lead}</p>
          <div className="flex flex-wrap gap-2">
            {t.remind.leadOptions.map((n) => (
              <Chip key={n} active={reminderLeadMinutes === n} onClick={() => setPrefs({ reminderLeadMinutes: n })}>
                {t.remind.leadLabel(n)}
              </Chip>
            ))}
          </div>
        </div>
        <button
          type="button"
          disabled={events.length === 0}
          onClick={() => void shareIcs(events, t.remind.fileName)}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface-2 font-semibold disabled:opacity-50"
        >
          <CalendarPlus size={19} className="text-accent" /> {t.remind.all}
          {events.length > 0 && ` · ${events.length}`}
        </button>
        <p className="text-[13px] text-muted">{events.length === 0 ? t.remind.none : t.remind.howTo}</p>
      </Card>
    </div>
  )
}

/* ---------- PIN-код ---------- */

type PinStep = 'create' | 'repeat' | 'disable' | 'change-old' | null

export function PinSection() {
  const { pinHash } = usePrefs()
  const [step, setStep] = useState<PinStep>(null)
  const [first, setFirst] = useState('')
  const [error, setError] = useState<string>()
  const supported = pinSupported()

  const close = () => {
    setStep(null)
    setFirst('')
    setError(undefined)
  }

  async function onComplete(pin: string): Promise<boolean> {
    if (step === 'create') {
      setFirst(pin)
      setStep('repeat')
      setError(undefined)
      return true
    }
    if (step === 'repeat') {
      if (pin !== first) {
        setStep('create')
        setError(t.pin.mismatch)
        return false
      }
      setPrefs({ pinHash: await hashPin(pin) })
      setPinFlag(true)
      markUnlockedOnce()
      close()
      showToast(t.pin.set)
      return true
    }
    if (step === 'disable' || step === 'change-old') {
      if (!(await checkPin(pin, pinHash))) {
        setError(t.pin.wrong)
        return false
      }
      if (step === 'disable') {
        setPrefs({ pinHash: undefined })
        setPinFlag(false)
        close()
        showToast(t.pin.off)
      } else {
        setStep('create')
        setError(undefined)
      }
      return true
    }
    return true
  }

  const title =
    step === 'repeat' ? t.pin.repeat : step === 'disable' || step === 'change-old' ? t.pin.current : t.pin.create

  return (
    <div>
      <Label>{t.pin.title}</Label>
      <Card className="p-0">
        <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3">
          <Lock size={20} className="shrink-0 text-accent" />
          <span className="flex-1 text-[16px]">{t.pin.on}</span>
          <input
            type="checkbox"
            role="switch"
            className="toggle"
            disabled={!supported}
            checked={!!pinHash}
            onChange={(e) => setStep(e.target.checked ? 'create' : 'disable')}
          />
        </label>
        {pinHash && (
          <button type="button" onClick={() => setStep('change-old')} className="flex min-h-12 w-full items-center border-t border-line px-4 text-left text-[16px] text-accent">
            {t.pin.change}
          </button>
        )}
        <p className="border-t border-line px-4 py-3 text-[13px] leading-snug text-muted">
          {supported ? `${t.pin.hint} ${t.pin.autolock}` : t.pin.unsupported}
        </p>
      </Card>
      <Sheet open={step !== null} onClose={close} title={t.pin.title}>
        <div className="pb-6">{step && <PinPad key={step} title={title} error={error} onComplete={onComplete} />}</div>
      </Sheet>
    </div>
  )
}

/* ---------- Пример данных и удаление ---------- */

export function DataSection() {
  const demo = useLiveQuery(() => hasDemo(), [])
  const [busy, setBusy] = useState(false)
  const [wipeOpen, setWipeOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)

  async function toggleDemo() {
    setBusy(true)
    try {
      if (demo) {
        await removeDemo()
        showToast(t.danger.demoRemoved)
      } else {
        await loadDemo()
        showToast(t.danger.demoLoaded)
      }
    } finally {
      setBusy(false)
    }
  }

  async function backupFirst() {
    const ok = await shareOrDownload(backupFileName(), JSON.stringify(await exportAll(), null, 1), 'application/json')
    if (ok) setPrefs({ lastBackupAt: new Date().toISOString() })
  }

  return (
    <div>
      <Label>{t.danger.title}</Label>
      <Card className="space-y-3 p-4">
        <button
          type="button"
          disabled={busy || demo === undefined}
          onClick={() => void toggleDemo()}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface-2 font-semibold disabled:opacity-50"
        >
          <Sparkles size={18} className="text-accent" /> {demo ? t.danger.demoRemove : t.danger.demoLoad}
        </button>
        <p className="text-[13px] text-muted">{demo ? t.danger.demoRemoveHint : t.danger.demoLoadHint}</p>
        <button
          type="button"
          onClick={() => setWipeOpen(true)}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface-2 font-semibold text-danger"
        >
          <Trash2 size={18} /> {t.danger.wipe}
        </button>
      </Card>
      <Sheet
        open={wipeOpen}
        onClose={() => {
          setWipeOpen(false)
          setConfirm(false)
        }}
        title={t.danger.wipe}
      >
        <div className="space-y-3 pb-4">
          <p className="text-[15px] leading-relaxed">{t.danger.wipeHint}</p>
          <button type="button" onClick={() => void backupFirst()} className="min-h-12 w-full rounded-2xl bg-accent font-semibold text-on-accent">
            {t.danger.wipeBackupFirst}
          </button>
          <button
            type="button"
            onClick={() => (confirm ? void wipeAllData() : setConfirm(true))}
            className={`min-h-12 w-full rounded-2xl font-semibold ${confirm ? 'bg-danger-solid text-white' : 'bg-surface-2 text-danger'}`}
          >
            {confirm ? t.danger.wipeConfirm : t.danger.wipe}
          </button>
        </div>
      </Sheet>
    </div>
  )
}

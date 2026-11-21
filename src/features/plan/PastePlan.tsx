import { useEffect, useMemo, useState } from 'react'
import { ClipboardPaste } from 'lucide-react'
import { Sheet } from '../../components/Sheet'
import { Card } from '../../components/Page'
import { parsePlanText } from '../../lib/planText'
import { applyPlan, previewPlan, type PlanPreview } from '../../db/planImport'
import { dayLabel, todayKey } from '../../lib/dates'
import { showToast } from '../../lib/toast'
import { t } from '../../i18n/ru'

/**
 * «Вставить план»: скопировал текст плана (например, из чата) → вставил сюда → «Добавить».
 * Только добавляет: старые задачи и люди не меняются и не удаляются.
 */
export function PastePlan({
  open,
  onClose,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  onAdded: (firstDate?: string) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={t.pastePlan.title}>
      {open && <PastePlanForm onDone={(d) => (onAdded(d), onClose())} />}
    </Sheet>
  )
}

function PastePlanForm({ onDone }: { onDone: (firstDate?: string) => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ plan: unknown; p: PlanPreview } | null>(null)
  const today = todayKey()
  const plan = useMemo(() => parsePlanText(text, today), [text, today])
  const dates = [...new Set(plan.tasks.map((x) => x.date))].sort()
  const empty = plan.tasks.length === 0 && plan.people.length === 0

  useEffect(() => {
    if (empty) return
    let alive = true
    void previewPlan(plan).then((p) => alive && setResult({ plan, p }))
    return () => {
      alive = false
    }
  }, [plan, empty])
  // Предпросмотр показываем только для текущего текста (старый — не показываем).
  const preview = result && result.plan === plan ? result.p : null

  async function pasteFromClipboard() {
    try {
      const v = await navigator.clipboard.readText()
      if (v.trim()) setText(v)
      else showToast(t.pastePlan.clipboardEmpty)
    } catch {
      showToast(t.pastePlan.clipboardDenied)
    }
  }

  async function add() {
    setBusy(true)
    try {
      const r = await applyPlan(plan)
      showToast(t.pastePlan.done(r.newTasks, r.newTopics))
      onDone(r.firstDate)
    } catch {
      showToast(t.pastePlan.failed)
      setBusy(false)
    }
  }

  const nothingNew =
    preview && preview.newTasks === 0 && preview.newTopics === 0 && preview.newPeople.length === 0

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => void pasteFromClipboard()}
        className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl font-semibold ${
          empty ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink'
        }`}
      >
        <ClipboardPaste size={20} /> {t.pastePlan.paste}
      </button>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        aria-label={t.pastePlan.title}
        placeholder={t.pastePlan.placeholder}
        className="w-full resize-none rounded-xl bg-surface px-3 py-2.5 text-[15px] outline-none ring-accent focus:ring-2 placeholder:text-muted"
      />

      {empty ? (
        <p className="px-1 text-[13px] text-muted">{t.pastePlan.hint}</p>
      ) : (
        <Card className="p-4">
          <h3 className="mb-2 font-semibold">{t.pastePlan.willAdd}</h3>
          <ul className="space-y-1 text-[15px]">
            {preview && preview.newTasks > 0 && (
              <li>
                {t.pastePlan.tasks(preview.newTasks)}
                {dates.length > 0 && (
                  <span className="text-muted">
                    {' '}
                    · {dates.map((d) => dayLabel(d, today)).join(', ')}
                  </span>
                )}
              </li>
            )}
            {preview && preview.newTopics > 0 && <li>{t.pastePlan.topics(preview.newTopics)}</li>}
            {preview && preview.knownPeople.length > 0 && (
              <li>
                {t.pastePlan.known}: {preview.knownPeople.join(', ')}
              </li>
            )}
            {preview && preview.newPeople.length > 0 && (
              <li>
                {t.pastePlan.newPeople}: {preview.newPeople.join(', ')}
              </li>
            )}
            {preview && preview.sameTasks > 0 && (
              <li className="text-muted">{t.pastePlan.same(preview.sameTasks)}</li>
            )}
            {nothingNew && <li className="text-muted">{t.pastePlan.nothingNew}</li>}
          </ul>
          {plan.skipped.length > 0 && (
            <p className="mt-2 text-[13px] text-red-600 dark:text-red-400">
              {t.pastePlan.skipped}: {plan.skipped.map((s) => s.text).join(' · ')}
            </p>
          )}
        </Card>
      )}

      <button
        type="button"
        disabled={busy || empty || !preview || !!nothingNew}
        onClick={() => void add()}
        className="min-h-12 w-full rounded-2xl bg-accent font-semibold text-on-accent disabled:opacity-40"
      >
        {t.pastePlan.add}
      </button>
      <p className="px-1 text-[13px] text-muted">{t.pastePlan.safe}</p>
    </div>
  )
}

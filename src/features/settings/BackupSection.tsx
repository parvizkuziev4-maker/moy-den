import { useEffect, useRef, useState } from 'react'
import { differenceInDays, format } from 'date-fns'
import { ru as ruLocale } from 'date-fns/locale'
import { AlertTriangle, Download, ShieldCheck, Upload } from 'lucide-react'
import { Card } from '../../components/Page'
import { Sheet } from '../../components/Sheet'
import { DATA_TABLES } from '../../db/db'
import { exportAll, importAll, type ImportMode } from '../../db/backupIO'
import { backupFileName, parseBackup, summarize, type Backup } from '../../lib/backup'
import { shareOrDownload } from '../../lib/share'
import { loadPrefsFromDb, setPrefs, usePrefs } from '../../lib/prefs'
import { t } from '../../i18n/ru'

type Status = { kind: 'ok' | 'error'; text: string } | null

const fmt = (iso: string) => format(new Date(iso), 'd MMMM yyyy, HH:mm', { locale: ruLocale })

export function BackupSection() {
  const { lastBackupAt } = usePrefs()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [pending, setPending] = useState<Backup | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [persisted, setPersisted] = useState(false)

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  const stale = !lastBackupAt || differenceInDays(new Date(), new Date(lastBackupAt)) >= 7

  async function save() {
    setBusy(true)
    setStatus(null)
    try {
      const backup = await exportAll()
      const ok = await shareOrDownload(backupFileName(), JSON.stringify(backup, null, 1), 'application/json')
      if (ok) {
        setPrefs({ lastBackupAt: new Date().toISOString() })
        setStatus({ kind: 'ok', text: t.backup.saved })
      }
    } catch {
      setStatus({ kind: 'error', text: t.backup.failed })
    } finally {
      setBusy(false)
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setStatus(null)
    setConfirmReplace(false)
    const r = parseBackup(await file.text())
    if (r.ok) {
      setPending(r.backup)
      setParseError(null)
    } else {
      setPending(null)
      setParseError(r.error)
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  async function restore(mode: ImportMode) {
    if (!pending) return
    if (mode === 'replace' && !confirmReplace) {
      setConfirmReplace(true)
      return
    }
    setBusy(true)
    try {
      const n = await importAll(pending.data, mode)
      await loadPrefsFromDb()
      setStatus({ kind: 'ok', text: t.backup.done(n) })
    } catch {
      setStatus({ kind: 'error', text: t.backup.failed })
    } finally {
      setBusy(false)
      closeSheet()
    }
  }

  function closeSheet() {
    setPending(null)
    setParseError(null)
    setConfirmReplace(false)
  }

  const summary = pending ? summarize(pending.data) : null
  const total = summary ? DATA_TABLES.reduce((s, k) => s + summary[k], 0) : 0

  return (
    <div>
      <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">{t.backup.title}</h2>
      <Card className="space-y-3 p-4">
        <p className="text-[15px] leading-snug text-muted">{t.backup.explain}</p>

        <div className={`flex items-center gap-2 text-[15px] ${stale ? 'text-accent' : ''}`}>
          {stale ? <AlertTriangle size={18} aria-hidden /> : <ShieldCheck size={18} className="text-accent" aria-hidden />}
          <span>
            {lastBackupAt ? `${t.backup.last}: ${fmt(lastBackupAt)}` : t.backup.never}
            {lastBackupAt && stale && ` · ${t.backup.stale}`}
          </span>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent font-semibold text-on-accent transition active:scale-[0.98] disabled:opacity-60"
        >
          <Upload size={20} /> {t.backup.save}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface-2 font-semibold transition active:scale-[0.98] disabled:opacity-60"
        >
          <Download size={20} /> {t.backup.restore}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />

        {status && (
          <p role="status" className={`text-[15px] font-medium ${status.kind === 'ok' ? 'text-accent' : 'text-red-600'}`}>
            {status.text}
          </p>
        )}
        {persisted && <p className="text-[13px] text-muted">✓ {t.backup.persisted}</p>}
      </Card>

      <Sheet open={pending !== null || parseError !== null} onClose={closeSheet} title={t.backup.checkTitle}>
        {parseError && (
          <p className="flex items-start gap-2 rounded-2xl bg-red-500/10 p-4 text-[15px] text-red-700 dark:text-red-300">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" /> {parseError}
          </p>
        )}
        {pending && summary && (
          <div className="space-y-4">
            {pending.exportedAt && (
              <p className="text-[15px] text-muted">
                {t.backup.from} {fmt(pending.exportedAt)}
              </p>
            )}
            <Card className="p-4">
              <h3 className="mb-2 font-semibold">{t.backup.found}</h3>
              {total === 0 ? (
                <p className="text-muted">{t.backup.empty}</p>
              ) : (
                <ul className="space-y-1 text-[15px]">
                  {DATA_TABLES.filter((k) => summary[k] > 0 && k !== 'settings').map((k) => (
                    <li key={k} className="flex justify-between">
                      <span>{t.tables[k]}</span>
                      <span className="font-semibold tabular-nums">{summary[k]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <div>
              <button
                type="button"
                disabled={busy || total === 0}
                onClick={() => void restore('merge')}
                className="min-h-12 w-full rounded-2xl bg-accent font-semibold text-on-accent disabled:opacity-60"
              >
                {t.backup.merge}
              </button>
              <p className="mt-1.5 px-1 text-[13px] text-muted">{t.backup.mergeHint}</p>
            </div>
            <div>
              <button
                type="button"
                disabled={busy || total === 0}
                onClick={() => void restore('replace')}
                className={`min-h-12 w-full rounded-2xl font-semibold disabled:opacity-60 ${
                  confirmReplace ? 'bg-red-600 text-white' : 'bg-surface-2 text-red-600 dark:text-red-400'
                }`}
              >
                {confirmReplace ? t.backup.replaceConfirm : t.backup.replace}
              </button>
              <p className="mt-1.5 px-1 text-[13px] text-muted">{t.backup.replaceHint}</p>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}

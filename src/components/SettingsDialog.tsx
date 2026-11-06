import { useEffect, useRef, useState, type ComponentType } from 'react'
import {
  Check,
  Database,
  Download,
  ExternalLink,
  FileJson,
  FileText,
  HardDrive,
  Info,
  Monitor,
  Moon,
  Palette,
  PartyPopper,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react'
import type { Note, Snapshot, ThemeMode } from '../types'
import { useStore } from '../store/useStore'
import { ACCENTS } from '../lib/covers'
import { fullDate, relativeTime } from '../lib/date'
import { downloadText, markdownToBlocks } from '../lib/markdown'
import { clearSnapshots, deleteSnapshot, exportBackup, listSnapshots, parseBackup } from '../lib/backup'
import { estimateStorage } from '../lib/storage'
import { Modal } from './Modal'

const THEMES: Array<{ id: ThemeMode; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'light', label: 'Açık', icon: Sun },
  { id: 'dark', label: 'Koyu', icon: Moon },
  { id: 'system', label: 'Sistem', icon: Monitor },
]

export function SettingsDialog() {
  const dialog = useStore((state) => state.dialog)
  const closeDialog = useStore((state) => state.closeDialog)
  const settings = useStore((state) => state.settings)
  const notes = useStore((state) => state.notes)
  const updateSettings = useStore((state) => state.updateSettings)
  const markBackupDone = useStore((state) => state.markBackupDone)
  const importNotes = useStore((state) => state.importNotes)
  const resetAll = useStore((state) => state.resetAll)
  const createNote = useStore((state) => state.createNote)
  const pushToast = useStore((state) => state.pushToast)
  const openDialog = useStore((state) => state.openDialog)

  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [pendingImport, setPendingImport] = useState<Note[] | null>(null)
  const [pendingName, setPendingName] = useState('')
  const [importError, setImportError] = useState('')
  const [confirmSnapshot, setConfirmSnapshot] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const refreshMeta = () => {
    void listSnapshots().then(setSnapshots)
    void estimateStorage().then(setStorage)
    if (navigator.storage?.persisted) {
      void navigator.storage.persisted().then(setPersisted)
    }
  }

  useEffect(() => {
    if (dialog !== 'settings') return
    refreshMeta()
    setPendingImport(null)
    setImportError('')
    setConfirmSnapshot(null)
    setConfirmReset(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog])

  const noteCount = notes.filter((note) => !note.trashedAt).length
  const trashCount = notes.filter((note) => note.trashedAt).length

  const exportBackupFile = () => {
    const stamp = new Date().toISOString().slice(0, 10)
    downloadText(
      `bloknot-yedek-${stamp}.json`,
      exportBackup(notes),
      'application/json;charset=utf-8',
    )
    markBackupDone()
    pushToast('JSON yedeği indirildi.', 'success')
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setImportError('')

    try {
      const text = await file.text()

      if (/\.(md|markdown|txt)$/i.test(file.name)) {
        const title = file.name.replace(/\.[^.]+$/, '')
        createNote({ title, blocks: markdownToBlocks(text) })
        pushToast('Markdown notu içe aktarıldı.', 'success')
        return
      }

      const parsed = parseBackup(text)
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setImportError('Dosyada içe aktarılacak not bulunamadı.')
        return
      }
      setPendingImport(parsed)
      setPendingName(file.name)
    } catch {
      setImportError('Dosya okunamadı. Geçerli bir Bloknot JSON yedeği seç.')
    }
  }

  const applyImport = (mode: 'merge' | 'replace') => {
    if (!pendingImport) return
    const count = importNotes(pendingImport, mode)
    setPendingImport(null)
    setPendingName('')
    pushToast(`${count} not içe aktarıldı.`, 'success')
    refreshMeta()
  }

  const restore = (snapshot: Snapshot) => {
    importNotes(snapshot.notes, 'replace')
    setConfirmSnapshot(null)
    pushToast('Anlık yedek geri yüklendi.', 'success')
    refreshMeta()
  }

  const removeSnapshot = (snapshot: Snapshot) => {
    void deleteSnapshot(snapshot.id).then(() => {
      refreshMeta()
      pushToast('Anlık yedek silindi.')
    })
  }

  const handleReset = () => {
    resetAll()
    void clearSnapshots()
    setSnapshots([])
    setConfirmReset(false)
    pushToast('Tüm notlar ve ayarlar silindi.', 'danger')
  }

  const requestPersist = async () => {
    if (!navigator.storage?.persist) return
    const granted = await navigator.storage.persist()
    setPersisted(granted)
    pushToast(
      granted ? 'Kalıcı depolama açıldı.' : 'Tarayıcı kalıcı depolama izni vermedi.',
      granted ? 'success' : 'danger',
    )
  }

  const usageMb = storage ? storage.usage / 1024 / 1024 : 0
  const quotaMb = storage ? storage.quota / 1024 / 1024 : 0
  const usagePercent = storage && storage.quota > 0 ? Math.min(100, (storage.usage / storage.quota) * 100) : 0
  const backupOld =
    settings.lastBackupAt && Date.now() - settings.lastBackupAt > 14 * 86_400_000

  return (
    <Modal
      open={dialog === 'settings'}
      onClose={closeDialog}
      title="Ayarlar"
      subtitle="Görünümü değiştir, defterini güvenceye al."
      size="md"
    >
      <div className="space-y-6">
        <section>
          <SectionTitle icon={Palette} title="Görünüm" />
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-[var(--surface-2)] p-1">
            {THEMES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => updateSettings({ theme: id })}
                aria-pressed={settings.theme === id}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition ${
                  settings.theme === id
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
                    : 'text-[var(--text-soft)] hover:text-[var(--text)]'
                }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3.5">
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-[var(--text-faint)]">
              Vurgu rengi
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ACCENTS.map((accent) => (
                <button
                  key={accent.id}
                  type="button"
                  onClick={() => updateSettings({ accent: accent.id })}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-bold transition"
                  style={{
                    borderColor: settings.accent === accent.id ? accent.color : 'var(--border)',
                    background:
                      settings.accent === accent.id ? `color-mix(in oklab, ${accent.color} 14%, transparent)` : 'transparent',
                  }}
                  aria-pressed={settings.accent === accent.id}
                >
                  <span className="size-3 rounded-full" style={{ background: accent.color }} />
                  {accent.name}
                  {settings.accent === accent.id && <Check className="size-3" style={{ color: accent.color }} />}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 divide-y divide-[var(--border)]">
            <Toggle
              icon={Monitor}
              label="Sıkı yerleşim"
              description="Bloklar arasındaki boşluğu azalt."
              checked={settings.compact}
              onChange={(checked) => updateSettings({ compact: checked })}
            />
          </div>
        </section>

        <section>
          <SectionTitle icon={Sparkles} title="AI Asistan" />
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-extrabold">Groq / OpenRouter ile çalış</p>
                <p className="mt-0.5 max-w-md text-xs font-semibold leading-relaxed text-[var(--text-faint)]">
                  Notlarını düzelt, özetle, şemaya çevir veya görsel üret. Groq anahtarını gir,
                  tarayıcıdan doğrudan çalışır; istersen OpenRouter, xAI veya OpenAI kullan.
                </p>
              </div>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.08em] text-[var(--text-faint)]">
                İsteğe bağlı
              </span>
            </div>
            <button
              type="button"
              onClick={() => openDialog('ai')}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-extrabold text-[var(--accent-ink)] transition hover:bg-[var(--accent-strong)] active:scale-[0.98]"
            >
              <Sparkles className="size-3.5" />
              AI panelini aç
            </button>
          </div>
        </section>

        <section>
          <SectionTitle icon={PartyPopper} title="Deneyim" />
          <div className="divide-y divide-[var(--border)]">
            <Toggle
              icon={PartyPopper}
              label="Konfeti"
              description="Bir yapılacak işi tamamlayınca kutla."
              checked={settings.confetti}
              onChange={(checked) => updateSettings({ confetti: checked })}
            />
            <Toggle
              icon={Volume2}
              label="Arayüz sesleri"
              description="Küçük tıklama ve onay sesleri çal."
              checked={settings.sounds}
              onChange={(checked) => updateSettings({ sounds: checked })}
            />
          </div>
        </section>

        <section>
          <SectionTitle icon={Database} title="Yedekleme" />
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-extrabold">
                  {settings.lastBackupAt ? 'Son yedek' : 'Henüz yedek almadın'}
                </p>
                <p className={`mt-0.5 text-xs font-semibold ${backupOld ? 'text-amber-600' : 'text-[var(--text-faint)]'}`}>
                  {settings.lastBackupAt
                    ? `${relativeTime(settings.lastBackupAt)} · ${fullDate(settings.lastBackupAt)}`
                    : 'Notların yalnızca bu tarayıcıda duruyor.'}
                </p>
              </div>
              <button
                type="button"
                onClick={exportBackupFile}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-extrabold text-[var(--accent-ink)] transition hover:bg-[var(--accent-strong)]"
              >
                <Download className="size-3.5" />
                JSON yedeği indir
              </button>
            </div>
            <p className="mt-2 text-[0.68rem] text-[var(--text-faint)]">
              {noteCount} not · {trashCount} çöp kutusunda · {snapshots.length} anlık yedek
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-bold transition hover:bg-[var(--surface-2)]"
            >
              <Upload className="size-3.5" />
              Yedek / Markdown içe aktar
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,.md,.markdown,.txt,application/json,text/markdown,text/plain"
              className="hidden"
              onChange={(event) => {
                void handleFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />
            {persisted === false && (
              <button
                type="button"
                onClick={() => void requestPersist()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-bold transition hover:bg-[var(--surface-2)]"
              >
                <ShieldCheck className="size-3.5" />
                Kalıcı depolamayı aç
              </button>
            )}
            {persisted === true && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="size-3.5" />
                Kalıcı depolama açık
              </span>
            )}
          </div>

          {importError && (
            <p className="mt-2 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs font-bold text-[var(--danger)]">
              {importError}
            </p>
          )}

          {pendingImport && (
            <div className="animate-fade-up mt-3 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-mist)] p-3.5">
              <div className="flex items-start gap-2">
                <FileJson className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                <div>
                  <p className="text-sm font-extrabold">{pendingImport.length} not bulundu</p>
                  <p className="mt-0.5 text-xs text-[var(--text-soft)]">
                    {pendingName} · Mevcut notlarına eklemek mi istersin, üzerine yazmak mı?
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyImport('merge')}
                  className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-extrabold text-[var(--accent-ink)]"
                >
                  Birleştir
                </button>
                <button
                  type="button"
                  onClick={() => applyImport('replace')}
                  className="rounded-lg border border-[var(--danger)]/40 px-3 py-1.5 text-xs font-extrabold text-[var(--danger)]"
                >
                  Üzerine yaz
                </button>
                <button
                  type="button"
                  onClick={() => setPendingImport(null)}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--text-faint)] hover:bg-[var(--surface)]"
                >
                  Vazgeç
                </button>
              </div>
            </div>
          )}

          {snapshots.length > 0 && (
            <div className="mt-4">
              <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-[var(--text-faint)]">
                Anlık yedekler
              </p>
              <div className="mt-2 space-y-1.5">
                {snapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{fullDate(snapshot.createdAt)}</p>
                      <p className="text-[0.65rem] text-[var(--text-faint)]">
                        {snapshot.notes.length} not · {relativeTime(snapshot.createdAt)}
                      </p>
                    </div>
                    {confirmSnapshot === snapshot.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => restore(snapshot)}
                          className="rounded-md bg-[var(--danger)] px-2 py-1 text-[0.65rem] font-bold text-white"
                        >
                          Evet, geri dön
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmSnapshot(null)}
                          className="rounded-md px-2 py-1 text-[0.65rem] font-bold text-[var(--text-faint)]"
                        >
                          Vazgeç
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setConfirmSnapshot(snapshot.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[0.65rem] font-bold transition hover:bg-[var(--surface-2)]"
                        >
                          <RotateCcw className="size-3" />
                          Geri yükle
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSnapshot(snapshot)}
                          className="grid size-7 place-items-center rounded-md text-[var(--text-faint)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                          aria-label="Anlık yedeği sil"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[0.65rem] text-[var(--text-faint)]">
                Bloknot her 10 dakikada bir, son 5 anlık yedeği kendiliğinden tutar.
              </p>
            </div>
          )}
        </section>

        <section>
          <SectionTitle icon={HardDrive} title="Depolama" />
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Bu cihazdaki kullanım</span>
              <span className="text-[var(--text-faint)]">
                {storage ? `${usageMb.toFixed(1)} MB / ${Math.round(quotaMb)} MB` : 'Hesaplanıyor…'}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all"
                style={{ width: `${Math.max(2, usagePercent)}%` }}
              />
            </div>
            <p className="mt-2 text-[0.68rem] text-[var(--text-faint)]">
              Notlar ve görseller IndexedDB’de tutulur. Tarayıcı verilerini temizlersen notlar da silinir;
              düzenli yedek al.
            </p>
          </div>
        </section>

        <section>
          <SectionTitle icon={Info} title="Hakkında" />
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-extrabold">Bloknot 1.0</p>
                <p className="text-[0.68rem] text-[var(--text-faint)]">
                  Blok tabanlı, yerel ve ücretsiz not defteri.
                </p>
              </div>
              <a
                href="https://github.com/EkremTezcanSaridag/Bloknot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[0.68rem] font-bold transition hover:bg-[var(--surface-2)]"
              >
                GitHub
                <ExternalLink className="size-3" />
              </a>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[0.65rem] font-semibold text-[var(--text-faint)]">
              <ShieldCheck className="size-3.5 text-[var(--success)]" />
              Verilerin sunucuya gönderilmez. Paylaşım bağlantıları da notu URL içinde taşır.
            </p>
          </div>
        </section>

        <section>
          <SectionTitle icon={Trash2} title="Tehlikeli bölge" danger />
          <div className="rounded-xl border border-[var(--danger)]/35 bg-[var(--danger-soft)]/40 p-3.5">
            {confirmReset ? (
              <>
                <p className="text-sm font-extrabold text-[var(--danger)]">
                  Tüm notlar, etiketler ve ayarlar silinecek.
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-soft)]">
                  Bu işlem geri alınamaz. Anlık yedekler de temizlenir. Devam etmek istiyor musun?
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-lg bg-[var(--danger)] px-3 py-1.5 text-xs font-extrabold text-white"
                  >
                    Evet, her şeyi sil
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--text-soft)] hover:bg-[var(--surface)]"
                  >
                    Vazgeç
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-extrabold">Tüm verileri sil</p>
                <p className="mt-0.5 text-xs text-[var(--text-soft)]">
                  Bu tarayıcıdaki tüm Bloknot notlarını kalıcı olarak kaldırır.
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[var(--danger)]/40 px-3 py-1.5 text-xs font-bold text-[var(--danger)] transition hover:bg-[var(--danger)] hover:text-white"
                >
                  <Trash2 className="size-3.5" />
                  Tüm verileri sil
                </button>
              </>
            )}
          </div>
        </section>
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[0.62rem] font-semibold text-[var(--text-faint)]">
        <FileText className="size-3" />
        Açık kaynak · MIT lisansı · GitHub Pages’te yayınlanır
      </p>
    </Modal>
  )
}

function SectionTitle({
  icon: Icon,
  title,
  danger,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  danger?: boolean
}) {
  return (
    <h3
      className={`mb-2 flex items-center gap-1.5 text-[0.68rem] font-extrabold uppercase tracking-[0.14em] ${
        danger ? 'text-[var(--danger)]' : 'text-[var(--text-faint)]'
      }`}
    >
      <Icon className="size-3.5" />
      {title}
    </h3>
  )
}

function Toggle({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)]">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{label}</p>
        <p className="text-[0.68rem] text-[var(--text-faint)]">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  )
}

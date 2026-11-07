import { useEffect, useRef, useState } from 'react'
import { FileText, Loader2, Presentation, Upload } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Modal } from './Modal'
import { readPdfFile, readPptxFile, slidesToBlocks, type SlideDeck } from '../lib/slides'

export function SlideImportDialog() {
  const dialog = useStore((state) => state.dialog)
  const closeDialog = useStore((state) => state.closeDialog)
  const createNote = useStore((state) => state.createNote)
  const pushToast = useStore((state) => state.pushToast)

  const [file, setFile] = useState<File | null>(null)
  const [deck, setDeck] = useState<SlideDeck | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [includeNotes, setIncludeNotes] = useState(true)
  const [mode, setMode] = useState<'sections' | 'single'>('sections')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (dialog !== 'slides') {
      setFile(null)
      setDeck(null)
      setLoading(false)
      setCreating(false)
      setError('')
      setDragging(false)
    }
  }, [dialog])

  const handleFile = async (next: File) => {
    const lowerName = next.name.toLowerCase()
    const isPptx = lowerName.endsWith('.pptx')
    const isPdf = lowerName.endsWith('.pdf')

    if (!isPptx && !isPdf) {
      setError('Lütfen bir .pptx veya .pdf dosyası seç.')
      return
    }

    setFile(next)
    setDeck(null)
    setError('')
    setLoading(true)

    try {
      const parsed = isPdf ? await readPdfFile(next) : await readPptxFile(next)
      if (!parsed.slides.length) {
        throw new Error('Bu dosyadan metin çıkarlamadım.')
      }
      setDeck(parsed)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Dosya okunamadı.')
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    const next = event.dataTransfer.files?.[0]
    if (next) void handleFile(next)
  }

  const handleCreate = async () => {
    if (!deck) return
    setCreating(true)
    setError('')

    try {
      const blocks = slidesToBlocks(deck, mode, includeNotes)
      createNote({ title: deck.title, emoji: '📊', blocks })
      pushToast(`${deck.slides.length} slayt not olarak açıldı.`, 'success')
      closeDialog()
    } catch {
      setError('Not oluşturulamadı. Tekrar dene.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal
      open={dialog === 'slides'}
      onClose={closeDialog}
      title="Slayttan not"
      subtitle="PPTX veya PDF dosyasını sürükle veya seç. Metin tarayıcıda çıkarılır; dosya sunucuya gönderilmez."
      size="lg"
    >
      <div className="space-y-4">
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-5 text-center transition ${
            dragging
              ? 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]'
              : 'border-[var(--border-strong)] bg-[var(--surface)]'
          }`}
        >
          <Upload className="mx-auto size-6 text-[var(--accent-strong)]" />
          <p className="mt-2 text-sm font-extrabold">PPTX veya PDF dosyasını buraya sürükle</p>
          <p className="mt-1 text-xs font-semibold text-[var(--text-faint)]">
            veya dosya seç. Metin tarayıcıda çıkarılır.
          </p>
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-3.5 py-2 text-xs font-extrabold text-[var(--accent-ink)] transition hover:bg-[var(--accent-strong)]"
            >
              <FileText className="size-4" />
              Dosya seç
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pptx,.pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf"
            className="hidden"
            onChange={(event) => {
              const next = event.target.files?.[0]
              if (next) void handleFile(next)
              event.target.value = ''
            }}
          />
        </div>

        {file && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-soft)]">
            Seçilen dosya: <span className="font-extrabold text-[var(--text)]">{file.name}</span>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm font-semibold text-[var(--text-soft)]">
            <Loader2 className="size-4 animate-spin text-[var(--accent-strong)]" />
            Slaytlar okunuyor…
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-300/60 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        )}

        {deck && !loading && (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="text-sm font-extrabold">{deck.title}</p>
              <p className="mt-0.5 text-xs font-semibold text-[var(--text-faint)]">
                {deck.slides.length} slayt bulundu.
              </p>
            </div>

            <div className="max-h-56 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg)]">
              {deck.slides.map((slide) => (
                <div
                  key={slide.number}
                  className="border-b border-[var(--border)] px-3 py-2 last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid size-5 shrink-0 place-items-center rounded-md bg-[var(--surface-2)] text-[0.62rem] font-extrabold text-[var(--text-faint)]">
                      {slide.number}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-extrabold text-[var(--text)]">
                      {slide.title}
                    </span>
                    <span className="shrink-0 text-[0.62rem] font-semibold text-[var(--text-faint)]">
                      {slide.items.length} öğe
                      {slide.notes.length ? ' · not' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {deck.slides.some((slide) => slide.notes.length) && (
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-bold text-[var(--text-soft)]">
                  <input
                    type="checkbox"
                    checked={includeNotes}
                    onChange={(event) => setIncludeNotes(event.target.checked)}
                    className="size-4 accent-[var(--accent)]"
                  />
                  Konuşmacı notlarını da al
                </label>
              )}

              <label className="block">
                <span className="mb-1 block text-[0.62rem] font-extrabold uppercase tracking-[0.1em] text-[var(--text-faint)]">
                  Çıktı düzeni
                </span>
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value as 'sections' | 'single')}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs font-bold text-[var(--text)] outline-none focus:border-[var(--accent)]"
                >
                  <option value="sections">Slayt başına bölüm</option>
                  <option value="single">Tek not (tüm metin)</option>
                </select>
              </label>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={closeDialog} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-extrabold text-[var(--text-soft)] transition hover:bg-[var(--surface-2)]">
            Kapat
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!deck || loading || creating}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-3.5 py-2 text-xs font-extrabold text-[var(--accent-ink)] transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Presentation className="size-4" />}
            Notu oluştur
          </button>
        </div>
      </div>
    </Modal>
  )
}

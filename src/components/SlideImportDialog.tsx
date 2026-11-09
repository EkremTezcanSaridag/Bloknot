import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Presentation,
  RotateCcw,
  Sparkles,
  Upload,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { Modal } from './Modal'
import { readPdfFile, readPptxFile, slidesToBlocks, type Slide, type SlideDeck } from '../lib/slides'
import { AI_PROVIDERS, aiConfigFromSettings, chatComplete } from '../lib/ai'
import { getAiKey } from '../lib/aiKey'
import {
  SLIDE_AI_MODES,
  buildSlideAiPrompt,
  chunkDeckForAi,
  mergeAiChunk,
  parseSlideAiResponse,
  type SlideAiMode,
} from '../lib/slideAi'

export function SlideImportDialog() {
  const dialog = useStore((state) => state.dialog)
  const closeDialog = useStore((state) => state.closeDialog)
  const createNote = useStore((state) => state.createNote)
  const pushToast = useStore((state) => state.pushToast)
  const settings = useStore((state) => state.settings)

  const [file, setFile] = useState<File | null>(null)
  const [deck, setDeck] = useState<SlideDeck | null>(null)
  const [rawDeck, setRawDeck] = useState<SlideDeck | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [includeNotes, setIncludeNotes] = useState(true)
  const [mode, setMode] = useState<'sections' | 'single'>('sections')
  const [aiMode, setAiMode] = useState<SlideAiMode>('clean')
  const [aiExtra, setAiExtra] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiProgress, setAiProgress] = useState<{ done: number; total: number } | null>(null)
  const [aiApplied, setAiApplied] = useState(false)
  const [aiError, setAiError] = useState('')
  const [expandedSlide, setExpandedSlide] = useState<number | null>(null)
  const [excluded, setExcluded] = useState<Set<number>>(() => new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const aiAbortRef = useRef<AbortController | null>(null)

  const provider = AI_PROVIDERS[settings.aiProvider] ?? AI_PROVIDERS.groq
  const selectedAiMode = SLIDE_AI_MODES.find((item) => item.id === aiMode) ?? SLIDE_AI_MODES[0]

  const selectedSlides = deck ? deck.slides.filter((slide) => !excluded.has(slide.number)) : []
  const selectedCount = selectedSlides.length
  const allSelected = Boolean(deck) && excluded.size === 0

  useEffect(() => {
    if (dialog !== 'slides') {
      aiAbortRef.current?.abort()
      aiAbortRef.current = null
      setFile(null)
      setDeck(null)
      setRawDeck(null)
      setLoading(false)
      setCreating(false)
      setError('')
      setDragging(false)
      setAiExtra('')
      setAiLoading(false)
      setAiProgress(null)
      setAiApplied(false)
      setAiError('')
      setExpandedSlide(null)
      setExcluded(new Set())
    }
  }, [dialog])

  const handleFile = async (next: File) => {
    const lowerName = next.name.toLowerCase()
    const isPptx = lowerName.endsWith('.pptx')
    const isPdf = lowerName.endsWith('.pdf')

    if (!isPptx && !isPdf) {
      setError(
        lowerName.endsWith('.ppt')
          ? 'Eski .ppt biçimi desteklenmiyor. Sunumu .pptx olarak kaydedip tekrar dene.'
          : 'Lütfen bir .pptx veya .pdf dosyası seç.',
      )
      return
    }

    setFile(next)
    setDeck(null)
    setRawDeck(null)
    setError('')
    setAiError('')
    setAiApplied(false)
    setExpandedSlide(null)
    setExcluded(new Set())
    setLoading(true)

    try {
      const parsed = isPdf ? await readPdfFile(next) : await readPptxFile(next)
      if (!parsed.slides.length) {
        throw new Error('Bu dosyadan metin çıkaramadım.')
      }
      setDeck(parsed)
      setRawDeck(parsed)
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

  const runAi = async () => {
    if (!deck) return

    setAiError('')

    if (!selectedSlides.length) {
      setAiError('AI’ya gönderilecek slayt seçili değil. En az bir slayt işaretle.')
      return
    }

    if (!settings.aiBaseUrl.trim()) {
      setAiError('AI sunucu adresi tanımlı değil. Ayarlar > Yapay zekâ bölümünü kontrol et.')
      return
    }

    if (!settings.aiModel.trim()) {
      setAiError('AI model adı boş. Ayarlar > Yapay zekâ bölümünü kontrol et.')
      return
    }

    const apiKey = getAiKey()
    if (provider.requiresKey && !apiKey.trim()) {
      setAiError(
        'Bu AI sağlayıcısı için anahtar gerekli. Ayarlar > Yapay zekâ bölümünden anahtar gir ' +
          'veya paylaşımlı Groq sağlayıcısını seç.',
      )
      return
    }

    setAiLoading(true)
    setAiProgress(null)
    const controller = new AbortController()
    aiAbortRef.current = controller

    try {
      const chunks = chunkDeckForAi({ ...deck, slides: selectedSlides })
      const total = chunks.length
      if (total > 1) setAiProgress({ done: 0, total })

      const improvedSlides: Slide[] = []
      const failedNumbers: number[] = []
      let keptRaw = 0
      let deckTitle = deck.title

      for (let index = 0; index < chunks.length; index += 1) {
        if (controller.signal.aborted) return
        if (total > 1) setAiProgress({ done: index, total })
        const chunk = chunks[index]

        try {
          const { system, user } = buildSlideAiPrompt(chunk, aiMode, aiExtra)
          const maxTokens = Math.min(8000, Math.max(2000, 1000 + chunk.slides.length * 240))
          const text = await chatComplete(
            aiConfigFromSettings(settings, apiKey),
            [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            {
              temperature: aiMode === 'clean' ? 0.2 : 0.35,
              maxTokens,
              json: true,
              timeoutMs: 90_000,
              signal: controller.signal,
            },
          )

          const improved = parseSlideAiResponse(text, chunk.title)
          if (index === 0 && improved.title) deckTitle = improved.title
          const merged = mergeAiChunk(chunk, improved)
          keptRaw += merged.keptRaw
          improvedSlides.push(...merged.slides)
        } catch (caught) {
          if (controller.signal.aborted) throw caught
          failedNumbers.push(...chunk.slides.map((slide) => slide.number))
          improvedSlides.push(...chunk.slides)
        }
      }

      setDeck({
        ...deck,
        title: deckTitle,
        // Parçalar ayrı ayrı işlendiği için numaralar tekrar başlayabilir;
        // birleşik destede sırayı koruyacak şekilde yeniden numaralandır.
        slides: improvedSlides.map((slide, index) => ({ ...slide, number: index + 1 })),
        warnings: deck.warnings,
      })
      setAiApplied(true)
      setExpandedSlide(null)
      setExcluded(new Set())

      if (failedNumbers.length) {
        pushToast(
          `${failedNumbers.length} slayt AI ile düzenlenemedi; ham metin korundu.`,
          'default',
        )
      } else if (keptRaw) {
        pushToast(
          `${keptRaw} slayt AI yanıtında yoktu; ham metni korundu.`,
          'default',
        )
      } else if (total > 1) {
        pushToast(`AI ${total} parçada slayt metnini düzenledi.`, 'success')
      } else {
        pushToast('AI slayt metnini düzenledi.', 'success')
      }
    } catch (caught) {
      if (controller.signal.aborted) return
      setAiError(caught instanceof Error ? caught.message : 'AI düzenlemesi başarısız oldu.')
    } finally {
      if (aiAbortRef.current === controller) aiAbortRef.current = null
      setAiLoading(false)
      setAiProgress(null)
    }
  }

  const resetAi = () => {
    if (!rawDeck) return
    setDeck(rawDeck)
    setAiApplied(false)
    setAiError('')
    setExpandedSlide(null)
  }

  const toggleSlide = (number: number) => {
    setExcluded((current) => {
      const next = new Set(current)
      if (next.has(number)) next.delete(number)
      else next.add(number)
      return next
    })
  }

  const toggleAllSlides = () => {
    if (!deck) return
    setExcluded(allSelected ? new Set(deck.slides.map((slide) => slide.number)) : new Set())
  }

  const handleCreate = async () => {
    if (!deck) return
    if (!selectedSlides.length) {
      setError('Nota eklenecek slayt seçili değil. En az bir slayt işaretle.')
      return
    }
    setCreating(true)
    setError('')

    try {
      const blocks = slidesToBlocks({ ...deck, slides: selectedSlides }, mode, includeNotes)
      createNote({ title: deck.title, emoji: '📊', blocks })
      pushToast(
        `${selectedSlides.length} slayt ${aiApplied ? 'AI düzenlemesiyle ' : ''}not olarak açıldı.`,
        'success',
      )
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

        <p className="text-[0.65rem] font-semibold leading-relaxed text-[var(--text-faint)]">
          Metin çıkmayan görsel slaytlar ve taranmış PDF sayfaları resim olarak eklenir; bu
          sürümde OCR yok. Metin varsa AI ile düzenleyebilirsin.
        </p>

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
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-[var(--text-faint)]">
                  {deck.slides.length} slayt bulundu · {selectedCount} seçili.
                  {aiApplied ? ' AI düzenlemesi uygulandı.' : ''}
                </p>
                <button
                  type="button"
                  onClick={toggleAllSlides}
                  className="ml-auto text-[0.65rem] font-extrabold text-[var(--accent-strong)] transition hover:underline"
                >
                  {allSelected ? 'Tümünü kaldır' : 'Tümünü seç'}
                </button>
              </div>
            </div>

            {deck.warnings?.length ? (
              <div className="flex gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  {deck.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg)]">
              {deck.slides.map((slide) => {
                const expanded = expandedSlide === slide.number
                return (
                  <div
                    key={`${slide.number}-${slide.title}`}
                    className="border-b border-[var(--border)] last:border-b-0"
                  >
                    <div className="flex items-center gap-2 px-3 py-2 transition hover:bg-[var(--surface)]">
                      <input
                        type="checkbox"
                        checked={!excluded.has(slide.number)}
                        onChange={() => toggleSlide(slide.number)}
                        aria-label={`${slide.title} slaytını nota dahil et`}
                        className="size-4 shrink-0 accent-[var(--accent)]"
                      />
                      <button
                        type="button"
                        onClick={() => setExpandedSlide(expanded ? null : slide.number)}
                        aria-expanded={expanded}
                        className={`flex min-w-0 flex-1 items-center gap-2 text-left ${
                          excluded.has(slide.number) ? 'opacity-50' : ''
                        }`}
                      >
                        <span className="grid size-5 shrink-0 place-items-center rounded-md bg-[var(--surface-2)] text-[0.62rem] font-extrabold text-[var(--text-faint)]">
                          {slide.number}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs font-extrabold text-[var(--text)]">
                          {slide.title}
                        </span>
                        <span className="shrink-0 text-[0.62rem] font-semibold text-[var(--text-faint)]">
                          {slide.items.length} öğe
                          {slide.tables?.length ? ` · ${slide.tables.length} tablo` : ''}
                          {slide.images?.length ? ' · görsel' : ''}
                          {slide.notes.length ? ' · not' : ''}
                        </span>
                        {expanded ? (
                          <ChevronDown className="size-3.5 shrink-0 text-[var(--text-faint)]" />
                        ) : (
                          <ChevronRight className="size-3.5 shrink-0 text-[var(--text-faint)]" />
                        )}
                      </button>
                    </div>

                    {expanded && (
                      <div className="space-y-1 px-3 pb-2.5 pl-10 text-[0.7rem] font-semibold leading-relaxed text-[var(--text-soft)]">
                        {slide.items.slice(0, 8).map((item, index) => (
                          <p
                            key={`${slide.number}-item-${index}`}
                            style={{ paddingLeft: `${Math.min(3, item.level) * 0.75}rem` }}
                          >
                            {item.bullet ? '• ' : ''}
                            {item.text}
                          </p>
                        ))}
                        {slide.items.length > 8 && (
                          <p className="text-[var(--text-faint)]">
                            … {slide.items.length - 8} öğe daha
                          </p>
                        )}
                        {slide.tables?.map((table, tableIndex) => (
                          <p key={`${slide.number}-table-${tableIndex}`} className="text-[var(--text-faint)]">
                            Tablo: {table.length}×{table[0]?.length ?? 0}
                            {table[0]?.length ? ` — ${table[0].join(' | ')}` : ''}
                          </p>
                        ))}
                        {slide.images?.map((src, imageIndex) => (
                          <img
                            key={`${slide.number}-image-${imageIndex}`}
                            src={src}
                            alt={`Slayt ${slide.number} görseli`}
                            className="mt-1.5 max-h-40 w-auto max-w-full rounded-lg border border-[var(--border)] object-contain"
                          />
                        ))}
                        {slide.notes.map((note, noteIndex) => (
                          <p key={`${slide.number}-note-${noteIndex}`} className="italic text-[var(--text-faint)]">
                            Not: {note}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <div className="flex items-start gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--accent-strong)]">
                  <Sparkles className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold">AI ile iyileştir</p>
                  <p className="mt-0.5 text-[0.7rem] font-semibold leading-relaxed text-[var(--text-faint)]">
                    Dosya sunucuya gönderilmez; yalnızca çıkarılan slayt metni AI’ya gönderilir.
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[0.62rem] font-extrabold uppercase tracking-[0.1em] text-[var(--text-faint)]">
                    AI modu
                  </span>
                  <select
                    value={aiMode}
                    onChange={(event) => setAiMode(event.target.value as SlideAiMode)}
                    disabled={aiLoading}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs font-bold text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-60"
                  >
                    {SLIDE_AI_MODES.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[0.62rem] font-extrabold uppercase tracking-[0.1em] text-[var(--text-faint)]">
                    Ek istek (isteğe bağlı)
                  </span>
                  <input
                    value={aiExtra}
                    onChange={(event) => setAiExtra(event.target.value)}
                    disabled={aiLoading}
                    placeholder="Örn. sınav odaklı özetle"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs font-bold text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] disabled:opacity-60"
                  />
                </label>
              </div>

              <p className="mt-1.5 text-[0.65rem] font-semibold leading-relaxed text-[var(--text-faint)]">
                {selectedAiMode.description}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void runAi()}
                  disabled={aiLoading || loading || selectedCount === 0}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] px-3 py-2 text-xs font-extrabold text-[var(--accent-strong)] transition hover:bg-[color-mix(in_oklab,var(--accent)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {aiLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {aiLoading
                    ? aiProgress && aiProgress.total > 1
                      ? `AI düzenliyor… (${Math.min(aiProgress.done + 1, aiProgress.total)}/${aiProgress.total})`
                      : 'AI düzenliyor…'
                    : aiApplied
                      ? 'AI ile yeniden düzenle'
                      : 'AI ile düzenle'}
                </button>

                {aiLoading && (
                  <button
                    type="button"
                    onClick={() => aiAbortRef.current?.abort()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-extrabold text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                  >
                    İptal
                  </button>
                )}

                {aiApplied && (
                  <button
                    type="button"
                    onClick={resetAi}
                    disabled={aiLoading}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-extrabold text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:opacity-60"
                  >
                    <RotateCcw className="size-3.5" />
                    Ham metne dön
                  </button>
                )}

                <span className="ml-auto max-w-full truncate text-[0.62rem] font-semibold text-[var(--text-faint)]">
                  {provider.label} · {settings.aiModel || 'model seçilmedi'}
                </span>
              </div>

              {provider.requiresKey && (
                <p className="mt-2 text-[0.65rem] font-semibold leading-relaxed text-[var(--text-faint)]">
                  Bu sağlayıcı için AI anahtarı gerekli. Ayarlar &gt; Yapay zekâ bölümünden
                  anahtar girebilir veya paylaşımlı Groq sağlayıcısını seçebilirsin.
                </p>
              )}

              {aiError && (
                <div className="mt-2 rounded-xl border border-red-300/60 bg-red-50 px-3 py-2 text-[0.7rem] font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                  {aiError}
                </div>
              )}
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
          <button
            type="button"
            onClick={closeDialog}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-extrabold text-[var(--text-soft)] transition hover:bg-[var(--surface-2)]"
          >
            Kapat
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!deck || loading || creating || aiLoading || selectedCount === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-3.5 py-2 text-xs font-extrabold text-[var(--accent-ink)] transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Presentation className="size-4" />
            )}
            {aiApplied ? 'AI sonucundan oluştur' : 'Notu oluştur'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

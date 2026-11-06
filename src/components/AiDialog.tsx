import { useEffect, useState, type ComponentType } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ClipboardCopy,
  ExternalLink,
  Eye,
  EyeOff,
  GitBranch,
  ImagePlus,
  KeyRound,
  Lightbulb,
  ListChecks,
  Loader2,
  MessageSquare,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react'
import type { AiProvider } from '../types'
import { useStore } from '../store/useStore'
import {
  AI_PROVIDERS,
  aiConfigFromSettings,
  bestEffortDataUrl,
  buildPrompt,
  chatComplete,
  defaultSystemPrompt,
  extractMermaid,
  mermaidInkUrl,
  pollinationsUrl,
  urlToDataUrl,
  type AiActionId,
} from '../lib/ai'
import { getAiKey, hasRememberedAiKey, saveAiKey } from '../lib/aiKey'
import { markdownToBlocks } from '../lib/markdown'
import { Modal } from './Modal'

interface ActionPreset {
  id: AiActionId
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
}

const ACTIONS: ActionPreset[] = [
  {
    id: 'improve',
    label: 'Düzelt',
    description: 'Yazımı ve anlatımı iyileştir',
    icon: Wand2,
  },
  {
    id: 'summarize',
    label: 'Özetle',
    description: 'Kısa ve net bir özet çıkar',
    icon: ListChecks,
  },
  {
    id: 'format',
    label: 'Şekillendir',
    description: 'Başlık, liste ve düzen ekle',
    icon: Sparkles,
  },
  {
    id: 'ideas',
    label: 'Fikir ver',
    description: '5 yaratıcı öneri üret',
    icon: Lightbulb,
  },
  {
    id: 'diagram',
    label: 'Şema çiz',
    description: 'Mermaid diyagramı oluştur',
    icon: GitBranch,
  },
  {
    id: 'image',
    label: 'Görsel',
    description: 'Anahtarsız AI görseli üret',
    icon: ImagePlus,
  },
  {
    id: 'custom',
    label: 'Serbest',
    description: 'Kendi isteğini yaz',
    icon: MessageSquare,
  },
]

const inputClass =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm font-semibold text-[var(--text)] outline-none transition placeholder:text-[var(--text-faint)] focus:border-[var(--accent)]'

const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-3.5 py-2.5 text-sm font-extrabold text-[var(--accent-ink)] shadow-[0_10px_24px_-16px_var(--accent)] transition hover:bg-[var(--accent-strong)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'

const secondaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-extrabold text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50'

export function AiDialog() {
  const dialog = useStore((state) => state.dialog)
  const closeDialog = useStore((state) => state.closeDialog)
  const note = useStore((state) =>
    state.activeNoteId ? state.notes.find((item) => item.id === state.activeNoteId) ?? null : null,
  )
  const settings = useStore((state) => state.settings)
  const updateSettings = useStore((state) => state.updateSettings)
  const insertBlocks = useStore((state) => state.insertBlocks)
  const replaceBlocks = useStore((state) => state.replaceBlocks)
  const addBlock = useStore((state) => state.addBlock)
  const pushToast = useStore((state) => state.pushToast)

  const [action, setAction] = useState<AiActionId>('improve')
  const [apiKey, setApiKey] = useState(getAiKey)
  const [remember, setRemember] = useState(hasRememberedAiKey)
  const [showKey, setShowKey] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [includeNote, setIncludeNote] = useState(true)
  const [loading, setLoading] = useState(false)
  const [inserting, setInserting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [diagramCode, setDiagramCode] = useState('')
  const [diagramUrl, setDiagramUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageDataUrl, setImageDataUrl] = useState('')
  const [imageLoading, setImageLoading] = useState(false)

  const selected = ACTIONS.find((item) => item.id === action) ?? ACTIONS[0]
  const provider = AI_PROVIDERS[settings.aiProvider] ?? AI_PROVIDERS.groq
  const isImage = action === 'image'
  const isDiagram = action === 'diagram'

  useEffect(() => {
    if (dialog !== 'ai') return
    const storedKey = getAiKey()
    setApiKey(storedKey)
    setRemember(hasRememberedAiKey())
    setShowConfig((Boolean(provider.requiresKey) && !storedKey) || !settings.aiBaseUrl.trim())
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog])

  useEffect(() => {
    if (dialog === 'ai') return
    setResult('')
    setDiagramCode('')
    setDiagramUrl('')
    setImageUrl('')
    setImageDataUrl('')
    setImageLoading(false)
    setError('')
    setLoading(false)
    setInserting(false)
  }, [dialog])

  useEffect(() => {
    if (dialog !== 'ai') return
    setResult('')
    setDiagramCode('')
    setDiagramUrl('')
    setImageUrl('')
    setImageDataUrl('')
    setImageLoading(false)
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id])

  const chooseProvider = (id: AiProvider) => {
    const preset = AI_PROVIDERS[id]
    updateSettings({
      aiProvider: id,
      aiBaseUrl: preset.baseUrl,
      aiModel: preset.model,
    })
  }

  const updateKey = (value: string) => {
    setApiKey(value)
    saveAiKey(value, remember)
  }

  const toggleRemember = (value: boolean) => {
    setRemember(value)
    saveAiKey(apiKey, value)
  }

  const run = async () => {
    if (!note) {
      setError('Önce bir not aç.')
      return
    }

    setError('')
    setResult('')
    setDiagramCode('')
    setDiagramUrl('')
    setImageUrl('')
    setImageDataUrl('')
    setImageLoading(false)

    if (isImage) {
      const description =
        prompt.trim() || `${note.title || 'Not'} hakkında yaratıcı bir illüstrasyon`
      setImageLoading(true)
      try {
        const dataUrl = await urlToDataUrl(pollinationsUrl(description))
        setImageDataUrl(dataUrl)
        setImageUrl(dataUrl)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Görsel üretilemedi. Tekrar dene.')
      } finally {
        setImageLoading(false)
      }
      return
    }

    if (!settings.aiBaseUrl.trim()) {
      setShowConfig(true)
      setError(
        provider.shared
          ? 'Paylaşımlı proxy adresi tanımlı değil. Yönetici VITE_GROQ_PROXY_URL değişkenini ayarlamalı.'
          : 'Sunucu adresi boş. Bağlantı ayarlarından bir adres gir.',
      )
      return
    }

    if (provider.requiresKey && !apiKey.trim()) {
      setShowConfig(true)
      setError('AI kullanmak için bir API anahtarı gir. Anahtar yalnızca bu tarayıcıda saklanır.')
      return
    }

    if (!settings.aiModel.trim()) {
      setShowConfig(true)
      setError('Model adı boş. Bağlantı ayarlarından bir model gir.')
      return
    }

    if (action === 'custom' && !prompt.trim()) {
      setError('AI’ya ne yapmasını istediğini yaz.')
      return
    }

    if (!includeNote && !prompt.trim()) {
      setError('Notu göndermeyi kapattıysan bir istek yazmalısın.')
      return
    }

    saveAiKey(apiKey, remember)
    setLoading(true)

    try {
      const text = await chatComplete(
        aiConfigFromSettings(settings, apiKey),
        [
          { role: 'system', content: defaultSystemPrompt(action) },
          { role: 'user', content: buildPrompt(action, note, prompt, includeNote) },
        ],
        {
          temperature: action === 'ideas' ? 0.8 : 0.35,
          maxTokens: isDiagram ? 1600 : 1800,
        },
      )

      if (isDiagram) {
        const code = extractMermaid(text)
        if (!code) {
          throw new Error('AI geçerli bir Mermaid kodu döndürmedi. “Şema çiz” ile tekrar dene.')
        }
        setDiagramCode(code)
        setDiagramUrl(mermaidInkUrl(code))
        setResult(text)
      } else {
        setResult(text)
      }
      pushToast('AI yanıtı hazır.', 'success')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Beklenmeyen bir hata oldu.')
    } finally {
      setLoading(false)
    }
  }

  const copyResult = async () => {
    const text = isDiagram ? diagramCode : result
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      pushToast('Panoya kopyalandı.', 'success')
    } catch {
      pushToast('Panoya kopyalanamadı.', 'danger')
    }
  }

  const insertText = () => {
    if (!note || !result.trim()) return
    insertBlocks(note.id, markdownToBlocks(result))
    pushToast('AI sonucu nota eklendi.', 'success')
    closeDialog()
  }

  const replaceText = () => {
    if (!note || !result.trim()) return
    const confirmed = window.confirm(
      'Notun mevcut içeriği AI sonucuyla değiştirilecek. Devam edilsin mi?',
    )
    if (!confirmed) return
    replaceBlocks(note.id, markdownToBlocks(result))
    pushToast('Not AI sonucuyla güncellendi.', 'success')
    closeDialog()
  }

  const insertVisual = async (src: string, caption: string, convert = true) => {
    if (!note) return
    setInserting(true)
    try {
      const finalSrc = convert ? await bestEffortDataUrl(src) : src
      addBlock(note.id, { type: 'image', src: finalSrc, caption })
      pushToast('Görsel nota eklendi.', 'success')
      closeDialog()
    } catch {
      setError('Görsel nota eklenemedi. Tekrar dene.')
    } finally {
      setInserting(false)
    }
  }

  const canRun = Boolean(note) && !loading && !imageLoading && !inserting
  const runLabel = loading
    ? 'Çalışıyor…'
    : imageLoading
      ? 'Görsel hazırlanıyor…'
      : isImage
        ? 'Görsel oluştur'
        : 'AI ile çalıştır'

  return (
    <Modal
      open={dialog === 'ai'}
      onClose={closeDialog}
      title="AI Asistan"
      subtitle="Notlarını düzelt, şekillendir, görselleştir."
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3 text-[0.68rem] font-semibold text-[var(--text-faint)]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" />
            {provider.shared
              ? 'Anahtar sunucuda saklanır, tarayıcıya inmez.'
              : 'Anahtarın yalnızca bu tarayıcıda kalır.'}
          </span>
          <span className="hidden sm:inline">AI çıktılarını kontrol etmeyi unutma.</span>
        </div>
      }
    >
      <div className="space-y-4">
        <section className="rounded-2xl border border-[var(--border)] bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent)_13%,transparent),transparent_62%)] p-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] shadow-[0_10px_22px_-14px_var(--accent)]">
              <Sparkles className="size-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold">
                {provider.shared ? 'Paylaşımlı anahtar hazır' : `${provider.label} ile bağlan`}
              </p>
              <p className="truncate text-xs font-semibold text-[var(--text-soft)]">
                {settings.aiModel || 'Model seçilmedi'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowConfig((value) => !value)}
              className={`ml-auto shrink-0 ${secondaryButtonClass}`}
              aria-expanded={showConfig}
            >
              <Settings2 className="size-3.5" />
              Bağlantı
            </button>
          </div>

          {showConfig && (
            <div className="mt-3.5 space-y-3 border-t border-[var(--border)] pt-3.5">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-[var(--text-faint)]">
                    Sağlayıcı
                  </span>
                  <select
                    value={settings.aiProvider}
                    onChange={(event) => chooseProvider(event.target.value as AiProvider)}
                    className={inputClass}
                  >
                    {Object.values(AI_PROVIDERS).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-[var(--text-faint)]">
                    Model
                  </span>
                  <input
                    value={settings.aiModel}
                    onChange={(event) => updateSettings({ aiModel: event.target.value })}
                    placeholder={provider.model || 'model-adı'}
                    spellCheck={false}
                    readOnly={provider.shared}
                    className={`${inputClass} ${provider.shared ? 'opacity-70' : ''}`}
                  />
                </label>
              </div>

              {provider.shared ? (
                settings.aiBaseUrl.trim() ? (
                  <div className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 py-2.5 text-[0.7rem] font-semibold leading-relaxed text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                    <p className="flex items-start gap-1.5">
                      <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        Paylaşımlı Groq anahtarı kullanılıyor. Anahtar Cloudflare proxy’sinde
                        saklanır; tarayıcıya hiç inmez. Ayrıca anahtar girmene gerek yok.
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-[0.7rem] font-semibold leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    <p className="flex items-start gap-1.5">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        Paylaşımlı proxy adresi tanımlı değil. Yönetici{' '}
                        <code className="font-mono">VITE_GROQ_PROXY_URL</code> değişkenini
                        ayarlamalı veya kendi Groq anahtarını kullanmalı.
                      </span>
                    </p>
                  </div>
                )
              ) : (
                <>
                  <label className="block">
                    <span className="mb-1 block text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-[var(--text-faint)]">
                      Sunucu adresi
                    </span>
                    <input
                      value={settings.aiBaseUrl}
                      onChange={(event) => updateSettings({ aiBaseUrl: event.target.value })}
                      placeholder={provider.baseUrl || 'https://...'}
                      spellCheck={false}
                      className={inputClass}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-[var(--text-faint)]">
                      API anahtarı
                    </span>
                    <span className="relative block">
                      <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-faint)]" />
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(event) => updateKey(event.target.value)}
                        placeholder={provider.id === 'groq' ? 'gsk_…' : 'sk-…'}
                        autoComplete="off"
                        spellCheck={false}
                        className={`${inputClass} pl-9 pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((value) => !value)}
                        className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-[var(--text-faint)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                        aria-label={showKey ? 'Anahtarı gizle' : 'Anahtarı göster'}
                      >
                        {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[var(--text-soft)]">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(event) => toggleRemember(event.target.checked)}
                        className="size-4 accent-[var(--accent)]"
                      />
                      Bu cihazda hatırla
                    </label>
                    {provider.keyUrl && (
                      <a
                        href={provider.keyUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-xs font-extrabold text-[var(--accent-strong)] underline decoration-dotted underline-offset-4"
                      >
                        {provider.id === 'groq' ? 'Groq anahtarı' : 'Anahtar al'}
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>

                  <p className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-[0.7rem] font-semibold leading-relaxed text-[var(--text-soft)]">
                    İstek doğrudan {provider.label} sunucusuna gider. Groq tarayıcıdan doğrudan
                    çalışır. Anahtar yalnızca bu tarayıcıda saklanır.
                  </p>
                </>
              )}
            </div>
          )}
        </section>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {ACTIONS.map((item) => {
            const Icon = item.icon
            const active = action === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setAction(item.id)
                  setError('')
                  setResult('')
                  setDiagramCode('')
                  setDiagramUrl('')
                  setImageUrl('')
                  setImageDataUrl('')
                  setImageLoading(false)
                }}
                aria-pressed={active}
                className={`group flex min-h-[64px] flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition ${
                  active
                    ? 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-[var(--text)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
                }`}
              >
                <Icon className={`size-4 ${active ? 'text-[var(--accent-strong)]' : ''}`} />
                <span className="text-xs font-extrabold">{item.label}</span>
                <span className="line-clamp-1 text-[0.62rem] font-semibold text-[var(--text-faint)]">
                  {item.description}
                </span>
              </button>
            )
          })}
        </div>

        {note ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-soft)]">
              <span>{note.emoji}</span>
              <span className="min-w-0 flex-1 truncate text-[var(--text)]">
                {note.title || 'Başlıksız not'}
              </span>
              <span className="shrink-0 text-[0.68rem] font-semibold text-[var(--text-faint)]">
                {note.blocks.length} blok
              </span>
            </div>
            {!isImage && (
              <label className="mt-2.5 inline-flex cursor-pointer items-center gap-2 text-[0.7rem] font-semibold text-[var(--text-soft)]">
                <input
                  type="checkbox"
                  checked={includeNote}
                  onChange={(event) => setIncludeNote(event.target.checked)}
                  className="size-4 accent-[var(--accent)]"
                />
                Notu bağlam olarak gönder
              </label>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            AI kullanmak için önce bir not aç.
          </div>
        )}

        <div>
          <label
            htmlFor="ai-prompt"
            className="mb-1.5 block text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-[var(--text-faint)]"
          >
            {action === 'custom'
              ? 'AI’ya ne yapmasını istersin?'
              : isImage
                ? 'Görsel tarifi'
                : 'Ek istek (isteğe bağlı)'}
          </label>
          <textarea
            id="ai-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
            placeholder={
              isImage
                ? 'Örn. pastel renklerde, ay ışığında uyuyan bir tilki illüstrasyonu'
                : action === 'custom'
                  ? 'Örn. Bu notu 3 maddelik bir eylem planına çevir.'
                  : `${selected.label}: ${selected.description}. İstersen ek bir yön verebilirsin.`
            }
            className={`${inputClass} min-h-[84px] resize-y leading-relaxed`}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-300/60 bg-red-50 px-3 py-2.5 text-xs font-semibold leading-relaxed text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void run()} disabled={!canRun} className={primaryButtonClass}>
            {loading || imageLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isImage ? (
              <ImagePlus className="size-4" />
            ) : (
              <Wand2 className="size-4" />
            )}
            {runLabel}
          </button>

          {(result || imageUrl) && !loading && (
            <button type="button" onClick={() => void run()} className={secondaryButtonClass}>
              <RefreshCw className="size-3.5" />
              Yeniden dene
            </button>
          )}

          <span className="ml-auto hidden items-center gap-1 text-[0.68rem] font-semibold text-[var(--text-faint)] sm:inline-flex">
            <Sparkles className="size-3.5" />
            {selected.label}
          </span>
        </div>

        {loading && (
          <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-[var(--surface-2)]" />
            <div className="h-3 w-11/12 animate-pulse rounded-full bg-[var(--surface-2)]" />
            <div className="h-3 w-4/5 animate-pulse rounded-full bg-[var(--surface-2)]" />
            <p className="pt-1 text-[0.68rem] font-bold text-[var(--text-faint)]">
              AI notunu okuyor…
            </p>
          </div>
        )}

        {!loading && result && action !== 'image' && !isDiagram && (
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3.5 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold">
                <Sparkles className="size-3.5 text-[var(--accent-strong)]" />
                AI yanıtı
              </span>
              <button type="button" onClick={() => void copyResult()} className={secondaryButtonClass}>
                <ClipboardCopy className="size-3.5" />
                Kopyala
              </button>
            </header>
            <div className="max-h-72 overflow-y-auto whitespace-pre-wrap px-4 py-3.5 text-sm font-medium leading-relaxed text-[var(--text)]">
              {result}
            </div>
            <footer className="flex flex-wrap gap-2 border-t border-[var(--border)] bg-[var(--surface-2)]/50 px-3.5 py-2.5">
              <button type="button" onClick={insertText} className={primaryButtonClass}>
                <ArrowRight className="size-4" />
                Nota ekle
              </button>
              <button type="button" onClick={replaceText} className={secondaryButtonClass}>
                <RefreshCw className="size-3.5" />
                Notu değiştir
              </button>
            </footer>
          </section>
        )}

        {!loading && isDiagram && diagramUrl && (
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3.5 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold">
                <GitBranch className="size-3.5 text-[var(--accent-strong)]" />
                Mermaid şeması
              </span>
              <button type="button" onClick={() => void copyResult()} className={secondaryButtonClass}>
                <ClipboardCopy className="size-3.5" />
                Kodu kopyala
              </button>
            </header>
            <div className="grid place-items-center bg-white px-3 py-4">
              <img
                src={diagramUrl}
                alt="AI tarafından oluşturulan Mermaid şeması"
                className="max-h-80 w-auto max-w-full rounded-lg"
              />
            </div>
            <details className="border-t border-[var(--border)] px-3.5 py-2">
              <summary className="cursor-pointer text-[0.7rem] font-extrabold text-[var(--text-soft)]">
                Mermaid kodunu göster
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-[var(--surface-2)] p-3 text-[0.68rem] font-mono text-[var(--text)]">
                {diagramCode}
              </pre>
            </details>
            <footer className="flex flex-wrap gap-2 border-t border-[var(--border)] bg-[var(--surface-2)]/50 px-3.5 py-2.5">
              <button
                type="button"
                onClick={() => void insertVisual(diagramUrl, 'AI şeması')}
                disabled={inserting}
                className={primaryButtonClass}
              >
                {inserting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Şema olarak ekle
              </button>
            </footer>
          </section>
        )}

        {!loading && isImage && imageUrl && (
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3.5 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold">
                <ImagePlus className="size-3.5 text-[var(--accent-strong)]" />
                AI görseli
              </span>
              <span className="text-[0.68rem] font-semibold text-[var(--text-faint)]">
                Pollinations · anahtarsız
              </span>
            </header>
            <div className="relative grid min-h-48 place-items-center bg-[var(--surface-2)]">
              {imageLoading && (
                <div className="absolute inset-0 z-10 grid place-items-center bg-[var(--surface-2)]/85">
                  <div className="flex flex-col items-center gap-2 text-xs font-bold text-[var(--text-soft)]">
                    <Loader2 className="size-6 animate-spin text-[var(--accent-strong)]" />
                    Görsel hazırlanıyor…
                  </div>
                </div>
              )}
              <img
                src={imageUrl}
                alt="AI tarafından oluşturulan görsel"
                className="max-h-80 w-auto max-w-full"
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageLoading(false)
                  setError('Görsel üretilemedi. Tarifi değiştirip tekrar dene.')
                }}
              />
            </div>
            <footer className="flex flex-wrap gap-2 border-t border-[var(--border)] bg-[var(--surface-2)]/50 px-3.5 py-2.5">
              <button
                type="button"
                onClick={() =>
                  void insertVisual(
                    imageDataUrl || imageUrl,
                    prompt.trim().slice(0, 120) || 'AI görseli',
                    false,
                  )
                }
                disabled={inserting || imageLoading}
                className={primaryButtonClass}
              >
                {inserting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Görseli nota ekle
              </button>
            </footer>
          </section>
        )}

        {!result && !imageUrl && !loading && (
          <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)]/50 px-4 py-5 text-center">
            <Sparkles className="mx-auto size-5 text-[var(--accent-strong)]" />
            <p className="mt-1.5 text-xs font-bold text-[var(--text-soft)]">
              Bir işlem seç, AI notunla çalışsın.
            </p>
            <p className="mt-0.5 text-[0.68rem] font-semibold text-[var(--text-faint)]">
              Düzelt · özetle · şekillendir · şema çiz · görsel üret
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}

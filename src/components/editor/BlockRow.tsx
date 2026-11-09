import { useEffect, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Check,
  Copy,
  GripVertical,
  ImagePlus,
  Link2,
  ListPlus,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import type { Block, BlockType } from '../../types'
import { useStore } from '../../store/useStore'
import { decodeHtmlText, focusEditable } from '../../lib/dom'
import { escapeHtml, htmlToText, sanitizeHtml } from '../../lib/sanitize'
import { imageFileToDataUrl } from '../../lib/media'
import { markdownToBlocks } from '../../lib/markdown'
import { playSound } from '../../lib/sound'
import {
  AI_PROVIDERS,
  aiConfigFromSettings,
  blockAiTextToHtml,
  buildBlockGeneratePrompt,
  buildBlockPrompt,
  chatComplete,
  cleanGeneratedMarkdown,
  defaultSystemPrompt,
} from '../../lib/ai'
import { getAiKey } from '../../lib/aiKey'
import { Editable } from './Editable'
import { BlockTypeMenu } from './BlockTypeMenu'
import { TableBlock } from './TableBlock'
import { EmojiPicker } from '../EmojiPicker'

interface BlockRowProps {
  noteId: string
  block: Block
  number?: number
  onSplit: (before: string, after: string) => void
  onMerge: () => void
  onDelete: () => void
  onArrow: (direction: 'up' | 'down') => void
  onInsert: (type: BlockType) => void
  onConvert: (type: BlockType) => void
  onPasteText: (text: string) => void
}

const TEXT_CLASSES: Partial<Record<BlockType, string>> = {
  paragraph: 'text-[15.5px] leading-[1.8]',
  heading1: 'font-display text-[2rem] font-bold leading-[1.2] tracking-tight',
  heading2: 'font-display text-[1.55rem] font-bold leading-[1.25]',
  heading3: 'text-[1.12rem] font-extrabold leading-[1.35]',
  bulleted: 'text-[15.5px] leading-[1.75]',
  numbered: 'text-[15.5px] leading-[1.75]',
  todo: 'text-[15.5px] leading-[1.7]',
  quote: 'text-[15.5px] italic leading-[1.75] text-[var(--text-soft)]',
  callout: 'text-[15px] leading-[1.7]',
}

const PLACEHOLDERS: Partial<Record<BlockType, string>> = {
  paragraph: "Yaz ya da '/' ile blok seç…",
  heading1: 'Büyük başlık',
  heading2: 'Orta başlık',
  heading3: 'Küçük başlık',
  bulleted: 'Liste öğesi',
  numbered: 'Liste öğesi',
  todo: 'Yapılacak bir şey…',
  quote: 'Bir alıntı',
  callout: 'Notunu yaz…',
}

const LANGUAGES = ['text', 'javascript', 'typescript', 'python', 'html', 'css', 'json', 'bash', 'sql', 'markdown']

const AI_QUICK_PROMPTS = [
  {
    label: 'Başlık + alt başlıklar',
    prompt:
      'Bu konu hakkında bir ana başlık ve alt başlıklar oluştur; her alt başlığın altına kısa bir açıklama yaz.',
  },
  { label: 'Özetle', prompt: 'Bu içeriği kısa ve net biçimde özetle.' },
  { label: 'Maddelere böl', prompt: 'Bu içeriği anlaşılır maddelere böl.' },
  { label: 'Fikir üret', prompt: 'Bu konu hakkında 5 kısa ve uygulanabilir fikir üret.' },
]

export function BlockRow({
  noteId,
  block,
  number,
  onSplit,
  onMerge,
  onDelete,
  onArrow,
  onInsert,
  onConvert,
  onPasteText,
}: BlockRowProps) {
  const updateBlock = useStore((state) => state.updateBlock)
  const insertBlocks = useStore((state) => state.insertBlocks)
  const replaceBlockWithBlocks = useStore((state) => state.replaceBlockWithBlocks)
  const toggleTodo = useStore((state) => state.toggleTodo)
  const celebrate = useStore((state) => state.celebrate)
  const settings = useStore((state) => state.settings)
  const pushToast = useStore((state) => state.pushToast)

  const [menuOpen, setMenuOpen] = useState(false)
  const [menuMode, setMenuMode] = useState<'convert' | 'insert'>('convert')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [urlOpen, setUrlOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiAction, setAiAction] = useState<'correct' | 'generate' | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [aiGenerated, setAiGenerated] = useState<Block[]>([])
  const [focusAfterAi, setFocusAfterAi] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLTextAreaElement>(null)
  const aiPromptRef = useRef<HTMLTextAreaElement>(null)
  const latestHtml = useRef(block.html)
  const mounted = useRef(true)

  latestHtml.current = block.html

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  })

  useEffect(() => {
    const textarea = codeRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.max(60, textarea.scrollHeight)}px`
  }, [block.html])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!focusAfterAi) return
    const element = document.querySelector<HTMLElement>(
      `[data-block-id="${block.id}"] .editable`,
    )
    if (!element) return
    element.focus()
    const selection = window.getSelection()
    if (!selection) return
    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }, [focusAfterAi, block.id])

  const update = (patch: Partial<Block>) => updateBlock(noteId, block.id, patch)

  const handleToggle = () => {
    const next = !block.checked
    toggleTodo(noteId, block.id)
    if (next) {
      if (settings.confetti) celebrate()
      if (settings.sounds) playSound('check')
    } else if (settings.sounds) {
      playSound('uncheck')
    }
  }

  const handleBackspaceEmpty = () => {
    if (block.type !== 'paragraph') {
      update({ type: 'paragraph', emoji: undefined, language: undefined })
      window.setTimeout(() => focusEditable(block.id, 'start'), 10)
      return
    }
    onDelete()
  }

  const editableProps = {
    onChange: (html: string) => {
      update({ html })
      if (aiSuggestion) setAiSuggestion('')
      if (aiGenerated.length) setAiGenerated([])
    },
    onSplit,
    onBackspaceEmpty: handleBackspaceEmpty,
    onMergePrevious: onMerge,
    onArrowUp: () => onArrow('up'),
    onArrowDown: () => onArrow('down'),
    onSlash: () => {
      setMenuMode('convert')
      setMenuOpen(true)
    },
    onShortcut: (type: BlockType) => onConvert(type),
    onPasteText,
  }

  const pickImage = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const src = await imageFileToDataUrl(file)
      update({ src })
      pushToast('Görsel eklendi.', 'success')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Görsel eklenemedi.')
    } finally {
      setBusy(false)
    }
  }

  const applyUrl = () => {
    const trimmed = url.trim()
    if (!/^https?:\/\//i.test(trimmed)) {
      setError('Bağlantı http:// veya https:// ile başlamalı.')
      return
    }
    update({ src: trimmed })
    setUrl('')
    setUrlOpen(false)
    setError('')
  }

  const canUseBlockAi =
    block.type !== 'image' && block.type !== 'divider' && block.type !== 'code' && block.type !== 'table'
  const blockText = htmlToText(block.html).trim()

  const toggleAiPanel = () => {
    if (aiBusy) return
    setAiPanelOpen((open) => {
      const next = !open
      if (next) window.setTimeout(() => aiPromptRef.current?.focus(), 40)
      return next
    })
  }

  const closeAiPanel = () => {
    if (aiBusy) return
    setAiPanelOpen(false)
  }

  const runBlockAi = async (mode: 'correct' | 'generate') => {
    if (aiBusy) return

    const text = htmlToText(block.html).trim()
    const customPrompt = aiPrompt.trim()

    if (mode === 'correct' && !text) {
      pushToast('Düzeltmek için önce bloğa bir metin yaz.', 'danger')
      return
    }

    if (mode === 'generate' && !customPrompt) {
      pushToast('AI’ya ne oluşturmasını istediğini yaz.', 'danger')
      return
    }

    const provider = AI_PROVIDERS[settings.aiProvider] ?? AI_PROVIDERS.groq
    if (!settings.aiBaseUrl.trim() || !settings.aiModel.trim()) {
      pushToast('AI bağlantısı ayarlı değil. AI panelinden tamamla.', 'danger')
      return
    }

    const apiKey = getAiKey()
    if (provider.requiresKey && !apiKey.trim()) {
      pushToast('AI anahtarı yok. AI panelinden anahtarını gir.', 'danger')
      return
    }

    const originalHtml = block.html
    setAiPanelOpen(true)
    setAiBusy(true)
    setAiAction(mode)
    setAiSuggestion('')
    setAiGenerated([])

    try {
      const result = await chatComplete(
        aiConfigFromSettings(settings, apiKey),
        [
          {
            role: 'system',
            content: defaultSystemPrompt(mode === 'correct' ? 'improve' : 'format'),
          },
          {
            role: 'user',
            content:
              mode === 'correct'
                ? buildBlockPrompt(block.type, text, customPrompt)
                : buildBlockGeneratePrompt(block.type, text, customPrompt),
          },
        ],
        { temperature: mode === 'correct' ? 0.2 : 0.55, maxTokens: mode === 'correct' ? 800 : 1400 },
      )

      if (!mounted.current) return
      if (latestHtml.current !== originalHtml) {
        pushToast('Blok bu sırada değişti; AI önerisi gösterilmedi.', 'danger')
        return
      }

      if (mode === 'correct') {
        const html = blockAiTextToHtml(result)
        if (!htmlToText(html).trim()) {
          pushToast('AI boş bir öneri döndürdü. Tekrar dene.', 'danger')
          return
        }
        setAiSuggestion(html)
      } else {
        const generated = markdownToBlocks(cleanGeneratedMarkdown(result)).filter(
          (item) =>
            item.type === 'divider' ||
            item.type === 'image' ||
            Boolean(htmlToText(item.html).trim()),
        )
        if (!generated.length) {
          pushToast('AI boş bir taslak döndürdü. İstemi değiştirip tekrar dene.', 'danger')
          return
        }
        setAiGenerated(generated)
      }
    } catch (caught) {
      if (!mounted.current) return
      const message =
        mode === 'correct' ? 'AI bloğu düzeltemedi.' : 'AI içerik oluşturamadı.'
      pushToast(caught instanceof Error ? caught.message : message, 'danger')
    } finally {
      if (mounted.current) {
        setAiBusy(false)
        setAiAction(null)
      }
    }
  }

  const blurBlockEditor = () => {
    const active = document.activeElement
    if (active instanceof HTMLElement) {
      const row = active.closest('[data-block-id]')
      if (row?.getAttribute('data-block-id') === block.id) active.blur()
    }
  }

  const applyAiSuggestion = () => {
    if (!aiSuggestion) return

    blurBlockEditor()
    update({ html: aiSuggestion })
    setAiSuggestion('')
    setAiPanelOpen(false)
    setAiPrompt('')
    setFocusAfterAi((value) => value + 1)
    pushToast('Blok AI ile düzeltildi.', 'success')
  }

  const applyGenerated = (where: 'replace' | 'after') => {
    if (!aiGenerated.length) return

    blurBlockEditor()
    const generated = aiGenerated
    const ids =
      where === 'replace'
        ? replaceBlockWithBlocks(noteId, block.id, generated)
        : insertBlocks(noteId, generated, block.id)

    const focusId = generated.find(
      (item) => item.type !== 'divider' && item.type !== 'image' && item.type !== 'code',
    )?.id
    const firstId = ids[0]
    const targetId = focusId ?? firstId

    setAiGenerated([])
    setAiPanelOpen(false)
    setAiPrompt('')
    if (targetId) window.setTimeout(() => focusEditable(targetId, 'start'), 30)
    pushToast(
      where === 'replace' ? 'AI içeriği bloğa uygulandı.' : 'AI içeriği bloğun altına eklendi.',
      'success',
    )
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : undefined,
    zIndex: isDragging ? 20 : undefined,
  }

  const headingSpacing =
    block.type === 'heading1'
      ? 'pt-5'
      : block.type === 'heading2'
        ? 'pt-4'
        : block.type === 'heading3'
          ? 'pt-3'
          : ''

  const renderBody = () => {
    switch (block.type) {
      case 'code': {
        const code = decodeHtmlText(block.html)
        return (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-1.5">
              <select
                value={block.language ?? 'text'}
                onChange={(event) => update({ language: event.target.value })}
                className="cursor-pointer rounded-md bg-transparent text-[0.7rem] font-bold uppercase tracking-wide text-[var(--text-faint)] outline-none hover:text-[var(--text)]"
                aria-label="Kod dili"
              >
                {LANGUAGES.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(code)
                  pushToast('Kod kopyalandı.', 'success')
                }}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.7rem] font-bold text-[var(--text-faint)] transition hover:bg-[var(--surface)] hover:text-[var(--text)]"
              >
                <Copy className="size-3.5" />
                Kopyala
              </button>
            </div>
            <textarea
              ref={codeRef}
              value={code}
              onChange={(event) => update({ html: escapeHtml(event.target.value) })}
              onKeyDown={(event) => {
                if (event.key === 'Escape') event.currentTarget.blur()
              }}
              spellCheck={false}
              placeholder="Kodunu buraya yaz…"
              className="block max-h-[520px] min-h-[60px] w-full resize-none bg-transparent px-3.5 py-3 font-mono text-[13px] leading-6 outline-none placeholder:text-[var(--text-faint)]"
              aria-label="Kod bloğu"
            />
          </div>
        )
      }

      case 'divider':
        return (
          <div className="group/divider flex items-center gap-3 py-3">
            <span className="h-px flex-1 bg-[var(--border-strong)]" />
            <button
              type="button"
              onClick={onDelete}
              className="grid size-7 place-items-center rounded-md text-[var(--text-faint)] opacity-0 transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] group-hover/divider:opacity-100"
              aria-label="Ayırıcıyı sil"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )

      case 'image':
        return (
          <div className="py-1">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                void pickImage(event.target.files?.[0])
                event.target.value = ''
              }}
            />

            {block.src ? (
              <figure className="group/image relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]">
                <img
                  src={block.src}
                  alt={block.caption || 'Not görseli'}
                  className="max-h-[520px] w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition group-hover/image:opacity-100">
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="grid size-8 place-items-center rounded-lg bg-black/55 text-white backdrop-blur transition hover:bg-black/75"
                    aria-label="Görseli değiştir"
                    title="Görseli değiştir"
                  >
                    <ImagePlus className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ src: undefined, caption: undefined })}
                    className="grid size-8 place-items-center rounded-lg bg-black/55 text-white backdrop-blur transition hover:bg-[var(--danger)]"
                    aria-label="Görseli kaldır"
                    title="Görseli kaldır"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <input
                  value={block.caption ?? ''}
                  onChange={(event) => update({ caption: event.target.value })}
                  placeholder="Alt yazı ekle…"
                  className="w-full border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center text-xs font-medium text-[var(--text-soft)] outline-none placeholder:text-[var(--text-faint)]"
                />
              </figure>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-[var(--border-strong)] bg-[var(--surface-2)]/50 p-5">
                <div className="flex flex-col items-center gap-2 text-center">
                  <ImagePlus className="size-7 text-[var(--text-faint)]" />
                  <p className="text-sm font-bold">Görsel ekle</p>
                  <p className="text-xs text-[var(--text-faint)]">
                    Yükle ya da bir bağlantı yapıştır. Görseller notun içinde saklanır.
                  </p>
                  <div className="mt-1 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-[var(--accent-ink)] transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
                    >
                      <Upload className="size-3.5" />
                      {busy ? 'Yükleniyor…' : 'Yükle'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setUrlOpen((value) => !value)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold transition hover:bg-[var(--surface-2)]"
                    >
                      <Link2 className="size-3.5" />
                      Bağlantıdan
                    </button>
                  </div>
                  {urlOpen && (
                    <div className="mt-2 flex w-full max-w-sm gap-1.5">
                      <input
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            applyUrl()
                          }
                        }}
                        autoFocus
                        placeholder="https://..."
                        className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
                      />
                      <button
                        type="button"
                        onClick={applyUrl}
                        className="rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-xs font-bold text-[var(--accent-ink)]"
                      >
                        Ekle
                      </button>
                    </div>
                  )}
                  {error && <p className="text-xs font-semibold text-[var(--danger)]">{error}</p>}
                </div>
              </div>
            )}
          </div>
        )

      case 'table':
        return <TableBlock block={block} onChange={update} />

      case 'todo':
        return (
          <div className="flex items-start gap-2.5">
            <button
              type="button"
              onClick={handleToggle}
              role="checkbox"
              aria-checked={block.checked === true}
              aria-label="Yapılacakları işaretle"
              className={`mt-[3px] grid size-[19px] shrink-0 place-items-center rounded-[6px] border-2 transition active:scale-90 ${
                block.checked
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
                  : 'border-[var(--border-strong)] bg-[var(--surface)] hover:border-[var(--accent)]'
              }`}
            >
              {block.checked && <Check className="size-3" strokeWidth={3.5} />}
            </button>
            <Editable
              {...editableProps}
              html={block.html}
              placeholder={PLACEHOLDERS.todo}
              ariaLabel="Yapılacak"
              className={`${TEXT_CLASSES.todo} min-w-0 flex-1 transition ${
                block.checked ? 'text-[var(--text-faint)] line-through decoration-[var(--text-faint)]' : ''
              }`}
            />
          </div>
        )

      case 'bulleted':
        return (
          <div className="flex items-start gap-2.5 pl-1">
            <span className="mt-[0.62em] size-[5px] shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
            <Editable
              {...editableProps}
              html={block.html}
              placeholder={PLACEHOLDERS.bulleted}
              ariaLabel="Liste öğesi"
              className={`${TEXT_CLASSES.bulleted} min-w-0 flex-1`}
            />
          </div>
        )

      case 'numbered':
        return (
          <div className="flex items-start gap-2.5 pl-1">
            <span className="mt-[0.1em] min-w-5 shrink-0 text-right text-sm font-bold text-[var(--text-faint)]">
              {number ?? 1}.
            </span>
            <Editable
              {...editableProps}
              html={block.html}
              placeholder={PLACEHOLDERS.numbered}
              ariaLabel="Numaralı liste öğesi"
              className={`${TEXT_CLASSES.numbered} min-w-0 flex-1`}
            />
          </div>
        )

      case 'quote':
        return (
          <div className="border-l-[3px] border-[var(--accent)] pl-4">
            <Editable
              {...editableProps}
              html={block.html}
              placeholder={PLACEHOLDERS.quote}
              ariaLabel="Alıntı"
              className={TEXT_CLASSES.quote}
            />
          </div>
        )

      case 'callout':
        return (
          <div className="flex items-start gap-2.5 rounded-2xl border border-[color-mix(in_oklab,var(--accent)_16%,transparent)] bg-[var(--accent-soft)] px-3.5 py-3">
            <button
              type="button"
              onClick={() => setEmojiOpen(true)}
              className="mt-0.5 rounded-lg text-xl leading-none transition hover:scale-110"
              aria-label="Not kutusu simgesini değiştir"
            >
              {block.emoji ?? '💡'}
            </button>
            <Editable
              {...editableProps}
              html={block.html}
              placeholder={PLACEHOLDERS.callout}
              ariaLabel="Not kutusu"
              className={`${TEXT_CLASSES.callout} min-w-0 flex-1`}
            />
          </div>
        )

      default:
        return (
          <Editable
            {...editableProps}
            html={block.html}
            placeholder={PLACEHOLDERS[block.type]}
            ariaLabel={
              block.type === 'heading1'
                ? 'Büyük başlık'
                : block.type === 'heading2'
                  ? 'Orta başlık'
                  : block.type === 'heading3'
                    ? 'Küçük başlık'
                    : 'Metin'
            }
            className={TEXT_CLASSES[block.type] ?? TEXT_CLASSES.paragraph}
          />
        )
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-block-id={block.id}
      className={`block-row group/block relative ${headingSpacing} ${
        block.type === 'divider' ? '' : 'py-[3px]'
      } ${aiBusy || aiPanelOpen || aiSuggestion || aiGenerated.length ? 'block-ai-active' : ''}`}
    >
      <div className="block-tools absolute left-0 top-0.5 z-10 flex items-center gap-0.5 sm:-left-12">
        <button
          type="button"
          onClick={() => {
            setMenuMode('insert')
            setMenuOpen(true)
          }}
          className="grid size-6 place-items-center rounded-md text-[var(--text-faint)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          aria-label="Bu bloğun altına yeni blok ekle"
          title="Blok ekle"
        >
          <Plus className="size-4" />
        </button>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="grid size-6 cursor-grab touch-none place-items-center rounded-md text-[var(--text-faint)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)] active:cursor-grabbing"
          aria-label="Bloğu sürükle"
          title="Sürükleyerek taşı"
        >
          <GripVertical className="size-4" />
        </button>
      </div>

      {block.type !== 'divider' && (
        <div className="absolute right-0 top-0.5 z-10 flex items-center gap-1">
          <button
            type="button"
            onClick={onDelete}
            className="block-delete-action grid size-6 place-items-center rounded-md text-[var(--text-faint)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
            aria-label="Bloğu sil"
            title="Bloğu sil"
          >
            <Trash2 className="size-3.5" />
          </button>

          {canUseBlockAi && (
            <button
              type="button"
              onClick={toggleAiPanel}
              disabled={aiBusy}
              className={`block-ai-action inline-flex h-6 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-1.5 text-[0.65rem] font-extrabold text-[var(--text-faint)] shadow-[0_4px_12px_-8px_rgba(0,0,0,0.35)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-wait disabled:opacity-70 ${
                aiBusy || aiPanelOpen ? 'border-[var(--accent)] text-[var(--accent)]' : ''
              }`}
              aria-label="Blok AI panelini aç"
              aria-expanded={aiPanelOpen}
              title={aiBusy ? 'AI çalışıyor…' : 'AI ile düzelt veya oluştur'}
            >
              {aiBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              <span className="hidden sm:inline">AI</span>
            </button>
          )}
        </div>
      )}

      <div className={block.type === 'divider' ? '' : 'pl-9 sm:pl-0'}>
        <div className={canUseBlockAi ? 'pr-16 sm:pr-20' : 'pr-9'}>{renderBody()}</div>

        {aiPanelOpen && (
          <div className="animate-pop mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-soft)]">
            <div className="flex items-start gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                <Sparkles className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-[var(--text-faint)]">
                  Blok AI
                </p>
                <p className="mt-0.5 text-[0.7rem] font-semibold text-[var(--text-soft)]">
                  Düzelt ya da kendi isteminle yeni içerik oluştur. Boş bloklarda da çalışır.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAiPanel}
                disabled={aiBusy}
                className="grid size-6 shrink-0 place-items-center rounded-lg text-[var(--text-faint)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:opacity-40"
                aria-label="Blok AI panelini kapat"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <label className="mt-2.5 block">
              <span className="mb-1 block text-[0.62rem] font-extrabold uppercase tracking-[0.1em] text-[var(--text-faint)]">
                İstem
              </span>
              <textarea
                ref={aiPromptRef}
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault()
                    void runBlockAi(aiPrompt.trim() ? 'generate' : 'correct')
                  }
                }}
                rows={2}
                placeholder="Örn. AI hakkında bir başlık aç ve alt başlıklarda açıklama yap…"
                className="min-h-[60px] w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm font-semibold leading-relaxed text-[var(--text)] outline-none transition placeholder:text-[var(--text-faint)] focus:border-[var(--accent)]"
              />
            </label>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {AI_QUICK_PROMPTS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setAiPrompt(item.prompt)
                    aiPromptRef.current?.focus()
                  }}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/60 px-2 py-1 text-[0.62rem] font-bold text-[var(--text-soft)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => void runBlockAi('correct')}
                disabled={aiBusy || !blockText}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-xs font-extrabold text-[var(--accent-ink)] transition hover:bg-[var(--accent-strong)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                title={blockText ? 'Mevcut metni düzelt' : 'Düzeltmek için önce metin yaz'}
              >
                {aiBusy && aiAction === 'correct' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Wand2 className="size-3.5" />
                )}
                Düzelt
              </button>
              <button
                type="button"
                onClick={() => void runBlockAi('generate')}
                disabled={aiBusy || !aiPrompt.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-extrabold text-[var(--text-soft)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                title={aiPrompt.trim() ? 'İsteme göre içerik oluştur' : 'Önce bir istem yaz'}
              >
                {aiBusy && aiAction === 'generate' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ListPlus className="size-3.5" />
                )}
                Oluştur
              </button>
              <span className="ml-auto hidden text-[0.6rem] font-semibold text-[var(--text-faint)] sm:inline">
                Ctrl/Cmd + Enter
              </span>
            </div>
          </div>
        )}

        {aiBusy && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--text-soft)]">
            <Loader2 className="size-3.5 animate-spin text-[var(--accent)]" />
            {aiAction === 'generate' ? 'AI içerik oluşturuyor…' : 'AI bloğu düzeltiyor…'}
          </div>
        )}

        {aiSuggestion && (
          <div className="animate-pop mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-soft)]">
            <div className="flex items-start gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                <Sparkles className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-[var(--text-faint)]">
                  AI önerisi · düzeltme
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-[var(--text)]">
                  {htmlToText(aiSuggestion)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAiSuggestion('')}
                className="grid size-6 shrink-0 place-items-center rounded-lg text-[var(--text-faint)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                aria-label="AI önerisini kapat"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={applyAiSuggestion}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-xs font-extrabold text-[var(--accent-ink)] transition hover:bg-[var(--accent-strong)] active:scale-[0.98]"
              >
                <Check className="size-3.5" />
                Uygula
              </button>
              <button
                type="button"
                onClick={() => setAiSuggestion('')}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-bold text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => void runBlockAi('correct')}
                disabled={aiBusy}
                className="ml-auto rounded-lg px-2 py-1.5 text-xs font-bold text-[var(--text-faint)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:opacity-50"
              >
                Yeniden dene
              </button>
            </div>
          </div>
        )}

        {aiGenerated.length > 0 && (
          <div className="animate-pop mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-soft)]">
            <div className="flex items-start gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                <Sparkles className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-[var(--text-faint)]">
                  AI taslağı · {aiGenerated.length} blok
                </p>
                <p className="mt-0.5 text-[0.68rem] font-semibold text-[var(--text-soft)]">
                  Önizlemeyi kontrol et; bloğun yerine koy veya altına ekle.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAiGenerated([])}
                className="grid size-6 shrink-0 place-items-center rounded-lg text-[var(--text-faint)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                aria-label="AI taslağını kapat"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <GeneratedBlocksPreview blocks={aiGenerated} />

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyGenerated('replace')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-xs font-extrabold text-[var(--accent-ink)] transition hover:bg-[var(--accent-strong)] active:scale-[0.98]"
              >
                <Check className="size-3.5" />
                Bloğa uygula
              </button>
              <button
                type="button"
                onClick={() => applyGenerated('after')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-bold text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              >
                <Plus className="size-3.5" />
                Altına ekle
              </button>
              <button
                type="button"
                onClick={() => setAiGenerated([])}
                className="rounded-lg px-2 py-1.5 text-xs font-bold text-[var(--text-faint)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => void runBlockAi('generate')}
                disabled={aiBusy}
                className="ml-auto rounded-lg px-2 py-1.5 text-xs font-bold text-[var(--text-faint)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:opacity-50"
              >
                Yeniden dene
              </button>
            </div>
          </div>
        )}
      </div>

      <BlockTypeMenu
        open={menuOpen}
        mode={menuMode}
        onClose={() => setMenuOpen(false)}
        onSelect={(type) => {
          if (menuMode === 'insert') onInsert(type)
          else onConvert(type)
        }}
      />

      <EmojiPicker
        open={emojiOpen}
        current={block.emoji}
        onClose={() => setEmojiOpen(false)}
        onSelect={(emoji) => update({ emoji: emoji ?? '💡' })}
      />

      {block.type === 'code' && (
        <span className="ml-9 mt-1 block text-[0.65rem] font-semibold text-[var(--text-faint)] sm:ml-0">
          Esc ile çık • Sekmeyle değil, boşluklarla hizala
        </span>
      )}
    </div>
  )
}

function GeneratedBlocksPreview({ blocks }: { blocks: Block[] }) {
  const visible = blocks.slice(0, 16)

  return (
    <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2.5">
      {visible.map((item, index) => {
        const html = sanitizeHtml(item.html)

        switch (item.type) {
          case 'heading1':
            return (
              <p
                key={item.id}
                className="font-display text-lg font-bold leading-snug"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )
          case 'heading2':
            return (
              <p
                key={item.id}
                className="font-display text-base font-bold leading-snug"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )
          case 'heading3':
            return (
              <p
                key={item.id}
                className="text-sm font-extrabold leading-snug"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )
          case 'bulleted':
            return (
              <div key={item.id} className="flex items-start gap-2 text-sm leading-relaxed">
                <span className="mt-[0.58em] size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                <span className="min-w-0 flex-1" dangerouslySetInnerHTML={{ __html: html }} />
              </div>
            )
          case 'numbered':
            return (
              <div key={item.id} className="flex items-start gap-2 text-sm leading-relaxed">
                <span className="min-w-4 shrink-0 text-right text-xs font-bold text-[var(--text-faint)]">
                  {index + 1}.
                </span>
                <span className="min-w-0 flex-1" dangerouslySetInnerHTML={{ __html: html }} />
              </div>
            )
          case 'todo':
            return (
              <div key={item.id} className="flex items-start gap-2 text-sm leading-relaxed">
                <span className="mt-[0.25em] size-3.5 shrink-0 rounded border-2 border-[var(--border-strong)]" />
                <span className="min-w-0 flex-1" dangerouslySetInnerHTML={{ __html: html }} />
              </div>
            )
          case 'quote':
            return (
              <blockquote
                key={item.id}
                className="border-l-2 border-[var(--accent)] pl-2 text-sm italic leading-relaxed text-[var(--text-soft)]"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )
          case 'callout':
            return (
              <div
                key={item.id}
                className="flex items-start gap-2 rounded-lg bg-[var(--accent-soft)] px-2 py-1.5 text-sm leading-relaxed"
              >
                <span>{item.emoji ?? '💡'}</span>
                <span className="min-w-0 flex-1" dangerouslySetInnerHTML={{ __html: html }} />
              </div>
            )
          case 'code':
            return (
              <pre
                key={item.id}
                className="overflow-x-auto rounded-lg bg-[var(--surface-2)] p-2 font-mono text-[0.7rem] leading-5"
              >
                <code>{decodeHtmlText(item.html)}</code>
              </pre>
            )
          case 'divider':
            return <hr key={item.id} className="my-1 border-[var(--border-strong)]" />
          case 'table':
            return (
              <p key={item.id} className="text-xs font-semibold text-[var(--text-faint)]">
                ▦ Tablo · {item.rows?.length ?? 0}×{item.rows?.[0]?.length ?? 0}
              </p>
            )
          case 'image':
            return (
              <p key={item.id} className="text-xs font-semibold text-[var(--text-faint)]">
                🖼️ {item.caption || 'Görsel'}
              </p>
            )
          default:
            return (
              <p
                key={item.id}
                className="text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )
        }
      })}

      {blocks.length > visible.length && (
        <p className="pt-1 text-center text-[0.65rem] font-semibold text-[var(--text-faint)]">
          +{blocks.length - visible.length} blok daha…
        </p>
      )}
    </div>
  )
}

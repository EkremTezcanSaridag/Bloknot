import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  CheckCircle2,
  ClipboardCopy,
  Copy,
  Download,
  FileText,
  HardDrive,
  Image as ImageIcon,
  Maximize2,
  Menu,
  Minimize2,
  MoreHorizontal,
  Plus,
  Share2,
  Smile,
  Sparkles,
  Star,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { coverStyle } from '../../lib/covers'
import { fullDate, readingTime } from '../../lib/date'
import { focusEditable } from '../../lib/dom'
import { downloadText, noteToMarkdown, slugify } from '../../lib/markdown'
import { exportBackup } from '../../lib/backup'
import { htmlToText } from '../../lib/sanitize'
import { BlockList } from './BlockList'
import { EmptyState } from '../EmptyState'
import { EmojiPicker } from '../EmojiPicker'
import { CoverPicker } from '../CoverPicker'
import { LogoMark } from '../Logo'

export function Editor() {
  const note = useStore((state) =>
    state.activeNoteId ? state.notes.find((item) => item.id === state.activeNoteId) ?? null : null,
  )
  const hydrated = useStore((state) => state.hydrated)

  if (!hydrated) {
    return (
      <div className="grid h-full place-items-center">
        <div className="flex flex-col items-center gap-4">
          <LogoMark className="size-12 animate-pulse" />
          <p className="text-sm font-semibold text-[var(--text-faint)]">Defterin açılıyor…</p>
        </div>
      </div>
    )
  }

  if (!note) return <EmptyState />

  return <NoteEditor key={note.id} note={note} />
}

function NoteEditor({ note }: { note: NonNullable<ReturnType<typeof selectNote>> }) {
  const updateNote = useStore((state) => state.updateNote)
  const toggleFavorite = useStore((state) => state.toggleFavorite)
  const duplicateNote = useStore((state) => state.duplicateNote)
  const trashNote = useStore((state) => state.trashNote)
  const addBlock = useStore((state) => state.addBlock)
  const addTag = useStore((state) => state.addTag)
  const removeTag = useStore((state) => state.removeTag)
  const openShare = useStore((state) => state.openShare)
  const openDialog = useStore((state) => state.openDialog)
  const pushToast = useStore((state) => state.pushToast)
  const setSidebarOpen = useStore((state) => state.setSidebarOpen)
  const focusMode = useStore((state) => state.focusMode)
  const setFocusMode = useStore((state) => state.setFocusMode)

  const [emojiOpen, setEmojiOpen] = useState(false)
  const [coverOpen, setCoverOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = titleRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [note.title])

  useEffect(() => {
    if (!moreOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [moreOpen])

  useEffect(() => {
    if (!focusMode) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) {
        setFocusMode(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [focusMode, setFocusMode])

  const words = useMemo(
    () => note.blocks.reduce((total, block) => total + htmlToText(block.html).split(/\s+/).filter(Boolean).length, 0),
    [note.blocks],
  )

  const commitTag = () => {
    const cleaned = tagInput.trim().replace(/^#/, '')
    if (!cleaned) return
    addTag(note.id, cleaned)
    setTagInput('')
  }

  const downloadMarkdown = () => {
    downloadText(
      `${slugify(note.title || 'bloknot')}.md`,
      noteToMarkdown(note),
      'text/markdown;charset=utf-8',
    )
    pushToast('Markdown dosyası indirildi.', 'success')
  }

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(noteToMarkdown(note))
      pushToast('Markdown panoya kopyalandı.', 'success')
    } catch {
      pushToast('Panoya kopyalanamadı.', 'danger')
    }
  }

  const downloadJson = () => {
    downloadText(
      `${slugify(note.title || 'bloknot')}.json`,
      exportBackup([note]),
      'application/json;charset=utf-8',
    )
    pushToast('Not JSON olarak indirildi.', 'success')
  }

  const handleDuplicate = () => {
    const id = duplicateNote(note.id)
    if (id) pushToast('Notun kopyası oluşturuldu.', 'success')
  }

  const handleTrash = () => {
    trashNote(note.id)
    pushToast('Not çöp kutusuna taşındı.')
  }

  const continueWriting = () => {
    const last = note.blocks[note.blocks.length - 1]
    if (last && last.type === 'paragraph' && !last.html) {
      focusEditable(last.id, 'start')
      return
    }
    const id = addBlock(note.id, { type: 'paragraph' })
    focusEditable(id, 'start')
  }

  const firstEditable = note.blocks.find((block) => block.type !== 'divider' && block.type !== 'image')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header
        className={`sticky top-0 z-30 flex h-14 shrink-0 items-center gap-1.5 px-2.5 sm:px-4 ${
          focusMode
            ? 'pointer-events-none bg-transparent'
            : 'border-b border-[var(--border)]/70 bg-[var(--bg)]/85 backdrop-blur-md'
        }`}
      >
        {!focusMode && (
          <>
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="grid size-9 place-items-center rounded-xl text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] md:hidden"
              aria-label="Not listesini aç"
            >
              <Menu className="size-4.5" />
            </button>

            <div className="hidden min-w-0 items-center gap-2 text-xs font-semibold text-[var(--text-faint)] sm:flex">
              <span className="truncate">{note.emoji}</span>
              <span className="max-w-[260px] truncate">{note.title || 'Başlıksız not'}</span>
              <span className="mx-1 text-[var(--border-strong)]">/</span>
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="size-3.5 text-[var(--success)]" />
                Kaydedildi
              </span>
            </div>
          </>
        )}

        <div className="pointer-events-auto ml-auto flex items-center gap-1">
          {!focusMode && (
            <span className="mr-1 hidden items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[0.68rem] font-bold text-[var(--text-faint)] lg:inline-flex">
              <HardDrive className="size-3.5" />
              Bu cihazda
            </span>
          )}

          <button
            type="button"
            onClick={() => openDialog('ai')}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            title="AI asistan"
            aria-label="AI asistan"
          >
            <Sparkles className="size-4.5" />
            <span className="hidden text-xs font-bold sm:inline">AI</span>
          </button>

          <button
            type="button"
            onClick={() => (focusMode ? setFocusMode(false) : setFocusMode(true))}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            title={focusMode ? 'Odak modundan çık (Esc)' : 'Odak modu'}
            aria-label={focusMode ? 'Odak modundan çık' : 'Odak modu'}
          >
            {focusMode ? <Minimize2 className="size-4.5" /> : <Maximize2 className="size-4.5" />}
            <span className="hidden text-xs font-bold sm:inline">
              {focusMode ? 'Çık' : 'Odak'}
            </span>
          </button>

          {!focusMode && (
            <>
              <button
                type="button"
                onClick={() => toggleFavorite(note.id)}
                className={`grid size-9 place-items-center rounded-xl transition hover:bg-[var(--surface-2)] ${
                  note.favorite ? 'text-amber-500' : 'text-[var(--text-soft)] hover:text-[var(--text)]'
                }`}
                aria-label={note.favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                aria-pressed={note.favorite}
                title={note.favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
              >
                <Star className={`size-4.5 ${note.favorite ? 'fill-current' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => openShare(note.id)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-2.5 text-xs font-extrabold text-[var(--accent-ink)] shadow-[0_8px_20px_-12px_var(--accent)] transition hover:bg-[var(--accent-strong)] active:scale-[0.98] sm:px-3.5"
              >
                <Share2 className="size-4" />
                <span className="hidden sm:inline">Paylaş</span>
              </button>

              <button
                type="button"
                onClick={handleTrash}
                className="grid size-9 place-items-center rounded-xl text-[var(--text-soft)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                aria-label="Notu çöp kutusuna taşı"
                title="Notu çöp kutusuna taşı"
              >
                <Trash2 className="size-4.5" />
              </button>

              <div className="relative" ref={moreRef}>
                <button
                  type="button"
                  onClick={() => setMoreOpen((value) => !value)}
                  className="grid size-9 place-items-center rounded-xl text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                  aria-label="Diğer işlemler"
                  aria-expanded={moreOpen}
                >
                  <MoreHorizontal className="size-5" />
                </button>

                {moreOpen && (
                  <div className="animate-pop absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-soft)]">
                    <MenuItem
                      icon={ImageIcon}
                      onClick={() => {
                        setMoreOpen(false)
                        setCoverOpen(true)
                      }}
                    >
                      {note.cover ? 'Kapağı değiştir' : 'Kapak ekle'}
                    </MenuItem>
                    <MenuItem
                      icon={Smile}
                      onClick={() => {
                        setMoreOpen(false)
                        setEmojiOpen(true)
                      }}
                    >
                      Simgeyi değiştir
                    </MenuItem>
                    <MenuItem
                      icon={Star}
                      onClick={() => {
                        setMoreOpen(false)
                        toggleFavorite(note.id)
                      }}
                    >
                      {note.favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                    </MenuItem>
                    <MenuItem
                      icon={Copy}
                      onClick={() => {
                        setMoreOpen(false)
                        handleDuplicate()
                      }}
                    >
                      Kopyasını oluştur
                    </MenuItem>

                    <div className="my-1 h-px bg-[var(--border)]" />

                    <MenuItem
                      icon={FileText}
                      onClick={() => {
                        setMoreOpen(false)
                        downloadMarkdown()
                      }}
                    >
                      Markdown indir
                    </MenuItem>
                    <MenuItem
                      icon={ClipboardCopy}
                      onClick={() => {
                        setMoreOpen(false)
                        void copyMarkdown()
                      }}
                    >
                      Markdown'u kopyala
                    </MenuItem>
                    <MenuItem
                      icon={Download}
                      onClick={() => {
                        setMoreOpen(false)
                        downloadJson()
                      }}
                    >
                      JSON indir
                    </MenuItem>

                    <div className="my-1 h-px bg-[var(--border)]" />

                    <MenuItem
                      icon={Trash2}
                      danger
                      onClick={() => {
                        setMoreOpen(false)
                        handleTrash()
                      }}
                    >
                      Çöp kutusuna taşı
                    </MenuItem>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <article className="mx-auto w-full max-w-3xl pb-40">
          {note.cover && (
            <div
              className="group/cover relative h-40 w-full sm:h-52"
              style={{ background: coverStyle(note.cover) }}
            >
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/45 to-transparent" />
              <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition group-hover/cover:opacity-100">
                <button
                  type="button"
                  onClick={() => setCoverOpen(true)}
                  className="rounded-lg bg-black/45 px-2.5 py-1.5 text-xs font-bold text-white backdrop-blur transition hover:bg-black/65"
                >
                  Kapağı değiştir
                </button>
                <button
                  type="button"
                  onClick={() => updateNote(note.id, { cover: undefined })}
                  className="grid size-8 place-items-center rounded-lg bg-black/45 text-white backdrop-blur transition hover:bg-[var(--danger)]"
                  aria-label="Kapağı kaldır"
                  title="Kapağı kaldır"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          )}

          {!note.cover && (
            <div className="flex justify-end px-5 pt-4 sm:px-12">
              <button
                type="button"
                onClick={() => setCoverOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-[var(--text-faint)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-soft)]"
              >
                <ImageIcon className="size-3.5" />
                Kapak ekle
              </button>
            </div>
          )}

          <div className={`px-5 sm:px-12 ${note.cover ? '-mt-12 sm:-mt-14' : 'mt-1'}`}>
            <button
              type="button"
              onClick={() => setEmojiOpen(true)}
              className="relative z-10 grid size-[76px] place-items-center rounded-3xl border border-[var(--border)] bg-[var(--surface)] text-5xl shadow-[var(--shadow-pop)] transition hover:scale-105 sm:size-[88px] sm:text-6xl"
              aria-label="Not simgesini değiştir"
              title="Simgeyi değiştir"
            >
              {note.emoji}
            </button>

            <textarea
              ref={titleRef}
              data-note-title
              rows={1}
              value={note.title}
              onChange={(event) => updateNote(note.id, { title: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  if (firstEditable) focusEditable(firstEditable.id, 'start')
                }
              }}
              placeholder="Başlıksız not"
              aria-label="Not başlığı"
              className="font-display mt-4 w-full resize-none overflow-hidden bg-transparent text-[2.1rem] font-bold leading-[1.12] tracking-tight outline-none placeholder:text-[var(--text-faint)] sm:text-[2.8rem]"
            />

            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <Tag className="size-3.5 text-[var(--text-faint)]" aria-hidden="true" />
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className="group/tag inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] py-0.5 pl-2.5 pr-1 text-xs font-bold text-[var(--accent)]"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTag(note.id, tag)}
                    className="grid size-4 place-items-center rounded-full opacity-50 transition hover:bg-black/10 hover:opacity-100"
                    aria-label={`${tag} etiketini kaldır`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ',') {
                    event.preventDefault()
                    commitTag()
                  }
                  if (event.key === 'Backspace' && !tagInput && note.tags.length) {
                    removeTag(note.id, note.tags[note.tags.length - 1])
                  }
                }}
                onBlur={commitTag}
                maxLength={24}
                placeholder={note.tags.length ? 'etiket ekle' : 'etiket ekle…'}
                className="w-24 rounded-full bg-transparent px-1 py-0.5 text-xs font-semibold outline-none placeholder:text-[var(--text-faint)] focus:w-32"
                aria-label="Etiket ekle"
              />
            </div>

            <p className="mt-3 text-[0.7rem] font-semibold text-[var(--text-faint)]">
              Son düzenleme {fullDate(note.updatedAt)}
              {words > 0 && ` · ${words} kelime · ${readingTime(words)}`}
            </p>
          </div>

          <div className="mt-7 px-5 sm:px-12">
            <BlockList note={note} />

            <button
              type="button"
              onClick={continueWriting}
              className="mt-3 flex w-full items-center gap-2 rounded-xl px-2 py-5 text-left text-sm font-semibold text-[var(--text-faint)] transition hover:bg-[var(--surface-2)]/70 hover:text-[var(--text-soft)]"
            >
              <Plus className="size-4" />
              Yazmaya devam et…
            </button>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-4 text-[0.68rem] font-semibold text-[var(--text-faint)]">
              <span className="inline-flex items-center gap-1.5">
                <HardDrive className="size-3.5" />
                Bu not yalnızca bu tarayıcıda saklanır.
              </span>
              <button
                type="button"
                onClick={() => openShare(note.id)}
                className="font-bold text-[var(--accent)] transition hover:opacity-70"
              >
                Bağlantıyla paylaş
              </button>
            </div>
          </div>
        </article>
      </div>

      <EmojiPicker
        open={emojiOpen}
        current={note.emoji}
        onClose={() => setEmojiOpen(false)}
        onSelect={(emoji) => updateNote(note.id, { emoji: emoji ?? '📝' })}
      />

      <CoverPicker
        open={coverOpen}
        current={note.cover}
        onClose={() => setCoverOpen(false)}
        onSelect={(cover) => updateNote(note.id, { cover })}
      />
    </div>
  )
}

function MenuItem({
  icon: Icon,
  children,
  onClick,
  danger,
}: {
  icon: typeof Star
  children: ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition ${
        danger
          ? 'text-[var(--danger)] hover:bg-[var(--danger-soft)]'
          : 'text-[var(--text-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
      }`}
    >
      <Icon className="size-4" />
      {children}
    </button>
  )
}

function selectNote(state: ReturnType<typeof useStore.getState>) {
  return state.notes.find((item) => item.id === state.activeNoteId) ?? null
}

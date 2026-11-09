import { useEffect, useMemo, useState, type ComponentType } from 'react'
import {
  CalendarDays,
  Command,
  DatabaseBackup,
  FileText,
  LayoutTemplate,
  Moon,
  Plus,
  Presentation,
  Search,
  Sparkles,
  Star,
  Sun,
  Trash2,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { relativeTime } from '../lib/date'
import { noteSnippet, searchNotes } from '../lib/search'
import { WRITING_PROMPTS } from '../lib/seed'
import { TEMPLATES } from '../lib/templates'

interface Action {
  id: string
  label: string
  hint: string
  icon: ComponentType<{ className?: string }>
  run: () => void
}

export function CommandPalette() {
  const open = useStore((state) => state.paletteOpen)
  const setPaletteOpen = useStore((state) => state.setPaletteOpen)
  const notes = useStore((state) => state.notes)
  const setActiveNote = useStore((state) => state.setActiveNote)
  const createNote = useStore((state) => state.createNote)
  const openDialog = useStore((state) => state.openDialog)
  const updateSettings = useStore((state) => state.updateSettings)
  const settings = useStore((state) => state.settings)
  const setFilter = useStore((state) => state.setFilter)

  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const close = () => setPaletteOpen(false)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
  }, [open])

  useEffect(() => {
    setActive(0)
  }, [query])

  const actions = useMemo<Action[]>(() => {
    const today = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' }).format(new Date())
    const daily = TEMPLATES.find((template) => template.id === 'gunluk')
    const isDark = document.documentElement.classList.contains('dark')
    const randomPrompt = WRITING_PROMPTS[Math.floor(Math.random() * WRITING_PROMPTS.length)]

    return [
      {
        id: 'new',
        label: 'Yeni not oluştur',
        hint: 'Boş bir sayfa aç',
        icon: Plus,
        run: () => createNote(),
      },
      {
        id: 'daily',
        label: 'Günün notunu aç',
        hint: today,
        icon: CalendarDays,
        run: () =>
          createNote({
            title: `Günün notu · ${today}`,
            emoji: '🌤️',
            tags: ['günlük'],
            blocks: daily?.blocks ?? [],
          }),
      },
      {
        id: 'templates',
        label: 'Şablonlara göz at',
        hint: 'Toplantı, günlük, kitap notu…',
        icon: LayoutTemplate,
        run: () => openDialog('templates'),
      },
      {
        id: 'slides',
        label: 'Dosyadan not oluştur',
        hint: 'PPTX, PDF veya DOCX',
        icon: Presentation,
        run: () => openDialog('slides'),
      },
      {
        id: 'random',
        label: 'Rastgele not aç',
        hint: 'Beni şaşırt',
        icon: Sparkles,
        run: () => {
          const pool = notes.filter((note) => !note.trashedAt)
          const pick = pool[Math.floor(Math.random() * pool.length)]
          if (pick) setActiveNote(pick.id)
        },
      },
      {
        id: 'inspire',
        label: 'İlhamla yeni not başlat',
        hint: randomPrompt,
        icon: Sparkles,
        run: () => createNote({ title: randomPrompt }),
      },
      {
        id: 'theme',
        label: isDark ? 'Açık temaya geç' : 'Koyu temaya geç',
        hint: 'Tema',
        icon: isDark ? Sun : Moon,
        run: () => updateSettings({ theme: isDark ? 'light' : 'dark' }),
      },
      {
        id: 'favorites',
        label: 'Favorileri göster',
        hint: 'Yıldızlı notlar',
        icon: Star,
        run: () => setFilter({ kind: 'favorites' }),
      },
      {
        id: 'trash',
        label: 'Çöp kutusunu aç',
        hint: 'Silinen notlar',
        icon: Trash2,
        run: () => setFilter({ kind: 'trash' }),
      },
      {
        id: 'backup',
        label: 'Yedek al',
        hint: settings.lastBackupAt ? 'Son yedek: ' + relativeTime(settings.lastBackupAt) : 'Henüz yedek alınmadı',
        icon: DatabaseBackup,
        run: () => openDialog('settings'),
      },
    ]
  }, [notes, settings.lastBackupAt, createNote, openDialog, updateSettings, setActiveNote, setFilter])

  const noteResults = useMemo(() => {
    const pool = notes.filter((note) => !note.trashedAt)
    const filtered = query.trim() ? searchNotes(pool, query) : pool
    return [...filtered].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6)
  }, [notes, query])

  const actionResults = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr')
    if (!needle) return actions
    return actions.filter((action) =>
      `${action.label} ${action.hint}`.toLocaleLowerCase('tr').includes(needle),
    )
  }, [actions, query])

  const flat = useMemo(
    () => [
      ...noteResults.map((note) => ({ kind: 'note' as const, id: note.id })),
      ...actionResults.map((action) => ({ kind: 'action' as const, id: action.id })),
    ],
    [noteResults, actionResults],
  )

  useEffect(() => {
    document.getElementById(`cmd-item-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const runActive = () => {
    const item = flat[active]
    if (!item) return
    if (item.kind === 'note') {
      setActiveNote(item.id)
    } else {
      actionResults.find((action) => action.id === item.id)?.run()
    }
    close()
  }

  let cursor = -1

  return (
    <div
      className="fixed inset-0 z-[85] flex items-start justify-center bg-black/40 px-4 pt-[11vh] backdrop-blur-[3px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
      role="presentation"
    >
      <div
        className="animate-fade-up flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]"
        role="dialog"
        aria-modal="true"
        aria-label="Komut paleti"
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-4 py-3">
          <Search className="size-4.5 shrink-0 text-[var(--text-faint)]" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                close()
              } else if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((value) => (flat.length ? (value + 1) % flat.length : 0))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((value) => (flat.length ? (value - 1 + flat.length) % flat.length : 0))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                runActive()
              }
            }}
            placeholder="Not ara ya da bir komut yaz…"
            className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:text-[var(--text-faint)]"
            aria-label="Komut veya not ara"
          />
          <span className="kbd">esc</span>
        </div>

        <div className="max-h-[56vh] overflow-y-auto p-2">
          {noteResults.length > 0 && (
            <>
              <p className="px-2.5 pb-1 pt-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.15em] text-[var(--text-faint)]">
                Notlar
              </p>
              {noteResults.map((note) => {
                cursor += 1
                const index = cursor
                return (
                  <button
                    key={note.id}
                    id={`cmd-item-${index}`}
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => {
                      setActiveNote(note.id)
                      close()
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${
                      active === index ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--surface-2)] text-base">
                      {note.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{note.title || 'Başlıksız'}</span>
                      <span className="block truncate text-[0.68rem] text-[var(--text-faint)]">
                        {noteSnippet(note, query) || 'Boş not'} · {relativeTime(note.updatedAt)}
                      </span>
                    </span>
                    <FileText className="size-3.5 shrink-0 text-[var(--text-faint)]" />
                  </button>
                )
              })}
            </>
          )}

          {actionResults.length > 0 && (
            <>
              <p className="px-2.5 pb-1 pt-2 text-[0.62rem] font-extrabold uppercase tracking-[0.15em] text-[var(--text-faint)]">
                Komutlar
              </p>
              {actionResults.map((action) => {
                cursor += 1
                const index = cursor
                const Icon = action.icon
                return (
                  <button
                    key={action.id}
                    id={`cmd-item-${index}`}
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => {
                      action.run()
                      close()
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${
                      active === index ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--border)] text-[var(--text-soft)]">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{action.label}</span>
                      <span className="block truncate text-[0.68rem] text-[var(--text-faint)]">
                        {action.hint}
                      </span>
                    </span>
                  </button>
                )
              })}
            </>
          )}

          {flat.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-2xl">🫥</p>
              <p className="mt-2 text-sm font-bold text-[var(--text-soft)]">Hiçbir şey bulunamadı.</p>
              <p className="mt-1 text-xs text-[var(--text-faint)]">Farklı bir kelime dene.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-2)]/60 px-3.5 py-2 text-[0.66rem] font-semibold text-[var(--text-faint)]">
          <span className="inline-flex items-center gap-1.5">
            <Command className="size-3.5" />
            ↑ ↓ gez · Enter seç
          </span>
          <span>{flat.length} sonuç</span>
        </div>
      </div>
    </div>
  )
}

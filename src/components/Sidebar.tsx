import { useMemo, useState } from 'react'
import {
  ArrowUpDown,
  DatabaseBackup,
  FileText,
  Hash,
  Moon,
  Plus,
  Presentation,
  RotateCcw,
  Search,
  Settings,
  Star,
  Sun,
  Trash2,
  X,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { dayGroup, relativeTime } from '../lib/date'
import { noteSnippet, highlightParts, searchNotes } from '../lib/search'
import { NOTE_SORTS, nextNoteSort, noteSortLabel, sortNotes } from '../lib/sort'
import { EMOJI_CHOICES } from '../lib/covers'
import { playSound } from '../lib/sound'
import { Logo } from './Logo'

export function Sidebar() {
  const notes = useStore((state) => state.notes)
  const activeNoteId = useStore((state) => state.activeNoteId)
  const filter = useStore((state) => state.filter)
  const search = useStore((state) => state.search)
  const sidebarOpen = useStore((state) => state.sidebarOpen)
  const settings = useStore((state) => state.settings)

  const setActiveNote = useStore((state) => state.setActiveNote)
  const setFilter = useStore((state) => state.setFilter)
  const setSearch = useStore((state) => state.setSearch)
  const setSidebarOpen = useStore((state) => state.setSidebarOpen)
  const createNote = useStore((state) => state.createNote)
  const trashNote = useStore((state) => state.trashNote)
  const restoreNote = useStore((state) => state.restoreNote)
  const deleteForever = useStore((state) => state.deleteForever)
  const emptyTrash = useStore((state) => state.emptyTrash)
  const toggleFavorite = useStore((state) => state.toggleFavorite)
  const openDialog = useStore((state) => state.openDialog)
  const updateSettings = useStore((state) => state.updateSettings)
  const pushToast = useStore((state) => state.pushToast)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false)

  const activeNotes = useMemo(() => notes.filter((note) => !note.trashedAt), [notes])
  const trashedNotes = useMemo(
    () => notes.filter((note) => note.trashedAt).sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0)),
    [notes],
  )

  const favorites = activeNotes.filter((note) => note.favorite)

  const tagCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const note of activeNotes) {
      for (const tag of note.tags) {
        map.set(tag, (map.get(tag) ?? 0) + 1)
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
  }, [activeNotes])

  const displayed = useMemo(() => {
    let list = filter.kind === 'trash' ? trashedNotes : activeNotes
    if (filter.kind === 'favorites') list = list.filter((note) => note.favorite)
    if (filter.kind === 'tag' && filter.tag) list = list.filter((note) => note.tags.includes(filter.tag!))
    if (search.trim()) list = searchNotes(list, search)
    return sortNotes(list, settings.noteSort)
  }, [activeNotes, trashedNotes, filter, search, settings.noteSort])

  const groups = useMemo(() => {
    if (filter.kind !== 'all' || search.trim() || settings.noteSort !== 'updated') return null
    const map = new Map<string, typeof displayed>()
    for (const note of displayed) {
      const label = dayGroup(note.updatedAt)
      map.set(label, [...(map.get(label) ?? []), note])
    }
    return Array.from(map.entries())
  }, [displayed, filter.kind, search, settings.noteSort])

  const handleNewNote = () => {
    const emoji = EMOJI_CHOICES[Math.floor(Math.random() * EMOJI_CHOICES.length)]
    createNote({ emoji })
    if (settings.sounds) playSound('create')
  }

  const handleTrashNote = (noteId: string) => {
    trashNote(noteId)
    pushToast('Not çöp kutusuna taşındı.')
  }

  const handleEmptyTrash = () => {
    emptyTrash()
    setConfirmEmptyTrash(false)
    pushToast('Çöp kutusu boşaltıldı.', 'danger')
  }

  const backupDue =
    activeNotes.length > 0 &&
    (!settings.lastBackupAt || Date.now() - settings.lastBackupAt > 14 * 86_400_000)

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[292px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
      aria-label="Not listesi"
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <Logo />
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="grid size-9 place-items-center rounded-xl text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] md:hidden"
          aria-label="Not listesini kapat"
        >
          <X className="size-4.5" />
        </button>
      </div>

      <div className="px-3.5 pb-3">
        <button
          type="button"
          onClick={handleNewNote}
          className="group flex w-full items-center gap-2 rounded-xl bg-[var(--accent)] px-3 py-2.5 text-sm font-extrabold text-[var(--accent-ink)] shadow-[0_10px_24px_-14px_var(--accent)] transition hover:bg-[var(--accent-strong)] active:scale-[0.99]"
        >
          <Plus className="size-4.5 transition group-hover:rotate-90" />
          Yeni not
          <span className="ml-auto hidden rounded-md bg-black/10 px-1.5 py-0.5 text-[0.65rem] font-bold opacity-70 sm:inline">
            yeni
          </span>
        </button>

        <button
          type="button"
          onClick={() => openDialog('slides')}
          className="mt-2 flex w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-extrabold text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
        >
          <Presentation className="size-4" />
          Dosyadan not
        </button>
      </div>

      <div className="px-3.5 pb-3">
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)]/60 px-2.5 py-2 transition focus-within:border-[var(--accent)]">
          <Search className="size-4 shrink-0 text-[var(--text-faint)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Notlarında ara…"
            className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none placeholder:text-[var(--text-faint)]"
            aria-label="Notlarda ara"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="grid size-5 place-items-center rounded-md text-[var(--text-faint)] hover:bg-[var(--surface-2)]"
              aria-label="Aramayı temizle"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <span className="kbd hidden sm:inline">⌘K</span>
          )}
        </div>
      </div>

      <nav className="space-y-0.5 px-2.5">
        <FilterRow
          icon={FileText}
          label="Tüm notlar"
          count={activeNotes.length}
          active={filter.kind === 'all'}
          onClick={() => setFilter({ kind: 'all' })}
        />
        <FilterRow
          icon={Star}
          label="Favoriler"
          count={favorites.length}
          active={filter.kind === 'favorites'}
          onClick={() => setFilter({ kind: 'favorites' })}
        />
        <FilterRow
          icon={Trash2}
          label="Çöp kutusu"
          count={trashedNotes.length}
          active={filter.kind === 'trash'}
          onClick={() => setFilter({ kind: 'trash' })}
        />
      </nav>

      {tagCounts.length > 0 && (
        <div className="mt-4 px-3.5">
          <p className="mb-1.5 flex items-center gap-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            <Hash className="size-3" />
            Etiketler
          </p>
          <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pb-1">
            {tagCounts.slice(0, 14).map(([tag, count]) => {
              const active = filter.kind === 'tag' && filter.tag === tag
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setFilter(active ? { kind: 'all' } : { kind: 'tag', tag })}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-bold transition ${
                    active
                      ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                      : 'bg-[var(--surface)] text-[var(--text-soft)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]'
                  }`}
                >
                  #{tag}
                  <span className={active ? 'opacity-70' : 'text-[var(--text-faint)]'}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 px-4 pb-1.5">
          <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            {filter.kind === 'trash'
              ? 'Çöp kutusu'
              : filter.kind === 'favorites'
                ? 'Favoriler'
                : filter.kind === 'tag'
                  ? `#${filter.tag ?? ''}`
                  : search
                    ? 'Arama sonuçları'
                    : 'Notlar'}
            <span className="ml-1.5 font-bold opacity-70">{displayed.length}</span>
          </p>

          {filter.kind !== 'trash' && (
            <button
              type="button"
              onClick={() => updateSettings({ noteSort: nextNoteSort(settings.noteSort) })}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.6rem] font-bold text-[var(--text-faint)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-soft)]"
              title={`Sıralama: ${noteSortLabel(settings.noteSort)} · tıkla ve değiştir`}
              aria-label={`Sıralamayı değiştir (şu an: ${noteSortLabel(settings.noteSort)})`}
            >
              <ArrowUpDown className="size-3" />
              {NOTE_SORTS.find((item) => item.value === settings.noteSort)?.short}
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
          {filter.kind === 'trash' && trashedNotes.length > 0 && (
            <div className="mb-2 flex items-center justify-end gap-1.5 px-1">
              {confirmEmptyTrash ? (
                <>
                  <button
                    type="button"
                    onClick={handleEmptyTrash}
                    className="inline-flex items-center gap-1 rounded-md bg-[var(--danger)] px-2 py-1 text-[0.65rem] font-bold text-white"
                  >
                    <Trash2 className="size-3" />
                    Eminim, boşalt
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmEmptyTrash(false)}
                    className="rounded-md px-2 py-1 text-[0.65rem] font-bold text-[var(--text-faint)] hover:text-[var(--text)]"
                  >
                    Vazgeç
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmEmptyTrash(true)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.65rem] font-bold text-[var(--text-faint)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                >
                  <Trash2 className="size-3" />
                  Çöp kutusunu boşalt
                </button>
              )}
            </div>
          )}

          {displayed.length === 0 && (
            <div className="px-3 py-8 text-center">
              <p className="text-2xl">{filter.kind === 'trash' ? '🗑️' : search ? '🔍' : '🪴'}</p>
              <p className="mt-2 text-xs font-bold text-[var(--text-soft)]">
                {filter.kind === 'trash'
                  ? 'Çöp kutusu boş.'
                  : search
                    ? 'Aramaya uyan not yok.'
                    : 'Henüz not yok.'}
              </p>
              {filter.kind === 'all' && !search && (
                <button
                  type="button"
                  onClick={handleNewNote}
                  className="mt-2 text-xs font-bold text-[var(--accent)] hover:opacity-70"
                >
                  İlk notunu oluştur
                </button>
              )}
            </div>
          )}

          {filter.kind === 'trash'
            ? displayed.map((note) => (
                <div
                  key={note.id}
                  className="group mb-1 rounded-xl px-2.5 py-2 transition hover:bg-[var(--surface-2)]"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-sm">{note.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold">{note.title || 'Başlıksız'}</p>
                      <p className="text-[0.65rem] font-semibold text-[var(--text-faint)]">
                        {note.trashedAt ? relativeTime(note.trashedAt) : ''} silindi
                      </p>
                    </div>
                  </div>
                  <div className="mt-1.5 flex gap-1.5 pl-6">
                    <button
                      type="button"
                      onClick={() => {
                        restoreNote(note.id)
                        pushToast('Not geri yüklendi.', 'success')
                      }}
                      className="inline-flex items-center gap-1 rounded-md bg-[var(--surface)] px-2 py-1 text-[0.65rem] font-bold text-[var(--text-soft)] transition hover:text-[var(--success)]"
                    >
                      <RotateCcw className="size-3" />
                      Geri yükle
                    </button>
                    {deletingId === note.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            deleteForever(note.id)
                            setDeletingId(null)
                            pushToast('Not kalıcı olarak silindi.', 'danger')
                          }}
                          className="rounded-md bg-[var(--danger)] px-2 py-1 text-[0.65rem] font-bold text-white"
                        >
                          Eminim, sil
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="rounded-md px-2 py-1 text-[0.65rem] font-bold text-[var(--text-faint)]"
                        >
                          Vazgeç
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeletingId(note.id)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.65rem] font-bold text-[var(--text-faint)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                      >
                        <Trash2 className="size-3" />
                        Kalıcı sil
                      </button>
                    )}
                  </div>
                </div>
              ))
            : groups
              ? groups.map(([label, groupNotes]) => (
                  <div key={label} className="mb-2">
                    <p className="px-1.5 py-1 text-[0.6rem] font-extrabold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                      {label}
                    </p>
                    {groupNotes.map((note) => (
                      <NoteItem
                        key={note.id}
                        note={note}
                        query={search}
                        active={note.id === activeNoteId}
                        onClick={() => setActiveNote(note.id)}
                        onFavorite={() => toggleFavorite(note.id)}
                        onTrash={() => handleTrashNote(note.id)}
                      />
                    ))}
                  </div>
                ))
              : displayed.map((note) => (
                  <NoteItem
                    key={note.id}
                    note={note}
                    query={search}
                    active={note.id === activeNoteId}
                    onClick={() => setActiveNote(note.id)}
                    onFavorite={() => toggleFavorite(note.id)}
                    onTrash={() => handleTrashNote(note.id)}
                  />
                ))}
        </div>
      </div>

      <div className="border-t border-[var(--border)] px-2.5 py-2.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
            className="grid size-9 place-items-center rounded-xl text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            aria-label={settings.theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
            title={settings.theme === 'dark' ? 'Açık tema' : 'Koyu tema'}
          >
            {settings.theme === 'dark' ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
          </button>

          <button
            type="button"
            onClick={() => openDialog('settings')}
            className="relative grid size-9 place-items-center rounded-xl text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            aria-label="Ayarlar"
            title="Ayarlar"
          >
            <Settings className="size-4.5" />
            {backupDue && (
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-amber-500 ring-2 ring-[var(--sidebar)]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => openDialog('settings')}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[0.62rem] font-bold text-[var(--text-faint)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-soft)]"
            title="Yedek durumu"
          >
            <DatabaseBackup className={`size-3.5 ${backupDue ? 'text-amber-500' : ''}`} />
            {backupDue ? 'Yedek zamanı' : 'Yedek güncel'}
          </button>
        </div>
        <p className="mt-1 px-1 text-[0.6rem] font-semibold text-[var(--text-faint)]">
          Yerel defter · çevrimdışı çalışır
        </p>
      </div>
    </aside>
  )
}

function FilterRow({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: typeof FileText
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-bold transition ${
        active
          ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
          : 'text-[var(--text-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
      }`}
    >
      <Icon className="size-4" />
      {label}
      <span className={`ml-auto text-[0.66rem] font-extrabold ${active ? 'opacity-80' : 'text-[var(--text-faint)]'}`}>
        {count}
      </span>
    </button>
  )
}

function NoteItem({
  note,
  query,
  active,
  onClick,
  onFavorite,
  onTrash,
}: {
  note: ReturnType<typeof useStore.getState>['notes'][number]
  query: string
  active: boolean
  onClick: () => void
  onFavorite: () => void
  onTrash: () => void
}) {
  const snippet = noteSnippet(note, query)
  const highlighted = query.trim() ? highlightParts(snippet, query) : null

  return (
    <div
      className={`group/item relative mb-0.5 rounded-xl transition ${
        active ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--surface-2)]'
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`block w-full rounded-xl px-2.5 py-2 text-left ${active ? 'pl-3.5' : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 text-base leading-none">{note.emoji}</span>
          <div className="min-w-0 flex-1 pr-14">
            <div className="flex items-center gap-1">
              <span className={`truncate text-[13px] ${active ? 'font-extrabold text-[var(--accent)]' : 'font-bold'}`}>
                {note.title || 'Başlıksız'}
              </span>
              {note.favorite && <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-[0.68rem] font-medium text-[var(--text-faint)]">
                {highlighted
                  ? highlighted.map((part, index) =>
                      part.match ? (
                        <mark
                          key={index}
                          className="rounded bg-[var(--accent-soft)] px-0.5 font-bold text-[var(--accent)]"
                        >
                          {part.text}
                        </mark>
                      ) : (
                        <span key={index}>{part.text}</span>
                      ),
                    )
                  : snippet || 'Boş not'}
              </p>
              <span className="shrink-0 text-[0.6rem] font-semibold text-[var(--text-faint)]">
                {relativeTime(note.updatedAt)}
              </span>
            </div>
          </div>
        </div>
      </button>

      {active && <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-[var(--accent)]" />}

      <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onTrash()
          }}
          className="note-item-action grid size-6 place-items-center rounded-md bg-[var(--surface)]/90 text-[var(--text-faint)] shadow-sm transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
          aria-label="Notu çöp kutusuna taşı"
          title="Notu çöp kutusuna taşı"
        >
          <Trash2 className="size-3" />
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onFavorite()
          }}
          className="note-item-action grid size-6 place-items-center rounded-md bg-[var(--surface)]/90 text-[var(--text-faint)] shadow-sm transition hover:text-amber-500"
          aria-label={note.favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
          title={note.favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
        >
          <Star className={`size-3 ${note.favorite ? 'fill-amber-400 text-amber-400' : ''}`} />
        </button>
      </div>
    </div>
  )
}

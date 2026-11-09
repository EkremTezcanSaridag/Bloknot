import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ListTree } from 'lucide-react'
import type { Note } from '../../types'
import { htmlToText } from '../../lib/sanitize'
import { noteBacklinks, outgoingNoteLinks } from '../../lib/noteLinks'
import { useStore } from '../../store/useStore'

const LEVELS = { heading1: 0, heading2: 1, heading3: 2 } as const

type Tab = 'outline' | 'links'

interface OutlinePanelProps {
  note: Note
  onClose: () => void
}

export function OutlinePanel({ note, onClose }: OutlinePanelProps) {
  const notes = useStore((state) => state.notes)
  const setActiveNote = useStore((state) => state.setActiveNote)
  const pushToast = useStore((state) => state.pushToast)

  const [tab, setTab] = useState<Tab>('outline')

  const headings = useMemo(
    () =>
      note.blocks.flatMap((block) => {
        if (block.type !== 'heading1' && block.type !== 'heading2' && block.type !== 'heading3') {
          return []
        }
        const text = htmlToText(block.html).replace(/\s+/g, ' ').trim()
        if (!text) return []
        return [{ id: block.id, text, level: LEVELS[block.type] }]
      }),
    [note.blocks],
  )

  const outgoing = useMemo(() => outgoingNoteLinks(note, notes), [note, notes])
  const backlinks = useMemo(() => noteBacklinks(note.id, notes), [note.id, notes])

  const jump = (id: string) => {
    const element = document.querySelector<HTMLElement>(`[data-block-id="${id}"]`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      element.querySelector<HTMLElement>('.editable')?.focus({ preventScroll: true })
    }
    onClose()
  }

  const openNote = (id: string, exists: boolean, trashed: boolean) => {
    if (!exists) {
      pushToast(
        trashed ? 'Bu not çöp kutusunda.' : 'Bağlantıdaki not artık bulunamadı.',
        'danger',
      )
      return
    }
    setActiveNote(id)
    onClose()
  }

  return (
    <div
      className="animate-pop absolute right-0 top-11 z-50 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]"
      role="dialog"
      aria-label="İçindekiler ve bağlantılar"
    >
      <div className="border-b border-[var(--border)] px-2 pt-2.5">
        <div className="flex items-center gap-2 px-1">
          <ListTree className="size-4 shrink-0 text-[var(--accent)]" />
          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-[var(--text-faint)]">
            Gezinme
          </p>
        </div>

        <div className="mt-2 flex gap-1" role="tablist" aria-label="Gezinme sekmeleri">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'outline'}
            onClick={() => setTab('outline')}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-t-lg border-b-2 px-2 py-1.5 text-[0.68rem] font-bold transition ${
              tab === 'outline'
                ? 'border-[var(--accent)] text-[var(--text)]'
                : 'border-transparent text-[var(--text-faint)] hover:text-[var(--text-soft)]'
            }`}
          >
            İçindekiler
            <span className="rounded-full bg-[var(--surface-2)] px-1.5 text-[0.58rem] font-bold text-[var(--text-faint)]">
              {headings.length}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'links'}
            onClick={() => setTab('links')}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-t-lg border-b-2 px-2 py-1.5 text-[0.68rem] font-bold transition ${
              tab === 'links'
                ? 'border-[var(--accent)] text-[var(--text)]'
                : 'border-transparent text-[var(--text-faint)] hover:text-[var(--text-soft)]'
            }`}
          >
            Bağlantılar
            <span className="rounded-full bg-[var(--surface-2)] px-1.5 text-[0.58rem] font-bold text-[var(--text-faint)]">
              {outgoing.length + backlinks.length}
            </span>
          </button>
        </div>
      </div>

      {tab === 'outline' ? (
        headings.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs font-semibold text-[var(--text-faint)]">
            Başlık ekledikçe içindekiler burada oluşur.
          </p>
        ) : (
          <nav className="max-h-[55vh] overflow-y-auto p-1.5" aria-label="İçindekiler">
            {headings.map((heading) => (
              <button
                key={heading.id}
                type="button"
                onClick={() => jump(heading.id)}
                className="flex w-full items-start gap-2 rounded-lg py-1.5 pr-2 text-left text-[13px] font-bold text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                style={{ paddingLeft: `${0.5 + heading.level * 0.9}rem` }}
                title={heading.text}
              >
                <span
                  className={`mt-[0.45em] size-1.5 shrink-0 rounded-full ${
                    heading.level === 0
                      ? 'bg-[var(--accent)]'
                      : heading.level === 1
                        ? 'bg-[var(--text-faint)]'
                        : 'bg-[var(--border-strong)]'
                  }`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{heading.text}</span>
              </button>
            ))}
          </nav>
        )
      ) : (
        <div className="max-h-[55vh] overflow-y-auto p-1.5">
          <section aria-label="Bu nottan giden bağlantılar">
            <p className="flex items-center gap-1 px-1.5 py-1 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-[var(--text-faint)]">
              <ArrowUpRight className="size-3" />
              Bu nottan giden
            </p>

            {outgoing.length === 0 ? (
              <p className="px-2 pb-2 text-[0.7rem] font-semibold text-[var(--text-faint)]">
                Henüz bağlantı yok. Araç çubuğundaki kitap simgesiyle başka bir nota bağlantı
                verebilirsin.
              </p>
            ) : (
              outgoing.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => openNote(link.id, link.exists, link.trashed)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-bold text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                  title={link.title || 'Silinmiş not'}
                >
                  <span className="shrink-0 text-sm">{link.emoji}</span>
                  <span className={`min-w-0 flex-1 truncate ${link.exists ? '' : 'line-through opacity-60'}`}>
                    {link.title || (link.trashed ? 'Çöp kutusundaki not' : 'Bulunamayan not')}
                  </span>
                  <ArrowUpRight className="size-3 shrink-0 text-[var(--text-faint)]" />
                </button>
              ))
            )}
          </section>

          <section
            className="mt-1 border-t border-[var(--border)] pt-1"
            aria-label="Bu nota gelen bağlantılar"
          >
            <p className="flex items-center gap-1 px-1.5 py-1 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-[var(--text-faint)]">
              <ArrowDownLeft className="size-3" />
              Bu nota gelen
            </p>

            {backlinks.length === 0 ? (
              <p className="px-2 pb-2 text-[0.7rem] font-semibold text-[var(--text-faint)]">
                Başka bir not bu nota bağlantı verdiğinde burada görünür.
              </p>
            ) : (
              backlinks.map((backlink) => (
                <button
                  key={backlink.note.id}
                  type="button"
                  onClick={() => openNote(backlink.note.id, true, false)}
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-[var(--surface-2)]"
                  title={backlink.note.title || 'Başlıksız not'}
                >
                  <span className="mt-0.5 shrink-0 text-sm">{backlink.note.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-[var(--text-soft)]">
                        {backlink.note.title || 'Başlıksız not'}
                      </span>
                      <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-1.5 text-[0.55rem] font-bold text-[var(--accent)]">
                        {backlink.count}
                      </span>
                    </span>
                    {backlink.snippet && (
                      <span className="mt-0.5 line-clamp-2 block text-[0.66rem] font-medium text-[var(--text-faint)]">
                        {backlink.snippet}
                      </span>
                    )}
                  </span>
                </button>
              ))
            )}
          </section>
        </div>
      )}

      <p className="border-t border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-1.5 text-[0.62rem] font-semibold text-[var(--text-faint)]">
        {tab === 'outline' ? 'Başlığa tıkla, nota atla' : 'Bağlantıya tıkla, notu aç'}
      </p>
    </div>
  )
}

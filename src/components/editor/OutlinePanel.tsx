import { useMemo } from 'react'
import { ListTree } from 'lucide-react'
import type { Note } from '../../types'
import { htmlToText } from '../../lib/sanitize'

const LEVELS = { heading1: 0, heading2: 1, heading3: 2 } as const

interface OutlinePanelProps {
  note: Note
  onClose: () => void
}

export function OutlinePanel({ note, onClose }: OutlinePanelProps) {
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

  const jump = (id: string) => {
    const element = document.querySelector<HTMLElement>(`[data-block-id="${id}"]`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      element.querySelector<HTMLElement>('.editable')?.focus({ preventScroll: true })
    }
    onClose()
  }

  return (
    <div
      className="animate-pop absolute right-0 top-11 z-50 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]"
      role="dialog"
      aria-label="İçindekiler"
    >
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
        <ListTree className="size-4 shrink-0 text-[var(--accent)]" />
        <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-[var(--text-faint)]">
          İçindekiler
        </p>
        <span className="ml-auto rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[0.6rem] font-bold text-[var(--text-faint)]">
          {headings.length}
        </span>
      </div>

      {headings.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs font-semibold text-[var(--text-faint)]">
          Başlık ekledikçe içindekiler burada oluşur.
        </p>
      ) : (
        <nav className="max-h-[55vh] overflow-y-auto p-1.5">
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
      )}

      <p className="border-t border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-1.5 text-[0.62rem] font-semibold text-[var(--text-faint)]">
        Başlığa tıkla, nota atla
      </p>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { Note } from '../types'
import { useStore } from '../store/useStore'
import { relativeTime } from '../lib/date'
import { htmlToText } from '../lib/sanitize'
import { noteWordCount } from '../lib/stats'

interface Preview {
  note: Note
  top: number
  left: number
}

const SHOW_DELAY = 420
const CARD_WIDTH = 288
const CARD_HEIGHT = 148

function snippetFor(note: Note): string {
  for (const block of note.blocks) {
    if (block.type === 'divider') continue

    if (block.type === 'image') {
      if (block.caption?.trim()) return block.caption.trim().slice(0, 120)
      continue
    }

    if (block.type === 'table') {
      const cells = (block.rows ?? []).flat().map((cell) => cell.trim()).filter(Boolean)
      if (cells.length) return cells.join(' · ').slice(0, 120)
      continue
    }

    const text = htmlToText(block.html).replace(/\s+/g, ' ').trim()
    if (text) return text.slice(0, 120)
  }

  return ''
}

/** Not bağlantısının üzerine gelince hedef notun kısa önizlemesini gösterir. */
export function NoteLinkPreview() {
  const [preview, setPreview] = useState<Preview | null>(null)
  const timer = useRef<number | null>(null)
  const anchorRef = useRef<Element | null>(null)

  useEffect(() => {
    const clear = () => {
      if (timer.current) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
      anchorRef.current = null
      setPreview(null)
    }

    const onOver = (event: MouseEvent) => {
      if (event.buttons !== 0) return

      const target = event.target as Element | null
      const anchor = target?.closest?.('a[data-note-id]')
      if (!anchor || anchor === anchorRef.current) return

      if (timer.current) window.clearTimeout(timer.current)
      anchorRef.current = anchor

      timer.current = window.setTimeout(() => {
        const noteId = anchor.getAttribute('data-note-id')
        if (!noteId) return

        const note = useStore
          .getState()
          .notes.find((item) => item.id === noteId && !item.trashedAt)
        if (!note) return

        const rect = anchor.getBoundingClientRect()
        const left = Math.min(
          Math.max(rect.left, 12),
          Math.max(12, window.innerWidth - CARD_WIDTH - 12),
        )
        const below = rect.bottom + 10
        const top =
          below + CARD_HEIGHT > window.innerHeight
            ? Math.max(12, rect.top - CARD_HEIGHT - 10)
            : below

        setPreview({ note, top, left })
      }, SHOW_DELAY)
    }

    const onOut = (event: MouseEvent) => {
      const target = event.target as Element | null
      const anchor = target?.closest?.('a[data-note-id]')
      if (!anchor || anchor !== anchorRef.current) return
      clear()
    }

    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onOut)
    document.addEventListener('mousedown', clear)
    document.addEventListener('scroll', clear, true)
    window.addEventListener('blur', clear)

    return () => {
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout', onOut)
      document.removeEventListener('mousedown', clear)
      document.removeEventListener('scroll', clear, true)
      window.removeEventListener('blur', clear)
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  if (!preview) return null

  const { note, top, left } = preview
  const snippet = snippetFor(note)

  return (
    <div
      className="animate-fade-up pointer-events-none fixed z-[70] w-72 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-pop)]"
      style={{ top, left }}
      role="tooltip"
      aria-label="Not bağlantısı önizlemesi"
    >
      <div className="flex items-start gap-2">
        <span className="text-xl leading-none">{note.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">{note.title || 'Başlıksız not'}</p>
          <p className="mt-0.5 text-[0.6rem] font-semibold text-[var(--text-faint)]">
            {relativeTime(note.updatedAt)} · {noteWordCount(note)} kelime
          </p>
        </div>
      </div>

      {snippet && (
        <p className="mt-2 line-clamp-3 text-[0.7rem] font-medium leading-5 text-[var(--text-soft)]">
          {snippet}
        </p>
      )}

      <p className="mt-2 text-[0.58rem] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">
        Açmak için tıkla
      </p>
    </div>
  )
}

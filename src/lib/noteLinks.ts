import type { Note } from '../types'
import { htmlToText } from './sanitize'

/** Uygulama içi not kimliği (createId('n')). */
const NOTE_ID_PATTERN = /^n_[a-z0-9]+$/i
const SNIPPET_LENGTH = 110

export interface OutgoingNoteLink {
  id: string
  /** Hedef not defterde varsa başlığı, yoksa boş. */
  title: string
  emoji: string
  exists: boolean
  trashed: boolean
}

export interface NoteBacklink {
  note: Note
  /** Notta bu nota kaç kez bağlantı verildiği. */
  count: number
  /** Bağlantının bulunduğu bloktan kısa bir alıntı. */
  snippet: string
}

/** Bir HTML parçasındaki not bağlantısı kimliklerini sırayla döndürür. */
export function noteIdsInHtml(html: string): string[] {
  if (!html || typeof DOMParser === 'undefined') return []

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const ids: string[] = []

  for (const anchor of Array.from(doc.body.querySelectorAll('a[data-note-id]'))) {
    const id = anchor.getAttribute('data-note-id')?.trim() ?? ''
    if (NOTE_ID_PATTERN.test(id) && !ids.includes(id)) ids.push(id)
  }

  return ids
}

/** Notun gövdesinden dışa giden bağlantılar (tekrarsız). */
export function outgoingNoteLinks(note: Note, notes: Note[]): OutgoingNoteLink[] {
  const ids: string[] = []
  for (const block of note.blocks) {
    for (const id of noteIdsInHtml(block.html)) {
      if (!ids.includes(id)) ids.push(id)
    }
  }

  return ids.map((id) => {
    const target = notes.find((item) => item.id === id)
    return {
      id,
      title: target?.title ?? '',
      emoji: target?.emoji ?? '🔗',
      exists: Boolean(target && !target.trashedAt),
      trashed: Boolean(target?.trashedAt),
    }
  })
}

function snippetFor(html: string): string {
  return htmlToText(html).replace(/\s+/g, ' ').trim().slice(0, SNIPPET_LENGTH)
}

function countLinksTo(html: string, noteId: string): number {
  if (!html || typeof DOMParser === 'undefined') return 0

  const doc = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(doc.body.querySelectorAll('a[data-note-id]')).filter(
    (anchor) => anchor.getAttribute('data-note-id')?.trim() === noteId,
  ).length
}

/** Bu nota başka notlardan verilen bağlantılar (geri bağlantılar). */
export function noteBacklinks(noteId: string, notes: Note[]): NoteBacklink[] {
  const backlinks: NoteBacklink[] = []

  for (const note of notes) {
    if (note.id === noteId || note.trashedAt) continue

    let count = 0
    let snippet = ''

    for (const block of note.blocks) {
      const matches = countLinksTo(block.html, noteId)
      if (!matches) continue
      count += matches
      if (!snippet) snippet = snippetFor(block.html)
    }

    if (count > 0) backlinks.push({ note, count, snippet })
  }

  return backlinks.sort((a, b) => b.note.updatedAt - a.note.updatedAt)
}

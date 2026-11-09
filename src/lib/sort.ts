import type { Note, NoteSort } from '../types'

export const NOTE_SORTS: Array<{ value: NoteSort; label: string; short: string }> = [
  { value: 'updated', label: 'Son düzenleme', short: 'Düzenleme' },
  { value: 'created', label: 'Oluşturulma', short: 'Oluşturma' },
  { value: 'title', label: 'Başlık (A–Z)', short: 'Başlık' },
]

export function nextNoteSort(current: NoteSort): NoteSort {
  const index = NOTE_SORTS.findIndex((item) => item.value === current)
  return NOTE_SORTS[(index + 1) % NOTE_SORTS.length].value
}

export function noteSortLabel(sort: NoteSort): string {
  return NOTE_SORTS.find((item) => item.value === sort)?.label ?? NOTE_SORTS[0].label
}

/** Notları seçilen ölçüte göre sıralar (boş başlıklar en sona). */
export function sortNotes(notes: Note[], sort: NoteSort): Note[] {
  const sorted = [...notes]

  if (sort === 'title') {
    return sorted.sort((a, b) => {
      const aTitle = a.title.trim()
      const bTitle = b.title.trim()
      if (!aTitle && !bTitle) return b.updatedAt - a.updatedAt
      if (!aTitle) return 1
      if (!bTitle) return -1
      return aTitle.localeCompare(bTitle, 'tr', { sensitivity: 'base' })
    })
  }

  if (sort === 'created') {
    return sorted.sort((a, b) => b.createdAt - a.createdAt || b.updatedAt - a.updatedAt)
  }

  return sorted.sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt)
}

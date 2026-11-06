import type { Note } from '../types'
import { htmlToText } from './sanitize'

const FOLD_MAP: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  İ: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  Ç: 'c',
  Ğ: 'g',
  Ş: 's',
  Ö: 'o',
  Ü: 'u',
}

export function fold(value: string): string {
  return value
    .split('')
    .map((char) => FOLD_MAP[char] ?? char)
    .join('')
    .toLocaleLowerCase('tr')
}

export function noteText(note: Note): string {
  return [note.title, note.tags.join(' '), ...note.blocks.map((block) => htmlToText(block.html))]
    .join(' ')
    .slice(0, 20_000)
}

export function noteMatches(note: Note, query: string): boolean {
  const needle = fold(query.trim())
  if (!needle) return true
  return fold(noteText(note)).includes(needle)
}

export function noteSnippet(note: Note): string {
  const block = note.blocks.find((item) => htmlToText(item.html).length > 0)
  if (block) return htmlToText(block.html).slice(0, 120)
  return ''
}

export function searchNotes(notes: Note[], query: string): Note[] {
  return notes.filter((note) => noteMatches(note, query))
}

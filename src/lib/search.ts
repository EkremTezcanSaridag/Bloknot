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

/** Türkçe karakterleri sadeleştirip küçük harfe indirir. */
export function fold(value: string): string {
  return value
    .split('')
    .map((char) => FOLD_MAP[char] ?? char)
    .join('')
    .toLocaleLowerCase('tr')
}

/** Türkçe harf varyantlarını da yakalayan, kaçışlı bir arama deseni üretir. */
const CHAR_VARIANTS: Record<string, string> = {
  c: '[cçCÇ]',
  g: '[gğGĞ]',
  i: '[iıİI]',
  o: '[oöOÖ]',
  s: '[sşSŞ]',
  u: '[uüUÜ]',
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildMatcher(query: string, global = false): RegExp {
  const pattern = fold(query)
    .split('')
    .map((char) => CHAR_VARIANTS[char] ?? escapeRegExp(char))
    .join('')

  return new RegExp(pattern, global ? 'gi' : 'i')
}

export function noteText(note: Note): string {
  return [note.title, note.tags.join(' '), ...note.blocks.map((block) => htmlToText(block.html))]
    .join(' ')
    .slice(0, 20_000)
}

export function noteMatches(note: Note, query: string): boolean {
  const needle = query.trim()
  if (!needle) return true
  return buildMatcher(needle).test(noteText(note))
}

/**
 * Not listesinde gösterilecek kısa önizleme.
 * Arama varsa eşleşmenin çevresinden bağlam döndürür.
 */
export function noteSnippet(note: Note, query = ''): string {
  const texts = note.blocks
    .map((block) => htmlToText(block.html).replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const needle = query.trim()

  if (needle && texts.length) {
    const matcher = buildMatcher(needle)
    for (const text of texts) {
      const match = matcher.exec(text)
      if (!match) continue
      const start = Math.max(0, match.index - 40)
      const end = Math.min(text.length, match.index + match[0].length + 50)
      return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`
    }
  }

  return texts[0]?.slice(0, 120) ?? ''
}

export interface HighlightPart {
  text: string
  match: boolean
}

/** Metni eşleşen / eşleşmeyen parçalara böler (Türkçe harf duyarlı). */
export function highlightParts(text: string, query: string): HighlightPart[] {
  const needle = query.trim()
  if (!needle || !text) return [{ text, match: false }]

  const matcher = buildMatcher(needle, true)
  const parts: HighlightPart[] = []
  let last = 0

  for (const match of text.matchAll(matcher)) {
    const index = match.index ?? 0
    if (index > last) parts.push({ text: text.slice(last, index), match: false })
    parts.push({ text: match[0], match: true })
    last = index + match[0].length
  }

  if (last < text.length) parts.push({ text: text.slice(last), match: false })
  return parts.length ? parts : [{ text, match: false }]
}

export function searchNotes(notes: Note[], query: string): Note[] {
  return notes.filter((note) => noteMatches(note, query))
}

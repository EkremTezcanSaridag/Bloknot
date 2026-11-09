import type { Note } from '../types'
import { htmlToText } from './sanitize'

/** Bir metindeki kelime sayısını döndürür (boşluklara göre). */
export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/**
 * Notun toplam kelime sayısı.
 * Blok metinleri, tablo hücreleri ve görsel açıklamaları sayılır.
 */
export function noteWordCount(note: Note): number {
  let words = 0

  for (const block of note.blocks) {
    words += countWords(htmlToText(block.html))
    if (block.caption) words += countWords(block.caption)

    if (block.rows) {
      for (const row of block.rows) {
        for (const cell of row) words += countWords(cell)
      }
    }
  }

  return words
}

/** Notun toplam karakter sayısı (HTML etiketleri hariç). */
export function noteCharCount(note: Note): number {
  let chars = 0

  for (const block of note.blocks) {
    chars += htmlToText(block.html).length
    if (block.caption) chars += block.caption.length
    if (block.rows) {
      for (const row of block.rows) {
        for (const cell of row) chars += cell.length
      }
    }
  }

  return chars
}

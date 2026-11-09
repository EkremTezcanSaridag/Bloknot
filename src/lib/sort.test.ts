import { describe, expect, it } from 'vitest'
import type { Note } from '../types'
import { nextNoteSort, noteSortLabel, sortNotes } from './sort'

function makeNote(id: string, title: string, createdAt: number, updatedAt: number): Note {
  return {
    id,
    title,
    emoji: '📝',
    tags: [],
    favorite: false,
    createdAt,
    updatedAt,
    blocks: [],
  }
}

const notes = [
  makeNote('a', 'Zeytin', 100, 300),
  makeNote('b', 'Armut', 200, 100),
  makeNote('c', '', 300, 200),
]

describe('sortNotes', () => {
  it('son düzenlemeye göre yeniden eskiye sıralar', () => {
    expect(sortNotes(notes, 'updated').map((note) => note.id)).toEqual(['a', 'c', 'b'])
  })

  it('oluşturulmaya göre sıralar', () => {
    expect(sortNotes(notes, 'created').map((note) => note.id)).toEqual(['c', 'b', 'a'])
  })

  it('başlığa göre Türkçe sıralar ve boş başlığı sona atar', () => {
    expect(sortNotes(notes, 'title').map((note) => note.id)).toEqual(['b', 'a', 'c'])
  })

  it('girdi dizisini değiştirmez', () => {
    const original = [...notes]
    sortNotes(notes, 'title')
    expect(notes).toEqual(original)
  })
})

describe('sıralama etiketleri', () => {
  it('sırayla döner', () => {
    expect(nextNoteSort('updated')).toBe('created')
    expect(nextNoteSort('created')).toBe('title')
    expect(nextNoteSort('title')).toBe('updated')
  })

  it('okunabilir etiket döndürür', () => {
    expect(noteSortLabel('title')).toBe('Başlık (A–Z)')
  })
})

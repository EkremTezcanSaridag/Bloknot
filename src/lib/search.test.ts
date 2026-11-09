import { describe, expect, it } from 'vitest'
import type { Note } from '../types'
import { fold, highlightParts, noteMatches, noteSnippet } from './search'

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    title: 'Deneme',
    emoji: '📝',
    tags: [],
    favorite: false,
    createdAt: 1,
    updatedAt: 1,
    blocks: [{ id: 'b1', type: 'paragraph', html: '' }],
    ...overrides,
  }
}

describe('fold', () => {
  it('Türkçe harfleri sadeleştirir', () => {
    expect(fold('ÇĞİÖŞÜ')).toBe('cgiosu')
  })
})

describe('noteMatches', () => {
  it('Türkçe harf varyantlarını eşler', () => {
    const note = makeNote({ title: 'Güzel bir gün' })
    expect(noteMatches(note, 'guzel')).toBe(true)
    expect(noteMatches(note, 'GÜN')).toBe(true)
    expect(noteMatches(note, 'gece')).toBe(false)
  })

  it('etiket ve blok metinlerinde arar', () => {
    const note = makeNote({
      title: '',
      tags: ['fikir'],
      blocks: [{ id: 'b1', type: 'paragraph', html: 'içerikte <b>şeker</b> var' }],
    })
    expect(noteMatches(note, 'fikir')).toBe(true)
    expect(noteMatches(note, 'seker')).toBe(true)
  })
})

describe('noteSnippet', () => {
  it('eşleşmenin çevresinden bağlam döndürür', () => {
    const note = makeNote({
      blocks: [
        { id: 'b1', type: 'paragraph', html: 'ilk blok' },
        { id: 'b2', type: 'paragraph', html: 'uzun bir metin içinde aradığım kelime burada geçiyor' },
      ],
    })
    const snippet = noteSnippet(note, 'aradigim')
    expect(snippet).toContain('aradığım')
    expect(snippet).not.toContain('ilk blok')
  })

  it('arama yokken ilk dolu bloğu döndürür', () => {
    const note = makeNote({
      blocks: [
        { id: 'b1', type: 'paragraph', html: '' },
        { id: 'b2', type: 'paragraph', html: 'ikinci blok' },
      ],
    })
    expect(noteSnippet(note)).toBe('ikinci blok')
  })
})

describe('highlightParts', () => {
  it('eşleşen parçaları işaretler', () => {
    const parts = highlightParts('Bugün güzel bir gün', 'guzel')
    expect(parts.map((part) => [part.text, part.match])).toEqual([
      ['Bugün ', false],
      ['güzel', true],
      [' bir gün', false],
    ])
  })

  it('arama yoksa tek parça döndürür', () => {
    expect(highlightParts('metin', '')).toEqual([{ text: 'metin', match: false }])
  })
})

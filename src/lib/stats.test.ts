import { describe, expect, it } from 'vitest'
import type { Note } from '../types'
import { countWords, noteCharCount, noteWordCount } from './stats'

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    title: 'Deneme',
    emoji: '📝',
    tags: [],
    favorite: false,
    createdAt: 1,
    updatedAt: 1,
    blocks: [],
    ...overrides,
  }
}

describe('countWords', () => {
  it('boş metinde sıfır döndürür', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   \n  ')).toBe(0)
  })

  it('kelimeleri boşluklara göre sayar', () => {
    expect(countWords('bir iki   üç\n dört')).toBe(4)
  })
})

describe('noteWordCount', () => {
  it('blok metinlerini sayar', () => {
    const note = makeNote({
      blocks: [
        { id: 'b1', type: 'paragraph', html: 'merhaba dünya' },
        { id: 'b2', type: 'heading1', html: 'başlık' },
        { id: 'b3', type: 'divider', html: '' },
      ],
    })
    expect(noteWordCount(note)).toBe(3)
  })

  it('tablo hücrelerini ve görsel açıklamalarını sayar', () => {
    const note = makeNote({
      blocks: [
        {
          id: 'b1',
          type: 'table',
          html: '',
          rows: [
            ['ürün', 'fiyat'],
            ['kalem', 'on lira'],
          ],
        },
        { id: 'b2', type: 'image', html: '', src: 'x', caption: 'gün batımı' },
      ],
    })
    expect(noteWordCount(note)).toBe(7)
  })
})

describe('noteCharCount', () => {
  it('HTML etiketlerini saymaz', () => {
    const note = makeNote({
      blocks: [{ id: 'b1', type: 'paragraph', html: '<b>kalın</b> metin' }],
    })
    expect(noteCharCount(note)).toBe('kalın metin'.length)
  })
})

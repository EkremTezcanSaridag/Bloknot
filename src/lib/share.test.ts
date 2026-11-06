import { describe, expect, it } from 'vitest'
import type { Note } from '../types'
import { decodeSharedNote, encodeNote } from './share'

function sampleNote(): Note {
  return {
    id: 'note-1',
    title: 'Paylaşılacak not',
    emoji: '💜',
    tags: ['fikir'],
    favorite: false,
    createdAt: 1000,
    updatedAt: 2000,
    blocks: [
      { id: 'b1', type: 'paragraph', html: '<strong>merhaba</strong> dünya' },
      { id: 'b2', type: 'todo', html: 'görev', checked: true },
    ],
  }
}

describe('encodeNote / decodeSharedNote', () => {
  it('notu bağlantıya gömüp geri okur', () => {
    const link = encodeNote(sampleNote())

    expect(link.url).toContain('#/p/')
    expect(link.tooBig).toBe(false)

    const decoded = decodeSharedNote(link.token)
    expect(decoded).not.toBeNull()
    expect(decoded?.title).toBe('Paylaşılacak not')
    expect(decoded?.tags).toEqual(['fikir'])
    expect(decoded?.blocks).toHaveLength(2)
    expect(decoded?.blocks[1].checked).toBe(true)
  })

  it('paylaşılan HTML’i temizler', () => {
    const note = sampleNote()
    note.blocks[0].html = '<script>alert(1)</script><b>güvenli</b>'

    const decoded = decodeSharedNote(encodeNote(note).token)
    expect(decoded?.blocks[0].html).toBe('<b>güvenli</b>')
  })

  it('tehlikeli kapak bağlantılarını yok sayar', () => {
    const note = sampleNote()
    note.cover = { type: 'image', src: 'javascript:alert(1)' }

    const decoded = decodeSharedNote(encodeNote(note).token)
    expect(decoded?.cover).toBeUndefined()
  })

  it('bozuk token için null döner', () => {
    expect(decodeSharedNote('bozuk-token')).toBeNull()
    expect(decodeSharedNote('')).toBeNull()
  })
})

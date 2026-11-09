import { describe, expect, it } from 'vitest'
import type { Note, NoteVersion } from '../types'
import {
  buildNoteVersion,
  noteHasContent,
  noteSignature,
  pruneVersionMap,
  trimNoteVersions,
  versionPreview,
} from './history'

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    title: 'Deneme',
    emoji: '📝',
    tags: ['fikir'],
    favorite: false,
    createdAt: 1,
    updatedAt: 1,
    blocks: [{ id: 'b1', type: 'paragraph', html: 'merhaba dünya' }],
    ...overrides,
  }
}

function makeVersion(noteId: string, id: string, createdAt: number): NoteVersion {
  return {
    id,
    noteId,
    createdAt,
    title: 'x',
    emoji: '📝',
    tags: [],
    blocks: [],
    words: 0,
    preview: '',
    signature: id,
  }
}

describe('noteHasContent', () => {
  it('başlık veya dolu blok varsa true döndürür', () => {
    expect(noteHasContent(makeNote())).toBe(true)
    expect(noteHasContent(makeNote({ title: '', blocks: [{ id: 'b', type: 'paragraph', html: '' }] }))).toBe(
      false,
    )
    expect(
      noteHasContent(
        makeNote({ title: '', blocks: [{ id: 'b', type: 'table', html: '', rows: [['', '']] }] }),
      ),
    ).toBe(false)
    expect(
      noteHasContent(
        makeNote({ title: '', blocks: [{ id: 'b', type: 'table', html: '', rows: [['', 'x']] }] }),
      ),
    ).toBe(true)
  })
})

describe('noteSignature', () => {
  it('içerik değişince değişir, aynı içerikte sabit kalır', () => {
    const note = makeNote()
    const same = makeNote()
    const changed = makeNote({ blocks: [{ id: 'b1', type: 'paragraph', html: 'başka' }] })

    expect(noteSignature(note)).toBe(noteSignature(same))
    expect(noteSignature(note)).not.toBe(noteSignature(changed))
  })
})

describe('buildNoteVersion', () => {
  it('notun içeriğini ve kelime sayısını taşır', () => {
    const note = makeNote()
    const version = buildNoteVersion(note, 1234)

    expect(version.noteId).toBe('n1')
    expect(version.createdAt).toBe(1234)
    expect(version.title).toBe('Deneme')
    expect(version.tags).toEqual(['fikir'])
    expect(version.words).toBe(2)
    expect(version.preview).toBe('merhaba dünya')
    expect(version.signature).toBe(noteSignature(note))
  })

  it('blokları kopyalar, aynı referansı paylaşmaz', () => {
    const note = makeNote()
    const version = buildNoteVersion(note)
    expect(version.blocks).not.toBe(note.blocks)
    expect(version.blocks[0]).not.toBe(note.blocks[0])
  })
})

describe('versionPreview', () => {
  it('tablo için ilk satırı özetler', () => {
    const note = makeNote({
      title: '',
      blocks: [{ id: 'b', type: 'table', html: '', rows: [['Ürün', 'Fiyat']] }],
    })
    expect(versionPreview(note)).toBe('Ürün · Fiyat')
  })

  it('görsel açıklamasını kullanır', () => {
    const note = makeNote({
      title: '',
      blocks: [{ id: 'b', type: 'image', html: '', src: 'x', caption: 'gün batımı' }],
    })
    expect(versionPreview(note)).toBe('gün batımı')
  })
})

describe('sürüm sınırları', () => {
  it('not başına en yeni sürümleri tutar', () => {
    const versions = [
      makeVersion('n1', 'a', 100),
      makeVersion('n1', 'b', 300),
      makeVersion('n1', 'c', 200),
    ]
    expect(trimNoteVersions(versions, 2).map((version) => version.id)).toEqual(['b', 'c'])
  })

  it('toplam sınırı aşınca en eskileri atar', () => {
    const map = {
      n1: [makeVersion('n1', 'a', 100), makeVersion('n1', 'b', 300)],
      n2: [makeVersion('n2', 'c', 200), makeVersion('n2', 'd', 400)],
    }
    const pruned = pruneVersionMap(map, 2)
    expect(Object.values(pruned).flat().map((version) => version.id).sort()).toEqual(['b', 'd'])
  })
})

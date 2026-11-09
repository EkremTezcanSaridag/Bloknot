import { describe, expect, it } from 'vitest'
import type { Note } from '../types'
import { noteBacklinks, noteIdsInHtml, outgoingNoteLinks } from './noteLinks'

function makeNote(
  id: string,
  title: string,
  blocks: Note['blocks'],
  overrides: Partial<Note> = {},
): Note {
  return {
    id,
    title,
    emoji: '📝',
    tags: [],
    favorite: false,
    createdAt: 1,
    updatedAt: 1,
    blocks,
    ...overrides,
  }
}

function paragraph(id: string, html: string): Note['blocks'][number] {
  return { id, type: 'paragraph', html }
}

const link = (id: string, label = 'İlgili') =>
  `<a href="#/note/${id}" data-note-id="${id}">${label}</a>`

describe('noteIdsInHtml', () => {
  it('not bağlantısı kimliklerini tekrarsız döndürür', () => {
    expect(noteIdsInHtml(`${link('n_abc')} ${link('n_abc')} ${link('n_def')}`)).toEqual([
      'n_abc',
      'n_def',
    ])
  })

  it('geçersiz kimlikleri yok sayar', () => {
    expect(noteIdsInHtml('<a data-note-id="javascript:alert(1)">x</a>')).toEqual([])
  })

  it('not bağlantısı olmayan HTML için boş döndürür', () => {
    expect(noteIdsInHtml('<a href="https://example.com">dış</a> metin')).toEqual([])
  })
})

describe('outgoingNoteLinks', () => {
  it('hedef notun başlığını ve varlığını bildirir', () => {
    const target = makeNote('n_target', 'Hedef not', [])
    const source = makeNote('n_source', 'Kaynak', [
      paragraph('b1', `bak: ${link('n_target')}`),
      paragraph('b2', `yine: ${link('n_target')}`),
    ])

    expect(outgoingNoteLinks(source, [source, target])).toEqual([
      { id: 'n_target', title: 'Hedef not', emoji: '📝', exists: true, trashed: false },
    ])
  })

  it('silinmiş ve bulunamayan hedefleri işaretler', () => {
    const trashed = makeNote('n_trash', 'Eski', [], { trashedAt: 5 })
    const source = makeNote('n_source', 'Kaynak', [
      paragraph('b1', `${link('n_trash')} ${link('n_missing')}`),
    ])

    const links = outgoingNoteLinks(source, [source, trashed])
    expect(links).toHaveLength(2)
    expect(links[0]).toMatchObject({ id: 'n_trash', exists: false, trashed: true })
    expect(links[1]).toMatchObject({ id: 'n_missing', exists: false, trashed: false })
  })
})

describe('noteBacklinks', () => {
  it('bu nota bağlantı veren notları ve bağlantı sayısını döndürür', () => {
    const target = makeNote('n_target', 'Hedef', [])
    const first = makeNote(
      'n_first',
      'Birinci',
      [paragraph('b1', `önce ${link('n_target')} sonra ${link('n_target')}`)],
      { updatedAt: 10 },
    )
    const second = makeNote(
      'n_second',
      'İkinci',
      [paragraph('b1', `tek ${link('n_target')}`)],
      { updatedAt: 20 },
    )

    const backlinks = noteBacklinks('n_target', [target, first, second])
    expect(backlinks.map((item) => item.note.id)).toEqual(['n_second', 'n_first'])
    expect(backlinks[1].count).toBe(2)
    expect(backlinks[1].snippet).toContain('önce')
  })

  it('kendine bağlantıyı ve çöp kutusundaki notları saymaz', () => {
    const target = makeNote('n_target', 'Hedef', [paragraph('b1', link('n_target'))])
    const trashed = makeNote('n_trash', 'Eski', [paragraph('b1', link('n_target'))], {
      trashedAt: 5,
    })

    expect(noteBacklinks('n_target', [target, trashed])).toEqual([])
  })
})

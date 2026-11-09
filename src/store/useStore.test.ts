import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './useStore'
import {
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  DEFAULT_AI_PROVIDER,
} from '../lib/aiConfig'

beforeEach(() => {
  useStore.getState().resetAll()
})

describe('ayarlar', () => {
  it('varsayılan AI sağlayıcısını ortam ayarına göre seçer', () => {
    const settings = useStore.getState().settings
    expect(settings.aiProvider).toBe(DEFAULT_AI_PROVIDER)
    expect(settings.aiBaseUrl).toBe(DEFAULT_AI_BASE_URL)
    expect(settings.aiModel).toBe(DEFAULT_AI_MODEL)
  })
})

describe('not işlemleri', () => {
  it('not oluşturur ve aktif not yapar', () => {
    const id = useStore.getState().createNote({ title: 'Deneme', tags: ['#fikir', 'fikir'] })
    const state = useStore.getState()

    expect(state.notes).toHaveLength(1)
    expect(state.activeNoteId).toBe(id)
    expect(state.notes[0].title).toBe('Deneme')
    expect(state.notes[0].tags).toEqual(['fikir'])
    expect(state.notes[0].blocks[0].type).toBe('paragraph')
  })

  it('blok ekler, günceller ve sıralar', () => {
    const id = useStore.getState().createNote({ title: 'Bloklar' })
    const first = useStore.getState().notes[0].blocks[0]
    const secondId = useStore.getState().addBlock(id, { type: 'heading2', html: 'Başlık' }, first.id)

    let blocks = useStore.getState().notes[0].blocks
    expect(blocks.map((block) => block.type)).toEqual(['paragraph', 'heading2'])

    useStore.getState().updateBlock(id, secondId, { html: 'Yeni <b>başlık</b>' })
    useStore.getState().moveBlock(id, secondId, first.id)

    blocks = useStore.getState().notes[0].blocks
    expect(blocks[0].id).toBe(secondId)
    expect(blocks[0].html).toContain('<b>başlık</b>')
  })

  it('notun tüm bloklarını değiştirir', () => {
    const id = useStore.getState().createNote({ title: 'AI sonucu' })

    useStore.getState().replaceBlocks(id, [
      { type: 'heading1', html: 'Yeni başlık' },
      { type: 'todo', html: 'Yeni görev' },
    ])

    const blocks = useStore.getState().notes[0].blocks
    expect(blocks.map((block) => block.type)).toEqual(['heading1', 'todo'])
    expect(blocks[0].html).toBe('Yeni başlık')
  })

  it('tek bir bloğu birden fazla blokla değiştirir', () => {
    const id = useStore.getState().createNote({ title: 'Çoklu blok' })
    const first = useStore.getState().notes[0].blocks[0]
    const lastId = useStore.getState().addBlock(
      id,
      { type: 'paragraph', html: 'son blok' },
      first.id,
    )

    const inserted = useStore.getState().replaceBlockWithBlocks(id, first.id, [
      { type: 'heading1', html: 'Ana başlık' },
      { type: 'paragraph', html: 'Açıklama' },
    ])

    const blocks = useStore.getState().notes[0].blocks
    expect(inserted).toHaveLength(2)
    expect(blocks.map((block) => block.type)).toEqual([
      'heading1',
      'paragraph',
      'paragraph',
    ])
    expect(blocks[2].id).toBe(lastId)
    expect(blocks[0].html).toBe('Ana başlık')
  })

  it('tablo bloklarını güvenli hücrelere normalize eder', () => {
    const id = useStore.getState().createNote({ title: 'Tablo' })
    const blockId = useStore.getState().addBlock(id, {
      type: 'table',
      rows: [['a'], ['b', 'c']],
    })

    const block = useStore.getState().notes[0].blocks.find((item) => item.id === blockId)
    expect(block?.rows).toEqual([
      ['a', ''],
      ['b', 'c'],
    ])
    expect(block?.headerRow).toBe(true)
  })

  it('yapılacak durumunu değiştirir', () => {
    const id = useStore.getState().createNote({ title: 'Görev' })
    const block = useStore.getState().notes[0].blocks[0]

    useStore.getState().updateBlock(id, block.id, { type: 'todo' })
    useStore.getState().toggleTodo(id, block.id)

    expect(useStore.getState().notes[0].blocks[0].checked).toBe(true)
  })

  it('çöpe taşır ve geri yükler', () => {
    const id = useStore.getState().createNote({ title: 'Silinecek' })
    useStore.getState().trashNote(id)

    expect(useStore.getState().notes[0].trashedAt).toBeTypeOf('number')
    expect(useStore.getState().activeNoteId).toBeNull()

    useStore.getState().restoreNote(id)
    expect(useStore.getState().notes[0].trashedAt).toBeUndefined()
    expect(useStore.getState().activeNoteId).toBe(id)
  })

  it('kalıcı silmede çöpteki notu aktif not olarak bırakmaz', () => {
    const keepId = useStore.getState().createNote({ title: 'Kalan' })
    const trashA = useStore.getState().createNote({ title: 'Çöp A' })
    const trashB = useStore.getState().createNote({ title: 'Çöp B' })

    useStore.getState().trashNote(trashA)
    useStore.getState().trashNote(trashB)
    useStore.getState().setActiveNote(trashB)
    useStore.getState().deleteForever(trashB)

    expect(useStore.getState().activeNoteId).toBe(keepId)
  })

  it('çöp kutusunu boşaltınca aktif notu silinmiş notta bırakmaz', () => {
    const keepId = useStore.getState().createNote({ title: 'Kalan' })
    const trashId = useStore.getState().createNote({ title: 'Çöp' })

    useStore.getState().trashNote(trashId)
    useStore.getState().setActiveNote(trashId)
    useStore.getState().emptyTrash()

    expect(useStore.getState().activeNoteId).toBe(keepId)
    expect(useStore.getState().notes).toHaveLength(1)
  })

  it('kopya oluştururken blok kimliklerini yeniler', () => {
    const id = useStore.getState().createNote({ title: 'Asıl' })
    const sourceBlockId = useStore.getState().notes[0].blocks[0].id
    const copyId = useStore.getState().duplicateNote(id)

    expect(copyId).not.toBeNull()
    const copy = useStore.getState().notes.find((note) => note.id === copyId)
    expect(copy?.title).toBe('Asıl (kopya)')
    expect(copy?.blocks[0].id).not.toBe(sourceBlockId)
  })

  it('etiketi tüm notlarda yeniden adlandırır ve tekrarları temizler', () => {
    const first = useStore.getState().createNote({ title: 'Bir', tags: ['eski', 'yeni'] })
    const second = useStore.getState().createNote({ title: 'İki', tags: ['eski', 'başka'] })

    useStore.getState().renameTag('eski', 'yeni')

    const notes = useStore.getState().notes
    expect(notes.find((note) => note.id === first)?.tags).toEqual(['yeni'])
    expect(notes.find((note) => note.id === second)?.tags).toEqual(['yeni', 'başka'])
  })

  it('etiket filtresi yeniden adlandırmayı izler', () => {
    useStore.getState().createNote({ title: 'Etiketli', tags: ['eski'] })
    useStore.getState().setFilter({ kind: 'tag', tag: 'eski' })

    useStore.getState().renameTag('eski', 'yeni')

    expect(useStore.getState().filter).toEqual({ kind: 'tag', tag: 'yeni' })
  })

  it('etiketi tüm notlardan siler ve filtreyi sıfırlar', () => {
    const id = useStore.getState().createNote({ title: 'Etiketli', tags: ['sil', 'kal'] })
    useStore.getState().setFilter({ kind: 'tag', tag: 'sil' })

    useStore.getState().deleteTag('sil')

    expect(useStore.getState().notes.find((note) => note.id === id)?.tags).toEqual(['kal'])
    expect(useStore.getState().filter).toEqual({ kind: 'all' })
  })

  it('içe aktarmada HTML’i temizler ve kimlik çakışmasını çözer', () => {
    const existing = useStore.getState().createNote({ title: 'Mevcut' })
    const incoming = {
      ...useStore.getState().notes[0],
      title: 'Gelen',
      blocks: [{ id: 'x', type: 'paragraph' as const, html: '<img src=x onerror=alert(1)><b>ok</b>' }],
    }

    const count = useStore.getState().importNotes([incoming], 'merge')

    expect(count).toBe(1)
    const imported = useStore.getState().notes.find((note) => note.title === 'Gelen')
    expect(imported?.id).not.toBe(existing)
    expect(imported?.blocks[0].html).toBe('<b>ok</b>')
  })
})

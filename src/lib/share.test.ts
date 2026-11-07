import LZString from 'lz-string'
import { describe, expect, it, vi } from 'vitest'
import type { Note } from '../types'
import { baseUrlFor, createShortShare, decodeSharedNote, encodeNote } from './share'

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

  it('uzun notun tamamını paylaşır', () => {
    const note = sampleNote()
    const words = Array.from({ length: 4_500 }, (_, index) => `kelime${index}`).join(' ')
    note.blocks = [{ id: 'b1', type: 'paragraph', html: words }]

    const decoded = decodeSharedNote(encodeNote(note).token)

    expect(decoded?.blocks[0].html).toBe(words)
    expect(decoded?.blocks[0].html.split(/\s+/)).toHaveLength(4_500)
  })

  it('çok sayıda bloğu kesmeden paylaşır', () => {
    const note = sampleNote()
    note.blocks = Array.from({ length: 450 }, (_, index) => ({
      id: `b${index}`,
      type: 'paragraph' as const,
      html: `blok ${index}`,
    }))

    const decoded = decodeSharedNote(encodeNote(note).token)

    expect(decoded?.blocks).toHaveLength(450)
    expect(decoded?.blocks[449].html).toBe('blok 449')
  })

  it('paylaşılan HTML’i temizler', () => {
    const note = sampleNote()
    note.blocks[0].html = '<script>alert(1)</script><b>güvenli</b>'

    const decoded = decodeSharedNote(encodeNote(note).token)
    expect(decoded?.blocks[0].html).toBe('<b>güvenli</b>')
  })

  it('metin boyutu ve rengi sınıflarını paylaşımda korur', () => {
    const note = sampleNote()
    note.blocks[0].html = '<span class="bn-text-size-lg bn-text-color-red">renkli</span>'

    const decoded = decodeSharedNote(encodeNote(note).token)
    expect(decoded?.blocks[0].html).toBe(
      '<span class="bn-text-size-lg bn-text-color-red">renkli</span>',
    )
  })

  it('punto ayarını paylaşımda korur', () => {
    const note = sampleNote()
    note.blocks[0].html = '<span class="bn-text-pt" style="--bn-text-pt: 18pt">büyük</span>'

    const decoded = decodeSharedNote(encodeNote(note).token)
    expect(decoded?.blocks[0].html).toBe(
      '<span class="bn-text-pt" style="--bn-text-pt: 18pt">büyük</span>',
    )
  })

  it('paylaşım verisinde blok kimliklerini taşımaz', () => {
    const token = encodeNote(sampleNote()).token
    const raw = LZString.decompressFromEncodedURIComponent(token)

    expect(raw).not.toBeNull()
    expect(raw).not.toContain('"id"')
    expect(raw).not.toContain('"b1"')
  })

  it('tehlikeli kapak bağlantılarını yok sayar', () => {
    const note = sampleNote()
    note.cover = { type: 'image', src: 'javascript:alert(1)' }

    const decoded = decodeSharedNote(encodeNote(note).token)
    expect(decoded?.cover).toBeUndefined()
  })

  it('http görsel adreslerini HTTPS e yükseltir', () => {
    const note = sampleNote()
    note.blocks.push({
      id: 'b3',
      type: 'image',
      html: '',
      src: 'http://example.com/foto.png',
    })
    note.cover = { type: 'image', src: 'http://example.com/kapak.png' }

    const decoded = decodeSharedNote(encodeNote(note).token)
    expect(decoded?.blocks.find((block) => block.type === 'image')?.src).toBe(
      'https://example.com/foto.png',
    )
    expect(decoded?.cover).toEqual({ type: 'image', src: 'https://example.com/kapak.png' })
  })

  it('bozuk token için null döner', () => {
    expect(decodeSharedNote('bozuk-token')).toBeNull()
    expect(decodeSharedNote('')).toBeNull()
  })
})

describe('createShortShare', () => {
  it('is.gd ile kısa bağlantı oluşturur', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ shorturl: 'https://is.gd/abc123' }),
    })

    global.fetch = fetchMock as unknown as typeof fetch

    await expect(createShortShare('token')).resolves.toBe('https://is.gd/abc123')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://is.gd/create.php?format=json&url='),
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('is.gd ve v.gd başarısız olursa da.gd ile kısaltır', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => 'https://da.gd/abc123',
      })

    global.fetch = fetchMock as unknown as typeof fetch

    await expect(createShortShare('token')).resolves.toBe('https://da.gd/abc123')
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('https://da.gd/s?url='),
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('büyük notlarda is.gd/v.gd atlanıp da.gd kullanılır', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'https://da.gd/abc123',
    })

    global.fetch = fetchMock as unknown as typeof fetch

    await expect(createShortShare('a'.repeat(5_000))).resolves.toBe('https://da.gd/abc123')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://da.gd/s?url='),
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('is.gd, v.gd ve da.gd başarısız olursa spoo.me ile kısaltır', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, text: async () => '' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ short_url: 'http://spoo.me/abc123' }),
      })

    global.fetch = fetchMock as unknown as typeof fetch

    await expect(createShortShare('token')).resolves.toBe('https://spoo.me/abc123')
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'https://spoo.me/',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('tüm kısa bağlantı servisleri başarısız olursa Worker dener', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, text: async () => '' })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: 'https://bloknot-groq.ets123main.workers.dev/s/abc123',
        }),
      })

    global.fetch = fetchMock as unknown as typeof fetch

    await expect(createShortShare('token')).resolves.toBe(
      'https://bloknot-groq.ets123main.workers.dev/s/abc123',
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'https://bloknot-groq.ets123main.workers.dev/shorts',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

describe('baseUrlFor', () => {
  it('genel adreslerde paylaşım bağlantısını HTTPS e yükseltir', () => {
    expect(
      baseUrlFor({
        protocol: 'http:',
        host: 'ekremtezcansaridag.github.io',
        pathname: '/Bloknot/',
      }),
    ).toBe('https://ekremtezcansaridag.github.io/Bloknot/')
  })

  it('yerel geliştirme adreslerinde HTTP yi korur', () => {
    expect(baseUrlFor({ protocol: 'http:', host: 'localhost:5173', pathname: '/' })).toBe(
      'http://localhost:5173/',
    )
    expect(baseUrlFor({ protocol: 'http:', host: '127.0.0.1:4173', pathname: '/' })).toBe(
      'http://127.0.0.1:4173/',
    )
  })

  it('index.html ekini temizler', () => {
    expect(baseUrlFor({ protocol: 'https:', host: 'ornek.com', pathname: '/not/index.html' })).toBe(
      'https://ornek.com/not/',
    )
  })
})

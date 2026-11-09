import LZString from 'lz-string'
import type { Block, BlockType, Cover, Note } from '../types'
import { createId } from './id'
import { sanitizeHtml, stripNoteLinks } from './sanitize'
import { normalizeTableRows } from './table'
import { SHARED_GROQ_PROXY_URL } from './aiConfig'

const MAX_TOKEN_LENGTH = 48_000
const MAX_DECOMPRESSED_LENGTH = 4_000_000
const MAX_SHARED_BLOCKS = 5_000
const SHORTENER_ENDPOINTS = [
  'https://is.gd/create.php?format=json&url=',
  'https://v.gd/create.php?format=json&url=',
]
const SHORTENER_TIMEOUT_MS = 6_000
const MAX_GET_SHORTENER_URL_LENGTH = 3_500

const BLOCK_TYPES = new Set<BlockType>([
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'bulleted',
  'numbered',
  'todo',
  'quote',
  'callout',
  'code',
  'divider',
  'image',
  'table',
])

export interface SharedNote {
  title: string
  emoji: string
  cover?: Cover
  blocks: Block[]
  tags: string[]
}

interface SharedNotePayload {
  title: string
  emoji: string
  cover?: Cover
  blocks: Array<Omit<Block, 'id'>>
  tags: string[]
}

export interface ShareLink {
  token: string
  url: string
  length: number
  tooBig: boolean
}

export function encodeNote(note: Note): ShareLink {
  const payload: SharedNotePayload = {
    title: note.title,
    emoji: note.emoji,
    cover: note.cover,
    // Blok kimlikleri alıcı tarafta yeniden üretilir; bağlantıyı kısaltmak
    // için rastgele kimlikleri ve boş alanları paylaşıma koymuyoruz.
    blocks: note.blocks.map(toShareBlock),
    tags: note.tags,
  }

  const token = LZString.compressToEncodedURIComponent(JSON.stringify(payload))
  const base = getBaseUrl()

  return {
    token,
    url: `${base}#/p/${token}`,
    length: token.length,
    tooBig: token.length > MAX_TOKEN_LENGTH,
  }
}

export function decodeSharedNote(token: string): SharedNote | null {
  try {
    if (!token || token.length > MAX_TOKEN_LENGTH * 4) return null
    const raw = LZString.decompressFromEncodedURIComponent(token)
    if (!raw || raw.length > MAX_DECOMPRESSED_LENGTH) return null

    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object') return null

    const record = data as Record<string, unknown>
    const blocks = Array.isArray(record.blocks) ? record.blocks : []

    return {
      title: trimText(record.title, 300) || 'Paylaşılan not',
      emoji: trimText(record.emoji, 8) || '📝',
      cover: parseCover(record.cover),
      tags: Array.isArray(record.tags)
        ? record.tags
            .filter((tag): tag is string => typeof tag === 'string')
            .map((tag) => tag.slice(0, 24))
            .slice(0, 12)
        : [],
      blocks: blocks
        .slice(0, MAX_SHARED_BLOCKS)
        .map((block) => parseBlock(block))
        .filter((block): block is Block => block !== null),
    }
  } catch {
    return null
  }
}

function toShareBlock(block: Block): Omit<Block, 'id'> {
  return {
    type: block.type,
    // Alıcıda bu notların kimlikleri olmadığı için uygulama bağlantıları düz metne iner.
    html: stripNoteLinks(block.html),
    ...(block.checked ? { checked: true } : {}),
    ...(block.language ? { language: block.language } : {}),
    ...(block.src ? { src: block.src } : {}),
    ...(block.caption ? { caption: block.caption } : {}),
    ...(block.emoji ? { emoji: block.emoji } : {}),
    ...(block.type === 'table'
      ? { rows: normalizeTableRows(block.rows), headerRow: block.headerRow !== false }
      : {}),
  }
}

function parseBlock(raw: unknown): Block | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const type = typeof record.type === 'string' && BLOCK_TYPES.has(record.type as BlockType)
    ? (record.type as BlockType)
    : 'paragraph'

  return {
    id: createId('b'),
    type,
    html: stripNoteLinks(sanitizeHtml(trimText(record.html, MAX_DECOMPRESSED_LENGTH))),
    checked: record.checked === true,
    language: typeof record.language === 'string' ? record.language.slice(0, 20) : undefined,
    src: normalizeImageSrc(record.src),
    caption: trimText(record.caption, 240) || undefined,
    emoji: trimText(record.emoji, 8) || undefined,
    ...(type === 'table'
      ? { rows: normalizeTableRows(record.rows), headerRow: record.headerRow !== false }
      : {}),
  }
}

function parseCover(raw: unknown): Cover | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const record = raw as Record<string, unknown>

  if (record.type === 'image') {
    const src = normalizeImageSrc(record.src)
    return src ? { type: 'image', src } : undefined
  }

  if (record.type === 'gradient' && typeof record.id === 'string') {
    return { type: 'gradient', id: record.id.slice(0, 32) }
  }

  return undefined
}

function normalizeImageSrc(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  if (/^data:image\//i.test(value)) return value
  if (/^https?:\/\//i.test(value)) return value.replace(/^http:\/\//i, 'https://')
  return undefined
}

function trimText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

export async function createShortShare(token: string): Promise<string | null> {
  const longUrl = `${getBaseUrl()}#/p/${token}`

  // Önce herkese açık, kalıcı kısa bağlantı servislerini dene.
  // is.gd/v.gd yaklaşık 4 KB'tan uzun URL'leri reddediyor; büyük notlarda
  // doğrudan POST tabanlı servislere geç.
  if (longUrl.length <= MAX_GET_SHORTENER_URL_LENGTH) {
    for (const endpoint of SHORTENER_ENDPOINTS) {
      const shortUrl = await requestShortener(`${endpoint}${encodeURIComponent(longUrl)}`)
      if (shortUrl) return shortUrl
    }
  }

  const daGdUrl = await requestDaGd(longUrl)
  if (daGdUrl) return daGdUrl

  const spooUrl = await requestSpooMe(longUrl)
  if (spooUrl) return spooUrl

  return requestWorkerShortener(token)
}

async function fetchShortener(input: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SHORTENER_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function requestShortener(url: string): Promise<string | null> {
  try {
    const response = await fetchShortener(url, { method: 'GET' })
    if (!response.ok) return null

    const data = (await response.json().catch(() => null)) as { shorturl?: string } | null
    return typeof data?.shorturl === 'string' && data.shorturl ? data.shorturl : null
  } catch {
    return null
  }
}

async function requestDaGd(longUrl: string): Promise<string | null> {
  try {
    const response = await fetchShortener(`https://da.gd/s?url=${encodeURIComponent(longUrl)}`, {
      method: 'GET',
    })
    if (!response.ok) return null

    const shortUrl = (await response.text()).trim()
    return /^https:\/\/da\.gd\/[A-Za-z0-9]+$/.test(shortUrl) ? shortUrl : null
  } catch {
    return null
  }
}

async function requestSpooMe(longUrl: string): Promise<string | null> {
  try {
    const response = await fetchShortener('https://spoo.me/', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ url: longUrl }).toString(),
    })
    if (!response.ok) return null

    const data = (await response.json().catch(() => null)) as { short_url?: string } | null
    if (typeof data?.short_url !== 'string' || !data.short_url) return null
    return data.short_url.replace(/^http:\/\//i, 'https://')
  } catch {
    return null
  }
}

async function requestWorkerShortener(token: string): Promise<string | null> {
  try {
    const response = await fetchShortener(`${SHARED_GROQ_PROXY_URL.replace(/\/+$/, '')}/shorts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (!response.ok) return null

    const data = (await response.json().catch(() => null)) as { url?: string } | null
    return typeof data?.url === 'string' && data.url ? data.url : null
  } catch {
    return null
  }
}

function getBaseUrl(): string {
  if (typeof window === 'undefined') return 'https://bloknot.local/'
  return baseUrlFor(window.location)
}

/** Paylaşım bağlantısının tabanını üretir; genel adreslerde HTTP'yi HTTPS'e yükseltir. */
export function baseUrlFor(location: Pick<Location, 'protocol' | 'host' | 'pathname'>): string {
  const isLocal =
    /^(localhost|127\.0\.0\.1|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)(?::\d+)?$/.test(
      location.host,
    )
  const protocol = location.protocol === 'http:' && !isLocal ? 'https:' : location.protocol
  return `${protocol}//${location.host}${location.pathname}`.replace(/index\.html$/, '')
}

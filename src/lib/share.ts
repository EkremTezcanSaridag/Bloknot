import LZString from 'lz-string'
import type { Block, BlockType, Cover, Note } from '../types'
import { createId } from './id'
import { sanitizeHtml } from './sanitize'

const MAX_TOKEN_LENGTH = 48_000

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
])

export interface SharedNote {
  title: string
  emoji: string
  cover?: Cover
  blocks: Block[]
  tags: string[]
}

export interface ShareLink {
  token: string
  url: string
  length: number
  tooBig: boolean
}

export function encodeNote(note: Note): ShareLink {
  const payload: SharedNote = {
    title: note.title,
    emoji: note.emoji,
    cover: note.cover,
    blocks: note.blocks,
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
    if (!raw) return null

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
        .slice(0, 400)
        .map((block) => parseBlock(block))
        .filter((block): block is Block => block !== null),
    }
  } catch {
    return null
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
    html: sanitizeHtml(trimText(record.html, 20_000)),
    checked: record.checked === true,
    language: typeof record.language === 'string' ? record.language.slice(0, 20) : undefined,
    src: normalizeImageSrc(record.src),
    caption: trimText(record.caption, 240) || undefined,
    emoji: trimText(record.emoji, 8) || undefined,
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

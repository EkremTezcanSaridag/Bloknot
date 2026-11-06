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

  const src = typeof record.src === 'string' ? record.src : undefined
  const safeSrc = src && /^(https?:\/\/|data:image\/)/i.test(src) ? src : undefined

  return {
    id: createId('b'),
    type,
    html: sanitizeHtml(trimText(record.html, 20_000)),
    checked: record.checked === true,
    language: typeof record.language === 'string' ? record.language.slice(0, 20) : undefined,
    src: safeSrc,
    caption: trimText(record.caption, 240) || undefined,
    emoji: trimText(record.emoji, 8) || undefined,
  }
}

function parseCover(raw: unknown): Cover | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const record = raw as Record<string, unknown>

  if (record.type === 'image' && typeof record.src === 'string') {
    if (/^(https?:\/\/|data:image\/)/i.test(record.src)) {
      return { type: 'image', src: record.src }
    }
    return undefined
  }

  if (record.type === 'gradient' && typeof record.id === 'string') {
    return { type: 'gradient', id: record.id.slice(0, 32) }
  }

  return undefined
}

function trimText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function getBaseUrl(): string {
  if (typeof window === 'undefined') return 'https://bloknot.local/'
  return `${window.location.origin}${window.location.pathname}`.replace(/index\.html$/, '')
}

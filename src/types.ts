export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulleted'
  | 'numbered'
  | 'todo'
  | 'quote'
  | 'callout'
  | 'code'
  | 'divider'
  | 'image'
  | 'table'

export interface Block {
  id: string
  type: BlockType
  /** Blok içindeki zengin metin (sanitize edilmiş HTML). */
  html: string
  checked?: boolean
  language?: string
  src?: string
  caption?: string
  emoji?: string
  /** `table` bloklarında hücre metinleri (satır × sütun). */
  rows?: string[][]
  /** İlk satır başlık olarak biçimlendirilsin mi? */
  headerRow?: boolean
}

export type Cover = { type: 'gradient'; id: string } | { type: 'image'; src: string }

export interface Note {
  id: string
  title: string
  emoji: string
  cover?: Cover
  blocks: Block[]
  tags: string[]
  favorite: boolean
  createdAt: number
  updatedAt: number
  trashedAt?: number
}

export type ThemeMode = 'light' | 'dark' | 'system'

export type AccentId = 'lavanta' | 'okyanus' | 'orman' | 'gunbatimi' | 'kiraz'

export type AiProvider =
  | 'groq'
  | 'groq-proxy'
  | 'openrouter'
  | 'xai'
  | 'openai'
  | 'custom'

export interface Settings {
  theme: ThemeMode
  accent: AccentId
  sounds: boolean
  confetti: boolean
  compact: boolean
  lastBackupAt: number | null
  welcomeSeen: boolean
  aiProvider: AiProvider
  aiBaseUrl: string
  aiModel: string
}

export interface Toast {
  id: string
  message: string
  tone: 'default' | 'success' | 'danger'
}

export type DialogName = 'settings' | 'templates' | 'share' | 'ai' | 'slides' | null

export interface Snapshot {
  id: string
  createdAt: number
  notes: Note[]
}

export interface Template {
  id: string
  name: string
  description: string
  emoji: string
  accent: string
  tags: string[]
  blocks: Array<Partial<Block> & { type: BlockType }>
}

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Block, BlockType, Cover, DialogName, Note, Settings, Toast } from '../types'
import { createId } from '../lib/id'
import { newBlock } from '../lib/markdown'
import { sanitizeHtml } from '../lib/sanitize'
import { createSeedNotes } from '../lib/seed'
import { appStorage } from '../lib/storage'
import {
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  DEFAULT_AI_PROVIDER,
} from '../lib/aiConfig'

export type FilterKind = 'all' | 'favorites' | 'trash' | 'tag'

export interface NoteFilter {
  kind: FilterKind
  tag?: string
}

export interface CreateNoteOptions {
  title?: string
  emoji?: string
  cover?: Cover
  tags?: string[]
  blocks?: Array<Partial<Block> & { type: BlockType }>
  activate?: boolean
}

interface Store {
  notes: Note[]
  activeNoteId: string | null
  settings: Settings

  hydrated: boolean
  search: string
  filter: NoteFilter
  sidebarOpen: boolean
  paletteOpen: boolean
  dialog: DialogName
  shareNoteId: string | null
  focusMode: boolean
  toasts: Toast[]
  burst: number

  setHydrated: (value: boolean) => void
  initialize: () => void

  createNote: (options?: CreateNoteOptions) => string
  updateNote: (noteId: string, patch: Partial<Omit<Note, 'id'>>) => void
  setActiveNote: (noteId: string | null) => void
  trashNote: (noteId: string) => void
  restoreNote: (noteId: string) => void
  deleteForever: (noteId: string) => void
  emptyTrash: () => void
  duplicateNote: (noteId: string) => string | null
  toggleFavorite: (noteId: string) => void
  addTag: (noteId: string, tag: string) => void
  removeTag: (noteId: string, tag: string) => void

  addBlock: (noteId: string, block: Partial<Block> & { type: BlockType }, afterId?: string) => string
  insertBlocks: (noteId: string, blocks: Array<Partial<Block> & { type: BlockType }>, afterId?: string) => string[]
  replaceBlocks: (noteId: string, blocks: Array<Partial<Block> & { type: BlockType }>) => string[]
  replaceBlockWithBlocks: (
    noteId: string,
    blockId: string,
    blocks: Array<Partial<Block> & { type: BlockType }>,
  ) => string[]
  updateBlock: (noteId: string, blockId: string, patch: Partial<Block>) => void
  removeBlock: (noteId: string, blockId: string) => void
  moveBlock: (noteId: string, activeId: string, overId: string) => void
  toggleTodo: (noteId: string, blockId: string) => void

  updateSettings: (patch: Partial<Settings>) => void
  markBackupDone: () => void
  importNotes: (notes: Note[], mode: 'merge' | 'replace') => number
  resetAll: () => void

  setSearch: (value: string) => void
  setFilter: (filter: NoteFilter) => void
  setSidebarOpen: (value: boolean) => void
  setPaletteOpen: (value: boolean) => void
  setFocusMode: (value: boolean) => void
  openDialog: (dialog: DialogName) => void
  openShare: (noteId: string) => void
  closeDialog: () => void
  pushToast: (message: string, tone?: Toast['tone']) => void
  dismissToast: (id: string) => void
  celebrate: () => void
}

type PersistedState = Pick<Store, 'notes' | 'activeNoteId' | 'settings'>

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  accent: 'lavanta',
  sounds: true,
  confetti: true,
  compact: false,
  lastBackupAt: null,
  welcomeSeen: false,
  aiProvider: DEFAULT_AI_PROVIDER,
  aiBaseUrl: DEFAULT_AI_BASE_URL,
  aiModel: DEFAULT_AI_MODEL,
}

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

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  const cleaned = tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.replace(/^#/, '').trim().replace(/\s+/g, '-').slice(0, 24))
    .filter(Boolean)
  return Array.from(new Set(cleaned)).slice(0, 20)
}

export function normalizeBlock(raw: Partial<Block> & { type?: BlockType }): Block {
  const type = raw.type && BLOCK_TYPES.has(raw.type) ? raw.type : 'paragraph'
  const block: Block = {
    id: raw.id || createId('b'),
    type,
    html: sanitizeHtml(raw.html ?? ''),
    checked: type === 'todo' ? raw.checked === true : undefined,
  }

  if (type === 'code') block.language = (raw.language ?? 'text').slice(0, 20)
  if (type === 'callout') block.emoji = raw.emoji?.slice(0, 8) || '💡'
  if (type === 'image') {
    block.src = raw.src
    block.caption = raw.caption?.slice(0, 240)
  }

  return block
}

export function normalizeNote(raw: Partial<Note>): Note | null {
  if (!raw || typeof raw !== 'object') return null

  const now = Date.now()
  const blocks = Array.isArray(raw.blocks) && raw.blocks.length
    ? raw.blocks.map((block) => normalizeBlock(block))
    : [newBlock('paragraph')]

  return {
    id: raw.id || createId('n'),
    title: typeof raw.title === 'string' ? raw.title.slice(0, 300) : '',
    emoji: typeof raw.emoji === 'string' && raw.emoji ? raw.emoji.slice(0, 8) : '📝',
    cover: raw.cover,
    blocks,
    tags: normalizeTags(raw.tags),
    favorite: raw.favorite === true,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
    trashedAt: typeof raw.trashedAt === 'number' ? raw.trashedAt : undefined,
  }
}

export const useStore = create<Store>()(
  persist<Store, [], [], PersistedState>(
    (set, get) => ({
      notes: [],
      activeNoteId: null,
      settings: DEFAULT_SETTINGS,

      hydrated: false,
      search: '',
      filter: { kind: 'all' },
      sidebarOpen: false,
      paletteOpen: false,
      dialog: null,
      shareNoteId: null,
      focusMode: false,
      toasts: [],
      burst: 0,

      setHydrated: (value) => set({ hydrated: value }),

      initialize: () => {
        const state = get()

        if (state.notes.length === 0 && !state.settings.welcomeSeen) {
          const seeded = createSeedNotes()
          set({
            notes: seeded,
            activeNoteId: seeded[0]?.id ?? null,
            settings: { ...state.settings, welcomeSeen: true },
          })
          return
        }

        if (state.activeNoteId) {
          const exists = state.notes.some((note) => note.id === state.activeNoteId)
          if (exists) return
        }

        const first = state.notes.find((note) => !note.trashedAt)
        if (first) set({ activeNoteId: first.id })
      },

      createNote: (options = {}) => {
        const now = Date.now()
        const blocks = options.blocks?.length
          ? options.blocks.map((block) => normalizeBlock(block))
          : [newBlock('paragraph')]

        const note: Note = {
          id: createId('n'),
          title: options.title ?? '',
          emoji: options.emoji ?? '📝',
          cover: options.cover,
          blocks,
          tags: normalizeTags(options.tags),
          favorite: false,
          createdAt: now,
          updatedAt: now,
        }

        set((state) => ({
          notes: [note, ...state.notes],
          activeNoteId: note.id,
          search: '',
          filter: { kind: 'all' },
          sidebarOpen: false,
          focusMode: false,
          dialog: null,
        }))

        return note.id
      },

      updateNote: (noteId, patch) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === noteId
              ? {
                  ...note,
                  ...patch,
                  tags: patch.tags ? normalizeTags(patch.tags) : note.tags,
                  updatedAt: Date.now(),
                }
              : note,
          ),
        }))
      },

      setActiveNote: (noteId) => set({ activeNoteId: noteId, sidebarOpen: false, focusMode: false }),

      trashNote: (noteId) => {
        set((state) => {
          const notes = state.notes.map((note) =>
            note.id === noteId ? { ...note, trashedAt: Date.now() } : note,
          )
          const activeNoteId =
            state.activeNoteId === noteId
              ? (notes.find((note) => !note.trashedAt)?.id ?? null)
              : state.activeNoteId

          return { notes, activeNoteId }
        })
      },

      restoreNote: (noteId) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === noteId ? { ...note, trashedAt: undefined } : note,
          ),
          activeNoteId: noteId,
          filter: { kind: 'all' },
        }))
      },

      deleteForever: (noteId) => {
        set((state) => {
          const notes = state.notes.filter((note) => note.id !== noteId)
          const activeStillExists = notes.some(
            (note) => note.id === state.activeNoteId && !note.trashedAt,
          )
          return {
            notes,
            activeNoteId: activeStillExists
              ? state.activeNoteId
              : (notes.find((note) => !note.trashedAt)?.id ?? null),
          }
        })
      },

      emptyTrash: () => {
        set((state) => {
          const notes = state.notes.filter((note) => !note.trashedAt)
          const activeStillExists = notes.some((note) => note.id === state.activeNoteId)
          return {
            notes,
            activeNoteId: activeStillExists
              ? state.activeNoteId
              : (notes[0]?.id ?? null),
          }
        })
      },

      duplicateNote: (noteId) => {
        const source = get().notes.find((note) => note.id === noteId)
        if (!source) return null

        const now = Date.now()
        const copy: Note = {
          ...source,
          id: createId('n'),
          title: `${source.title || 'Başlıksız'} (kopya)`,
          favorite: false,
          trashedAt: undefined,
          createdAt: now,
          updatedAt: now,
          blocks: source.blocks.map((block) => ({ ...block, id: createId('b') })),
        }

        set((state) => ({
          notes: [copy, ...state.notes],
          activeNoteId: copy.id,
        }))

        return copy.id
      },

      toggleFavorite: (noteId) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === noteId ? { ...note, favorite: !note.favorite } : note,
          ),
        }))
      },

      addTag: (noteId, tag) => {
        const [cleaned] = normalizeTags([tag])
        if (!cleaned) return
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === noteId && !note.tags.includes(cleaned)
              ? { ...note, tags: [...note.tags, cleaned] }
              : note,
          ),
        }))
      },

      removeTag: (noteId, tag) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === noteId
              ? { ...note, tags: note.tags.filter((item) => item !== tag) }
              : note,
          ),
        }))
      },

      addBlock: (noteId, block, afterId) => {
        const created = normalizeBlock(block)

        set((state) => ({
          notes: state.notes.map((note) => {
            if (note.id !== noteId) return note
            const blocks = [...note.blocks]
            const index = afterId ? blocks.findIndex((item) => item.id === afterId) : -1
            blocks.splice(index >= 0 ? index + 1 : blocks.length, 0, created)
            return { ...note, blocks, updatedAt: Date.now() }
          }),
        }))

        return created.id
      },

      insertBlocks: (noteId, blocks, afterId) => {
        const created = blocks.map((block) => normalizeBlock(block))

        set((state) => ({
          notes: state.notes.map((note) => {
            if (note.id !== noteId) return note
            const next = [...note.blocks]
            const index = afterId ? next.findIndex((item) => item.id === afterId) : -1
            next.splice(index >= 0 ? index + 1 : next.length, 0, ...created)
            return { ...note, blocks: next, updatedAt: Date.now() }
          }),
        }))

        return created.map((block) => block.id)
      },

      replaceBlocks: (noteId, blocks) => {
        const created = blocks.length
          ? blocks.map((block) => normalizeBlock(block))
          : [newBlock('paragraph')]

        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === noteId
              ? { ...note, blocks: created, updatedAt: Date.now() }
              : note,
          ),
        }))

        return created.map((block) => block.id)
      },

      replaceBlockWithBlocks: (noteId, blockId, blocks) => {
        const created = blocks.length
          ? blocks.map((block) => normalizeBlock(block))
          : [newBlock('paragraph')]

        set((state) => ({
          notes: state.notes.map((note) => {
            if (note.id !== noteId) return note
            const index = note.blocks.findIndex((block) => block.id === blockId)
            if (index < 0) return note

            const next = [...note.blocks]
            next.splice(index, 1, ...created)
            return { ...note, blocks: next, updatedAt: Date.now() }
          }),
        }))

        return created.map((block) => block.id)
      },

      updateBlock: (noteId, blockId, patch) => {
        set((state) => ({
          notes: state.notes.map((note) => {
            if (note.id !== noteId) return note
            return {
              ...note,
              blocks: note.blocks.map((block) =>
                block.id === blockId
                  ? {
                      ...block,
                      ...patch,
                      html: patch.html === undefined ? block.html : sanitizeHtml(patch.html),
                    }
                  : block,
              ),
              updatedAt: Date.now(),
            }
          }),
        }))
      },

      removeBlock: (noteId, blockId) => {
        set((state) => ({
          notes: state.notes.map((note) => {
            if (note.id !== noteId) return note
            const blocks = note.blocks.filter((block) => block.id !== blockId)
            return {
              ...note,
              blocks: blocks.length ? blocks : [newBlock('paragraph')],
              updatedAt: Date.now(),
            }
          }),
        }))
      },

      moveBlock: (noteId, activeId, overId) => {
        if (activeId === overId) return

        set((state) => ({
          notes: state.notes.map((note) => {
            if (note.id !== noteId) return note
            const from = note.blocks.findIndex((block) => block.id === activeId)
            const to = note.blocks.findIndex((block) => block.id === overId)
            if (from < 0 || to < 0) return note

            const blocks = [...note.blocks]
            const [moved] = blocks.splice(from, 1)
            blocks.splice(to, 0, moved)
            return { ...note, blocks, updatedAt: Date.now() }
          }),
        }))
      },

      toggleTodo: (noteId, blockId) => {
        set((state) => ({
          notes: state.notes.map((note) => {
            if (note.id !== noteId) return note
            return {
              ...note,
              blocks: note.blocks.map((block) =>
                block.id === blockId ? { ...block, checked: !block.checked } : block,
              ),
              updatedAt: Date.now(),
            }
          }),
        }))
      },

      updateSettings: (patch) => {
        set((state) => ({ settings: { ...state.settings, ...patch } }))
      },

      markBackupDone: () => {
        set((state) => ({ settings: { ...state.settings, lastBackupAt: Date.now() } }))
      },

      importNotes: (incoming, mode) => {
        const existingIds = new Set(get().notes.map((note) => note.id))
        const normalized = incoming
          .map((note) => normalizeNote(note))
          .filter((note): note is Note => note !== null)
          .map((note) => {
            if (mode === 'merge' && existingIds.has(note.id)) {
              return {
                ...note,
                id: createId('n'),
                blocks: note.blocks.map((block) => ({ ...block, id: createId('b') })),
              }
            }
            return note
          })

        if (!normalized.length) return 0

        set((state) => ({
          notes: mode === 'replace' ? normalized : [...normalized, ...state.notes],
          activeNoteId: normalized[0].id,
          filter: { kind: 'all' },
          search: '',
        }))

        return normalized.length
      },

      resetAll: () => {
        set({
          notes: [],
          activeNoteId: null,
          settings: { ...DEFAULT_SETTINGS, welcomeSeen: true },
          search: '',
          filter: { kind: 'all' },
          dialog: null,
        })
      },

      setSearch: (value) => set({ search: value }),
      setFilter: (filter) => set({ filter, sidebarOpen: false }),
      setSidebarOpen: (value) => set({ sidebarOpen: value }),
      setPaletteOpen: (value) => set({ paletteOpen: value }),
      setFocusMode: (value) => set({ focusMode: value }),

      openDialog: (dialog) => set({ dialog }),
      openShare: (noteId) => set({ shareNoteId: noteId, dialog: 'share' }),
      closeDialog: () => set({ dialog: null, shareNoteId: null }),

      pushToast: (message, tone = 'default') => {
        const id = createId('t')
        set((state) => ({ toasts: [...state.toasts.slice(-2), { id, message, tone }] }))
        setTimeout(() => {
          set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
        }, 3400)
      },

      dismissToast: (id) => {
        set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
      },

      celebrate: () => set((state) => ({ burst: state.burst + 1 })),
    }),
    {
      name: 'bloknot-store-v1',
      version: 1,
      storage: createJSONStorage(() => appStorage),
      partialize: (state): PersistedState => ({
        notes: state.notes,
        activeNoteId: state.activeNoteId,
        settings: state.settings,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PersistedState>
        return {
          ...current,
          ...saved,
          settings: { ...current.settings, ...(saved.settings ?? {}) },
        }
      },
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    },
  ),
)

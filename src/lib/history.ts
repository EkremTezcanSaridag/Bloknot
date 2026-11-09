import type { Note, NoteVersion } from '../types'
import { createId } from './id'
import { htmlToText } from './sanitize'
import { noteWordCount } from './stats'
import { idbGet, idbSet } from './storage'

const HISTORY_KEY = 'bloknot:note-history'
const MAX_PER_NOTE = 30
const MAX_TOTAL_VERSIONS = 400
/** Aynı not için iki sürüm arasındaki en kısa süre. */
const MIN_INTERVAL = 60_000
/** Görseller dahil çok büyük notlar sürüm geçmişine alınmaz. */
const MAX_VERSION_BYTES = 350_000

type HistoryMap = Record<string, NoteVersion[]>

/** Tüm geçmiş işlemlerini sıraya sokar; eşzamanlı yazmalar birbirini ezmesin. */
let queue: Promise<unknown> = Promise.resolve()

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}

async function readHistory(): Promise<HistoryMap> {
  const stored = await idbGet<HistoryMap>(HISTORY_KEY)
  return stored && typeof stored === 'object' ? stored : {}
}

/** İçerikteki değişimi yakalamak için kısa ve kararlı bir parmak izi. */
export function noteSignature(note: Pick<Note, 'title' | 'emoji' | 'tags' | 'blocks'>): string {
  const content = JSON.stringify({
    title: note.title,
    emoji: note.emoji,
    tags: note.tags,
    blocks: note.blocks,
  })

  let hash = 2166136261
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function noteHasContent(note: Note): boolean {
  if (note.title.trim()) return true

  return note.blocks.some((block) => {
    if (block.type === 'image') return Boolean(block.src)
    if (block.type === 'divider') return false
    if (block.type === 'table') {
      return (block.rows ?? []).some((row) => row.some((cell) => cell.trim().length > 0))
    }
    return htmlToText(block.html).trim().length > 0
  })
}

/** Sürüm listesinde gösterilecek kısa içerik özeti. */
export function versionPreview(note: Note): string {
  for (const block of note.blocks) {
    if (block.type === 'image' && block.caption?.trim()) return block.caption.trim().slice(0, 140)
    if (block.type === 'table') {
      const firstRow = (block.rows ?? [])[0]
      if (firstRow) {
        const cells = firstRow.map((cell) => cell.trim()).filter(Boolean)
        if (cells.length) return cells.join(' · ').slice(0, 140)
      }
      continue
    }
    if (block.type === 'divider') continue
    const text = htmlToText(block.html).replace(/\s+/g, ' ').trim()
    if (text) return text.slice(0, 140)
  }

  return note.title.trim().slice(0, 140)
}

export function buildNoteVersion(note: Note, now = Date.now()): NoteVersion {
  return {
    id: createId('v'),
    noteId: note.id,
    createdAt: now,
    title: note.title,
    emoji: note.emoji,
    tags: [...note.tags],
    blocks: note.blocks.map((block) => ({ ...block })),
    words: noteWordCount(note),
    preview: versionPreview(note),
    signature: noteSignature(note),
  }
}

/** Not başına sürüm sınırını uygular. */
export function trimNoteVersions(versions: NoteVersion[], max = MAX_PER_NOTE): NoteVersion[] {
  return [...versions].sort((a, b) => b.createdAt - a.createdAt).slice(0, max)
}

/** Toplam sürüm sayısını sınırlar; en eski sürümler atılır. */
export function pruneVersionMap(map: HistoryMap, max = MAX_TOTAL_VERSIONS): HistoryMap {
  const flat = Object.values(map)
    .flat()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, max)

  const next: HistoryMap = {}
  for (const version of flat) {
    next[version.noteId] = [...(next[version.noteId] ?? []), version]
  }
  return next
}

export async function listNoteVersions(noteId: string): Promise<NoteVersion[]> {
  return enqueue(async () => {
    const map = await readHistory()
    return [...(map[noteId] ?? [])].sort((a, b) => b.createdAt - a.createdAt)
  })
}

export async function getNoteVersion(noteId: string, versionId: string): Promise<NoteVersion | null> {
  return enqueue(async () => {
    const map = await readHistory()
    return (map[noteId] ?? []).find((version) => version.id === versionId) ?? null
  })
}

/**
 * Notun o anki hâlini geçmişe kaydeder.
 * İçerik değişmediyse veya son sürüm çok yeniyse (force değilse) atlanır.
 */
export async function saveNoteVersion(note: Note, options: { force?: boolean } = {}): Promise<boolean> {
  if (note.trashedAt || !noteHasContent(note)) return false

  const signature = noteSignature(note)

  return enqueue(async () => {
    const map = await readHistory()
    const versions = map[note.id] ?? []
    const last = versions[0]
    const now = Date.now()

    if (last?.signature === signature) return false
    if (!options.force && last && now - last.createdAt < MIN_INTERVAL) return false

    const version = buildNoteVersion(note, now)
    if (JSON.stringify(version).length > MAX_VERSION_BYTES) return false

    const nextMap = pruneVersionMap({
      ...map,
      [note.id]: trimNoteVersions([version, ...versions]),
    })

    await idbSet(HISTORY_KEY, nextMap)
    return true
  })
}

export async function deleteNoteVersion(noteId: string, versionId: string): Promise<void> {
  await enqueue(async () => {
    const map = await readHistory()
    const versions = (map[noteId] ?? []).filter((version) => version.id !== versionId)
    const next = { ...map }
    if (versions.length) next[noteId] = versions
    else delete next[noteId]
    await idbSet(HISTORY_KEY, next)
  })
}

export async function clearNoteHistory(noteId: string): Promise<void> {
  await enqueue(async () => {
    const map = await readHistory()
    if (!(noteId in map)) return
    const next = { ...map }
    delete next[noteId]
    await idbSet(HISTORY_KEY, next)
  })
}

export async function clearAllNoteHistory(): Promise<void> {
  await enqueue(() => idbSet(HISTORY_KEY, {}))
}

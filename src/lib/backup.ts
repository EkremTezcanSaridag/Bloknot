import type { Note, Snapshot } from '../types'
import { createId } from './id'
import { idbGet, idbSet } from './storage'

const SNAPSHOTS_KEY = 'bloknot:snapshots'
const MAX_SNAPSHOTS = 5
const MIN_INTERVAL = 10 * 60_000

let lastSnapshotAt = 0
let lastDigest = ''

export interface BackupFile {
  app: 'bloknot'
  version: 1
  exportedAt: number
  notes: Note[]
}

export function exportBackup(notes: Note[]): string {
  const data: BackupFile = {
    app: 'bloknot',
    version: 1,
    exportedAt: Date.now(),
    notes,
  }
  return JSON.stringify(data, null, 2)
}

export function parseBackup(text: string): Note[] {
  const data = JSON.parse(text) as unknown

  if (Array.isArray(data)) return data as Note[]

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (Array.isArray(record.notes)) return record.notes as Note[]
  }

  throw new Error('Bu dosya bir Bloknot yedeği gibi görünmüyor.')
}

export async function listSnapshots(): Promise<Snapshot[]> {
  const snapshots = await idbGet<Snapshot[]>(SNAPSHOTS_KEY)
  return Array.isArray(snapshots) ? snapshots : []
}

export async function maybeSaveSnapshot(notes: Note[]): Promise<void> {
  if (!notes.length) return

  const now = Date.now()
  if (now - lastSnapshotAt < MIN_INTERVAL) return

  const digest = `${notes.length}:${notes.map((note) => `${note.id}:${note.updatedAt}`).join('|')}`
  if (digest === lastDigest) return

  lastSnapshotAt = now
  lastDigest = digest

  const existing = await listSnapshots()
  const snapshot: Snapshot = {
    id: createId('s'),
    createdAt: now,
    notes,
  }

  await idbSet(SNAPSHOTS_KEY, [snapshot, ...existing].slice(0, MAX_SNAPSHOTS))
}

export async function deleteSnapshot(id: string): Promise<void> {
  const existing = await listSnapshots()
  await idbSet(
    SNAPSHOTS_KEY,
    existing.filter((snapshot) => snapshot.id !== id),
  )
}

export async function clearSnapshots(): Promise<void> {
  await idbSet(SNAPSHOTS_KEY, [])
}

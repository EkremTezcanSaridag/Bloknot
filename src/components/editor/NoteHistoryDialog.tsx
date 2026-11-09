import { useEffect, useState } from 'react'
import { Clock, RotateCcw, Save, Trash2 } from 'lucide-react'
import type { Note, NoteVersion } from '../../types'
import { useStore } from '../../store/useStore'
import { fullDate, relativeTime } from '../../lib/date'
import { deleteNoteVersion, listNoteVersions, saveNoteVersion } from '../../lib/history'
import { htmlToText } from '../../lib/sanitize'
import { Modal } from '../Modal'

interface NoteHistoryDialogProps {
  open: boolean
  note: Note
  onClose: () => void
}

function versionBlocks(version: NoteVersion): string[] {
  return version.blocks
    .map((block) => {
      if (block.type === 'table') {
        return (block.rows ?? []).map((row) => row.join(' | ')).join(' · ')
      }
      if (block.type === 'image') return block.caption ?? ''
      return htmlToText(block.html)
    })
    .map((text) => text.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 6)
}

export function NoteHistoryDialog({ open, note, onClose }: NoteHistoryDialogProps) {
  const updateNote = useStore((state) => state.updateNote)
  const pushToast = useStore((state) => state.pushToast)

  const [versions, setVersions] = useState<NoteVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setConfirmId(null)
    setExpandedId(null)

    void listNoteVersions(note.id).then((list) => {
      if (cancelled) return
      setVersions(list)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [open, note.id])

  const refresh = async () => {
    setVersions(await listNoteVersions(note.id))
  }

  const saveNow = async () => {
    setBusy(true)
    const saved = await saveNoteVersion(note, { force: true })
    await refresh()
    setBusy(false)
    pushToast(
      saved ? 'Notun şimdiki hâli kaydedildi.' : 'İçerik değişmediği için yeni sürüm oluşmadı.',
      saved ? 'success' : 'default',
    )
  }

  const restore = async (version: NoteVersion) => {
    setBusy(true)
    // Geri yüklemeden önce mevcut hâli de sakla; böylece işlem geri alınabilir olsun.
    await saveNoteVersion(note, { force: true })
    updateNote(note.id, {
      title: version.title,
      emoji: version.emoji,
      tags: version.tags,
      blocks: version.blocks.map((block) => ({ ...block })),
    })
    setBusy(false)
    setConfirmId(null)
    pushToast('Sürüm geri yüklendi.', 'success')
    onClose()
  }

  const remove = async (versionId: string) => {
    setBusy(true)
    await deleteNoteVersion(note.id, versionId)
    await refresh()
    setBusy(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sürüm geçmişi"
      subtitle={`${note.title || 'Başlıksız not'} · yalnızca bu cihazda saklanır`}
      size="md"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.68rem] font-semibold text-[var(--text-faint)]">
            Son {versions.length} sürüm tutulur; en eski sürümler otomatik silinir.
          </p>
          <button
            type="button"
            onClick={() => void saveNow()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:opacity-50"
          >
            <Save className="size-3.5" />
            Şimdiki hâli kaydet
          </button>
        </div>
      }
    >
      {loading ? (
        <p className="py-10 text-center text-sm font-semibold text-[var(--text-faint)]">Sürümler yükleniyor…</p>
      ) : versions.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-3xl">🕰️</p>
          <p className="mt-3 text-sm font-extrabold">Henüz sürüm yok.</p>
          <p className="mx-auto mt-1 max-w-sm text-xs font-semibold text-[var(--text-faint)]">
            Notu düzenledikçe burada otomatik sürümler oluşur. İstersen yukarıdaki düğmeyle şimdiki hâli
            hemen kaydedebilirsin.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {versions.map((version) => {
            const confirming = confirmId === version.id
            const expanded = expandedId === version.id
            const blocks = expanded ? versionBlocks(version) : []

            return (
              <li
                key={version.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 p-3"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Clock className="size-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <p className="text-sm font-extrabold">{relativeTime(version.createdAt)}</p>
                      <p className="text-[0.65rem] font-semibold text-[var(--text-faint)]">
                        {fullDate(version.createdAt)} · {version.words} kelime
                      </p>
                    </div>

                    <p className="mt-1 line-clamp-2 text-xs font-medium text-[var(--text-soft)]">
                      {version.preview || 'Boş not'}
                    </p>

                    {expanded && (
                      <div className="mt-2 space-y-1 rounded-lg bg-[var(--surface-2)] p-2.5 text-[0.7rem] font-medium text-[var(--text-soft)]">
                        {blocks.length ? (
                          blocks.map((text, index) => (
                            <p key={index} className="truncate">
                              {text}
                            </p>
                          ))
                        ) : (
                          <p>Gösterilecek metin yok.</p>
                        )}
                      </div>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {confirming ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void restore(version)}
                            disabled={busy}
                            className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)] px-2 py-1 text-[0.65rem] font-bold text-[var(--accent-ink)] disabled:opacity-50"
                          >
                            <RotateCcw className="size-3" />
                            Eminim, geri yükle
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            className="rounded-md px-2 py-1 text-[0.65rem] font-bold text-[var(--text-faint)] hover:text-[var(--text)]"
                          >
                            Vazgeç
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmId(version.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-[var(--surface)] px-2 py-1 text-[0.65rem] font-bold text-[var(--text-soft)] transition hover:text-[var(--accent)]"
                        >
                          <RotateCcw className="size-3" />
                          Geri yükle
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : version.id)}
                        className="rounded-md px-2 py-1 text-[0.65rem] font-bold text-[var(--text-faint)] transition hover:text-[var(--text)]"
                      >
                        {expanded ? 'Önizlemeyi kapat' : 'Önizle'}
                      </button>

                      <button
                        type="button"
                        onClick={() => void remove(version.id)}
                        disabled={busy}
                        className="ml-auto grid size-6 place-items-center rounded-md text-[var(--text-faint)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:opacity-50"
                        aria-label="Sürümü sil"
                        title="Sürümü sil"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}

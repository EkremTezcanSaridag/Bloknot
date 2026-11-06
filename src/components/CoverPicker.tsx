import { useRef, useState } from 'react'
import { Check, ImagePlus, Link2, Trash2, Upload } from 'lucide-react'
import type { Cover } from '../types'
import { COVER_GRADIENTS, coverStyle } from '../lib/covers'
import { imageFileToDataUrl } from '../lib/media'
import { Modal } from './Modal'

interface CoverPickerProps {
  open: boolean
  current?: Cover
  onClose: () => void
  onSelect: (cover: Cover | undefined) => void
}

export function CoverPicker({ open, current, onClose, onSelect }: CoverPickerProps) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const apply = (cover: Cover | undefined) => {
    onSelect(cover)
    onClose()
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const src = await imageFileToDataUrl(file)
      apply({ type: 'image', src })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Görsel yüklenemedi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Kapak seç"
      subtitle="Notunun üstüne renk, desen veya kendi görselini koy."
      size="md"
    >
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {COVER_GRADIENTS.map((gradient) => {
          const selected = current?.type === 'gradient' && current.id === gradient.id
          return (
            <button
              key={gradient.id}
              type="button"
              onClick={() => apply({ type: 'gradient', id: gradient.id })}
              className="group relative h-16 overflow-hidden rounded-xl border border-black/5 shadow-sm transition hover:scale-[1.02]"
              style={{ background: gradient.css }}
              aria-label={gradient.name}
              title={gradient.name}
            >
              {selected && (
                <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-white/90 text-[#3b2a6b]">
                  <Check className="size-3" />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-5 space-y-3 border-t border-[var(--border)] pt-5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-3.5 py-2 text-sm font-bold text-[var(--accent-ink)] transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
          >
            <Upload className="size-4" />
            {busy ? 'Yükleniyor…' : 'Görsel yükle'}
          </button>
          <button
            type="button"
            onClick={() => apply(undefined)}
            className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
          >
            <Trash2 className="size-4" />
            Kapağı kaldır
          </button>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            void handleFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />

        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://... görsel bağlantısı"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[var(--accent)]"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              const trimmed = url.trim()
              if (!/^https?:\/\//i.test(trimmed)) {
                setError('Bağlantı http:// veya https:// ile başlamalı.')
                return
              }
              apply({ type: 'image', src: trimmed })
            }}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-bold transition hover:bg-[var(--surface-2)]"
          >
            <ImagePlus className="size-4" />
            Uygula
          </button>
        </div>

        {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}

        {current && (
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            <div className="h-24 w-full" style={{ background: coverStyle(current) }} />
            <p className="px-3 py-2 text-xs font-semibold text-[var(--text-faint)]">Geçerli kapak</p>
          </div>
        )}
      </div>
    </Modal>
  )
}

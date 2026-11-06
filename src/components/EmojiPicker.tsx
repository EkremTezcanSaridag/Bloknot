import { Dices, Trash2 } from 'lucide-react'
import { EMOJI_CHOICES } from '../lib/covers'
import { Modal } from './Modal'

interface EmojiPickerProps {
  open: boolean
  current?: string
  onClose: () => void
  onSelect: (emoji: string | null) => void
}

export function EmojiPicker({ open, current, onClose, onSelect }: EmojiPickerProps) {
  return (
    <Modal open={open} onClose={onClose} title="Simge seç" subtitle="Notuna bir karakter ver." size="sm">
      <div className="grid grid-cols-8 gap-1.5">
        {EMOJI_CHOICES.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onSelect(emoji)
              onClose()
            }}
            className={`grid aspect-square place-items-center rounded-xl text-2xl transition hover:scale-110 hover:bg-[var(--accent-soft)] ${
              current === emoji ? 'bg-[var(--accent-soft)] ring-2 ring-[var(--accent)]' : ''
            }`}
            aria-label={`Simge ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
        <button
          type="button"
          onClick={() => {
            const random = EMOJI_CHOICES[Math.floor(Math.random() * EMOJI_CHOICES.length)]
            onSelect(random)
            onClose()
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm font-bold transition hover:bg-[var(--accent-soft)]"
        >
          <Dices className="size-4" />
          Rastgele
        </button>
        <button
          type="button"
          onClick={() => {
            onSelect(null)
            onClose()
          }}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
        >
          <Trash2 className="size-4" />
          Simgeyi kaldır
        </button>
      </div>
    </Modal>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Lightbulb,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Search,
  Table,
  type LucideIcon,
} from 'lucide-react'
import type { BlockType } from '../../types'

interface BlockOption {
  type: BlockType
  label: string
  hint: string
  icon: LucideIcon
  keywords: string
}

const OPTIONS: BlockOption[] = [
  { type: 'paragraph', label: 'Metin', hint: 'Düz yazı', icon: Pilcrow, keywords: 'metin paragraf yazı' },
  { type: 'heading1', label: 'Büyük başlık', hint: 'Bölüm başlığı', icon: Heading1, keywords: 'başlık h1 büyük' },
  { type: 'heading2', label: 'Orta başlık', hint: 'Alt başlık', icon: Heading2, keywords: 'başlık h2 orta' },
  { type: 'heading3', label: 'Küçük başlık', hint: 'Alt başlık', icon: Heading3, keywords: 'başlık h3 küçük' },
  { type: 'bulleted', label: 'Madde listesi', hint: 'Sırasız liste', icon: List, keywords: 'liste madde bullet' },
  { type: 'numbered', label: 'Numaralı liste', hint: 'Sıralı liste', icon: ListOrdered, keywords: 'liste numara sıralı' },
  { type: 'todo', label: 'Yapılacak', hint: 'İşaretlenebilir görev', icon: ListChecks, keywords: 'görev todo yapılacak kontrol' },
  { type: 'quote', label: 'Alıntı', hint: 'Vurgulu söz', icon: Quote, keywords: 'alıntı quote söz' },
  { type: 'callout', label: 'Not kutusu', hint: 'Emoji destekli kutu', icon: Lightbulb, keywords: 'callout not kutu uyarı' },
  { type: 'code', label: 'Kod', hint: 'Kod bloğu', icon: Code2, keywords: 'kod code program' },
  { type: 'divider', label: 'Ayırıcı', hint: 'Yatay çizgi', icon: Minus, keywords: 'çizgi ayırıcı divider' },
  { type: 'image', label: 'Görsel', hint: 'Resim veya ekran görüntüsü', icon: ImageIcon, keywords: 'görsel resim fotoğraf image' },
  { type: 'table', label: 'Tablo', hint: 'Satır ve sütunlu çizelge', icon: Table, keywords: 'tablo çizelge table satır sütun' },
]

interface BlockTypeMenuProps {
  open: boolean
  mode: 'convert' | 'insert'
  onClose: () => void
  onSelect: (type: BlockType) => void
}

export function BlockTypeMenu({ open, mode, onClose, onSelect }: BlockTypeMenuProps) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => window.clearTimeout(timer)
  }, [open])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr')
    if (!needle) return OPTIONS
    return OPTIONS.filter((option) =>
      `${option.label} ${option.hint} ${option.keywords}`.toLocaleLowerCase('tr').includes(needle),
    )
  }, [query])

  useEffect(() => {
    setActive(0)
  }, [query])

  if (!open) return null

  const choose = (type: BlockType) => {
    onSelect(type)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} aria-hidden="true" />
      <div className="animate-pop absolute left-0 top-full z-50 mt-1 w-[min(20rem,calc(100vw-3rem))] origin-top-left overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
          <Search className="size-4 shrink-0 text-[var(--text-faint)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
              } else if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((value) => Math.min(value + 1, filtered.length - 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((value) => Math.max(value - 1, 0))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                const option = filtered[active]
                if (option) choose(option.type)
              }
            }}
            placeholder={mode === 'insert' ? 'Blok ekle…' : 'Blok türüne çevir…'}
            className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[var(--text-faint)]"
            aria-label="Blok türü ara"
          />
        </div>

        <div className="max-h-[19rem] overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-[var(--text-faint)]">Eşleşen blok yok.</p>
          )}

          {filtered.map((option, index) => {
            const Icon = option.icon
            return (
              <button
                key={option.type}
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option.type)}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${
                  index === active ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--surface-2)]'
                }`}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)]">
                  <Icon className="size-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{option.label}</span>
                  <span className="block truncate text-xs text-[var(--text-faint)]">{option.hint}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-1.5 text-[0.68rem] font-semibold text-[var(--text-faint)]">
          <span>↑ ↓ gez • Enter seç</span>
          <span className="kbd">esc</span>
        </div>
      </div>
    </>
  )
}

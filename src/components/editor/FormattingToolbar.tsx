import { useEffect, useRef, useState } from 'react'
import {
  Ban,
  Bold,
  Code,
  Italic,
  Link2,
  Palette,
  Strikethrough,
  Type,
  Underline,
} from 'lucide-react'
import { escapeHtml } from '../../lib/sanitize'
import {
  TEXT_COLOR_CLASS_PREFIX,
  TEXT_COLOR_OPTIONS,
  TEXT_SIZE_CLASS_PREFIX,
  TEXT_SIZE_OPTIONS,
} from '../../lib/textStyles'

interface Position {
  top: number
  left: number
}

type Menu = 'size' | 'color' | null

export function FormattingToolbar() {
  const [position, setPosition] = useState<Position | null>(null)
  const [menu, setMenu] = useState<Menu>(null)
  const savedRange = useRef<Range | null>(null)
  const interacting = useRef(false)
  const interactionTimer = useRef<number | null>(null)

  const markInteracting = () => {
    interacting.current = true
    if (interactionTimer.current) window.clearTimeout(interactionTimer.current)
    interactionTimer.current = window.setTimeout(() => {
      interacting.current = false
    }, 500)
  }

  useEffect(() => {
    const update = () => {
      // Toolbar düğmesine dokunurken seçim geçici olarak kaybolabilir.
      // Bu kısa sürede toolbar'ı kapatma; kaydedilmiş aralığı kullan.
      if (interacting.current) return

      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || !selection.rangeCount) {
        savedRange.current = null
        setPosition(null)
        return
      }

      const range = selection.getRangeAt(0)
      const element = elementForRange(range)
      const editable = element?.closest('.editable')
      if (!editable) {
        savedRange.current = null
        setPosition(null)
        return
      }

      const rect = range.getBoundingClientRect()
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        savedRange.current = null
        setPosition(null)
        return
      }

      savedRange.current = range.cloneRange()
      const margin = Math.min(150, window.innerWidth / 2)
      const left = Math.min(
        Math.max(rect.left + rect.width / 2, margin),
        window.innerWidth - margin,
      )
      setPosition({ top: Math.max(8, rect.top - 50), left })
    }

    document.addEventListener('selectionchange', update)
    window.addEventListener('resize', update)
    document.addEventListener('scroll', update, true)

    return () => {
      document.removeEventListener('selectionchange', update)
      window.removeEventListener('resize', update)
      document.removeEventListener('scroll', update, true)
      if (interactionTimer.current) window.clearTimeout(interactionTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!position) setMenu(null)
  }, [position])

  if (!position) return null

  const restoreSelection = (): Selection | null => {
    const selection = window.getSelection()
    if (!selection) return null

    if ((selection.isCollapsed || !selection.rangeCount) && savedRange.current) {
      selection.removeAllRanges()
      selection.addRange(savedRange.current)
    }

    if (selection.isCollapsed || !selection.rangeCount) return null
    return selection
  }

  const rememberSelection = (selection: Selection) => {
    if (selection.rangeCount) {
      savedRange.current = selection.getRangeAt(0).cloneRange()
    }
  }

  const sync = (range: Range | null) => {
    if (!range) return
    const editable = elementForRange(range)?.closest('.editable')
    if (editable instanceof HTMLElement) {
      editable.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  const run = (command: string, value?: string) => {
    const selection = restoreSelection()
    if (!selection) return

    document.execCommand(command, false, value)
    rememberSelection(selection)
    sync(savedRange.current)
    setPosition(null)
    setMenu(null)
  }

  const wrapCode = () => {
    const selection = restoreSelection()
    if (!selection) return

    const text = selection.toString()
    document.execCommand('insertHTML', false, `<code>${escapeHtml(text)}</code>`)
    rememberSelection(selection)
    sync(savedRange.current)
    setPosition(null)
    setMenu(null)
  }

  const addLink = () => {
    const url = window.prompt('Bağlantı adresi', 'https://')
    if (!url) return

    const selection = restoreSelection()
    if (!selection) return

    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`
    document.execCommand('createLink', false, normalized)
    rememberSelection(selection)
    sync(savedRange.current)
    setPosition(null)
    setMenu(null)
  }

  /**
   * Seçimi güvenli bir sınıfla sarar. className boşsa aynı gruptaki
   * (boyut veya renk) sınıfları temizler.
   */
  const applyTextStyle = (className: string, prefix: string) => {
    const selection = restoreSelection()
    if (!selection) return

    const range = selection.getRangeAt(0)
    const editable = elementForRange(range)?.closest('.editable')
    if (!editable) return

    if (className) {
      const fragment = range.extractContents()
      const span = document.createElement('span')
      span.className = className
      span.append(fragment)
      range.insertNode(span)

      const next = document.createRange()
      next.selectNodeContents(span)
      selection.removeAllRanges()
      selection.addRange(next)
      savedRange.current = next.cloneRange()
    } else {
      // Seçimin tamamı tek bir metin düğümündeyse extractContents span'ları
      // kopyalamaz. Bu yüzden sınıfı doğrudan seçimle kesişen span'lardan sil.
      // Boş kalan span'ı sanitizeHtml kaydederken kaldıracak.
      const spans = Array.from(editable.querySelectorAll('span')).filter((span) =>
        range.intersectsNode(span),
      )
      for (const span of spans) {
        for (const item of Array.from(span.classList)) {
          if (item.startsWith(prefix)) span.classList.remove(item)
        }
      }
      // Boş kalan span'ı burada sökmüyoruz: seçimi kaybetmemek için DOM'da
      // bırakıyoruz. sanitizeHtml kayıt sırasında sınıfsız span'ı kaldırır.
      savedRange.current = range.cloneRange()
    }

    sync(savedRange.current)
  }

  const buttons = [
    { label: 'Kalın', icon: Bold, action: () => run('bold') },
    { label: 'İtalik', icon: Italic, action: () => run('italic') },
    { label: 'Altı çizili', icon: Underline, action: () => run('underline') },
    { label: 'Üstü çizili', icon: Strikethrough, action: () => run('strikeThrough') },
    { label: 'Kod', icon: Code, action: wrapCode },
    { label: 'Bağlantı', icon: Link2, action: addLink },
  ]

  return (
    <div
      className="fixed z-[70] -translate-x-1/2"
      style={{ top: position.top, left: position.left }}
    >
      <div
        className="animate-pop flex max-w-[calc(100vw-16px)] items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-pop)]"
        onMouseDown={(event) => {
          event.preventDefault()
          markInteracting()
        }}
        onPointerDown={markInteracting}
        onTouchStart={markInteracting}
        role="toolbar"
        aria-label="Metin biçimlendirme"
      >
      {buttons.map(({ label, icon: Icon, action }) => (
        <button
          key={label}
          type="button"
          onClick={action}
          title={label}
          aria-label={label}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--text-soft)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--text)]"
        >
          <Icon className="size-4" />
        </button>
      ))}

      <span className="mx-0.5 h-5 w-px shrink-0 bg-[var(--border)]" aria-hidden="true" />

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenu(menu === 'size' ? null : 'size')}
          title="Metin boyutu"
          aria-label="Metin boyutu"
          aria-haspopup="menu"
          aria-expanded={menu === 'size'}
          className={`grid size-8 place-items-center rounded-lg transition hover:bg-[var(--accent-soft)] hover:text-[var(--text)] ${
            menu === 'size' ? 'bg-[var(--accent-soft)] text-[var(--text)]' : 'text-[var(--text-soft)]'
          }`}
        >
          <Type className="size-4" />
        </button>

        {menu === 'size' && (
          <div
            className="absolute left-1/2 top-full z-10 mt-1 w-44 -translate-x-1/2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-pop)]"
            role="menu"
            aria-label="Metin boyutu"
          >
            <p className="px-2 pb-1 pt-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-[var(--text-faint)]">
              Metin boyutu
            </p>
            {TEXT_SIZE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="menuitem"
                onClick={() => applyTextStyle(option.className, TEXT_SIZE_CLASS_PREFIX)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              >
                <span
                  className="grid size-6 shrink-0 place-items-center font-display font-bold"
                  style={{ fontSize: option.preview }}
                >
                  Aa
                </span>
                <span className="text-xs font-bold">{option.label}</span>
                {!option.className && (
                  <span className="ml-auto text-[0.6rem] font-semibold text-[var(--text-faint)]">
                    temizle
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenu(menu === 'color' ? null : 'color')}
          title="Metin rengi"
          aria-label="Metin rengi"
          aria-haspopup="menu"
          aria-expanded={menu === 'color'}
          className={`grid size-8 place-items-center rounded-lg transition hover:bg-[var(--accent-soft)] hover:text-[var(--text)] ${
            menu === 'color' ? 'bg-[var(--accent-soft)] text-[var(--text)]' : 'text-[var(--text-soft)]'
          }`}
        >
          <Palette className="size-4" />
        </button>

        {menu === 'color' && (
          <div
            className="absolute right-0 top-full z-10 mt-1 w-48 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-pop)]"
            role="menu"
            aria-label="Metin rengi"
          >
            <p className="px-1 pb-1.5 text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-[var(--text-faint)]">
              Metin rengi
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {TEXT_COLOR_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="menuitem"
                  title={option.label}
                  aria-label={option.label}
                  onClick={() => applyTextStyle(option.className, TEXT_COLOR_CLASS_PREFIX)}
                  className="grid size-7 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] transition hover:scale-110 hover:border-[var(--border-strong)]"
                >
                  {option.className ? (
                    <span
                      className="size-4 rounded-full"
                      style={{ backgroundColor: option.swatch }}
                    />
                  ) : (
                    <Ban className="size-3.5 text-[var(--text-faint)]" />
                  )}
                </button>
              ))}
            </div>
            <p className="mt-1.5 px-1 text-[0.6rem] font-semibold text-[var(--text-faint)]">
              Seçili metne uygulanır. Varsayılan rengi temizler.
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

function elementForRange(range: Range): Element | null {
  const node = range.commonAncestorContainer
  return node.nodeType === 1 ? (node as Element) : (node.parentElement ?? null)
}

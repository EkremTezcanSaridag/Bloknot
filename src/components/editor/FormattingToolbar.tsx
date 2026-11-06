import { useEffect, useRef, useState } from 'react'
import {
  Ban,
  Bold,
  Code,
  Italic,
  Link2,
  Palette,
  Strikethrough,
  Underline,
} from 'lucide-react'
import { escapeHtml } from '../../lib/sanitize'
import {
  TEXT_COLOR_CLASS_PREFIX,
  TEXT_COLOR_OPTIONS,
  TEXT_POINT_CLASS,
  TEXT_POINT_MAX,
  TEXT_POINT_MIN,
  TEXT_POINT_SIZES,
  TEXT_POINT_STYLE_PROPERTY,
  TEXT_SIZE_CLASS_PREFIX,
} from '../../lib/textStyles'

interface Position {
  top: number
  left: number
}

type Menu = 'point' | 'color' | null

export function FormattingToolbar() {
  const [position, setPosition] = useState<Position | null>(null)
  const [menu, setMenu] = useState<Menu>(null)
  const [pointValue, setPointValue] = useState('12')
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

      // Punto kutusuna yazarken metin seçimi kaybolur; toolbar açık kalsın.
      const active = document.activeElement
      if (active instanceof Element && active.closest('[role="toolbar"]')) return

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

  const clearSizeStyle = (span: HTMLSpanElement) => {
    span.classList.remove(TEXT_POINT_CLASS)
    for (const item of Array.from(span.classList)) {
      if (item.startsWith(TEXT_SIZE_CLASS_PREFIX)) span.classList.remove(item)
    }
    span.style.removeProperty(TEXT_POINT_STYLE_PROPERTY)
    if (!span.getAttribute('style')?.trim()) span.removeAttribute('style')
  }

  /**
   * Seçili metne punto uygular. null verilirse hem punto hem eski göreli
   * boyut sınıfları temizlenir. Değer 6–200 pt aralığına sıkıştırılır.
   */
  const closestSizeSpan = (node: Node, editable: Element): HTMLSpanElement | null => {
    let element = node instanceof Element ? node : node.parentElement
    while (element && element !== editable) {
      if (element instanceof HTMLSpanElement) {
        const hasSize =
          element.classList.contains(TEXT_POINT_CLASS) ||
          Array.from(element.classList).some((className) =>
            className.startsWith(TEXT_SIZE_CLASS_PREFIX),
          )
        if (hasSize) return element
      }
      element = element.parentElement
    }
    return null
  }

  /** Seçim tek bir boyut spanının tamamını kaplıyorsa onu yeniden kullan. */
  const findSizeSpanForRange = (range: Range, editable: Element): HTMLSpanElement | null => {
    const startSpan = closestSizeSpan(range.startContainer, editable)
    const endSpan = closestSizeSpan(range.endContainer, editable)
    if (!startSpan || startSpan !== endSpan) return null
    return range.toString() === startSpan.textContent ? startSpan : null
  }

  const applyPointSize = (size: number | null) => {
    const selection = restoreSelection()
    if (!selection) return

    const range = selection.getRangeAt(0)
    const editable = elementForRange(range)?.closest('.editable')
    if (!editable) return

    const restoreEditorSelection = (next: Range) => {
      if (editable instanceof HTMLElement) editable.focus({ preventScroll: true })
      selection.removeAllRanges()
      selection.addRange(next)
      savedRange.current = next.cloneRange()
    }

    if (size !== null) {
      const normalized = Math.min(
        TEXT_POINT_MAX,
        Math.max(TEXT_POINT_MIN, Math.round(size * 2) / 2),
      )

      const existing = findSizeSpanForRange(range, editable)
      if (existing) {
        for (const item of Array.from(existing.classList)) {
          if (item.startsWith(TEXT_SIZE_CLASS_PREFIX)) existing.classList.remove(item)
        }
        existing.classList.add(TEXT_POINT_CLASS)
        existing.style.setProperty(TEXT_POINT_STYLE_PROPERTY, `${normalized}pt`)
        setPointValue(String(normalized))
        restoreEditorSelection(range)
        sync(savedRange.current)
        return
      }

      const fragment = range.extractContents()
      for (const span of Array.from(fragment.querySelectorAll('span'))) {
        clearSizeStyle(span)
      }

      const span = document.createElement('span')
      span.className = TEXT_POINT_CLASS
      span.style.setProperty(TEXT_POINT_STYLE_PROPERTY, `${normalized}pt`)
      span.append(fragment)
      range.insertNode(span)

      const next = document.createRange()
      next.selectNodeContents(span)
      restoreEditorSelection(next)
      setPointValue(String(normalized))
    } else {
      const spans = Array.from(editable.querySelectorAll('span')).filter((span) =>
        range.intersectsNode(span),
      )
      for (const span of spans) clearSizeStyle(span)
      restoreEditorSelection(range)
    }

    sync(savedRange.current)
  }

  const applyPointInput = () => {
    const raw = pointValue.trim().replace(',', '.')
    if (!raw) return
    const value = Number(raw)
    if (!Number.isFinite(value) || value <= 0) return
    applyPointSize(value)
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
          onClick={() => setMenu(menu === 'point' ? null : 'point')}
          title="Punto (metin boyutu)"
          aria-label="Punto"
          aria-haspopup="menu"
          aria-expanded={menu === 'point'}
          className={`grid size-8 place-items-center rounded-lg transition hover:bg-[var(--accent-soft)] hover:text-[var(--text)] ${
            menu === 'point'
              ? 'bg-[var(--accent-soft)] text-[var(--text)]'
              : 'text-[var(--text-soft)]'
          }`}
        >
          <span className="font-display text-[0.68rem] font-extrabold tracking-tight">pt</span>
        </button>

        {menu === 'point' && (
          <div
            className="absolute left-1/2 top-full z-10 mt-1 w-56 -translate-x-1/2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-pop)]"
            role="menu"
            aria-label="Punto"
          >
            <p className="px-1 pb-1 text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-[var(--text-faint)]">
              Punto
            </p>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={TEXT_POINT_MIN}
                max={TEXT_POINT_MAX}
                step={0.5}
                inputMode="decimal"
                value={pointValue}
                onChange={(event) => setPointValue(event.target.value)}
                onMouseDown={(event) => {
                  event.stopPropagation()
                  markInteracting()
                }}
                onFocus={markInteracting}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  applyPointInput()
                }}
                aria-label="Punto değeri"
                className="h-8 w-16 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 text-sm font-bold text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
              <span className="text-[0.65rem] font-bold text-[var(--text-faint)]">pt</span>
              <button
                type="button"
                onClick={applyPointInput}
                className="ml-auto rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-[0.68rem] font-extrabold text-[var(--accent-ink)] transition hover:bg-[var(--accent-strong)]"
              >
                Uygula
              </button>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {TEXT_POINT_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => applyPointSize(size)}
                  title={`${size} punto`}
                  aria-label={`${size} punto`}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-1 py-1.5 text-[0.7rem] font-bold text-[var(--text-soft)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
                >
                  {size}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => applyPointSize(null)}
              className="mt-2 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[0.68rem] font-bold text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            >
              <Ban className="size-3.5 text-[var(--text-faint)]" />
              Varsayılan boyut
            </button>
            <p className="mt-1 px-1 text-[0.58rem] font-semibold text-[var(--text-faint)]">
              {TEXT_POINT_MIN}–{TEXT_POINT_MAX} pt arası. Eski boyutlar da temizlenir.
            </p>
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

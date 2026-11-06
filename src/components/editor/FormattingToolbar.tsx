import { useEffect, useState } from 'react'
import { Bold, Code, Italic, Link2, Strikethrough, Underline } from 'lucide-react'
import { escapeHtml } from '../../lib/sanitize'

interface Position {
  top: number
  left: number
}

export function FormattingToolbar() {
  const [position, setPosition] = useState<Position | null>(null)

  useEffect(() => {
    const update = () => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || !selection.rangeCount) {
        setPosition(null)
        return
      }

      const range = selection.getRangeAt(0)
      const node = range.commonAncestorContainer
      const element =
        node.nodeType === 1 ? (node as Element) : (node.parentElement as Element | null) ?? null
      const editable = element?.closest('.editable')
      if (!editable) {
        setPosition(null)
        return
      }

      const rect = range.getBoundingClientRect()
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        setPosition(null)
        return
      }

      const left = Math.min(Math.max(rect.left + rect.width / 2, 130), window.innerWidth - 130)
      setPosition({ top: Math.max(8, rect.top - 50), left })
    }

    document.addEventListener('selectionchange', update)
    window.addEventListener('resize', update)
    document.addEventListener('scroll', update, true)

    return () => {
      document.removeEventListener('selectionchange', update)
      window.removeEventListener('resize', update)
      document.removeEventListener('scroll', update, true)
    }
  }, [])

  if (!position) return null

  const run = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    syncActiveEditable()
    setPosition(null)
  }

  const wrapCode = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return
    const text = selection.toString()
    document.execCommand('insertHTML', false, `<code>${escapeHtml(text)}</code>`)
    syncActiveEditable()
    setPosition(null)
  }

  const addLink = () => {
    const url = window.prompt('Bağlantı adresi', 'https://')
    if (!url) return
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`
    document.execCommand('createLink', false, normalized)
    syncActiveEditable()
    setPosition(null)
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
      className="animate-pop fixed z-[70] flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-pop)]"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(event) => event.preventDefault()}
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
          className="grid size-8 place-items-center rounded-lg text-[var(--text-soft)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--text)]"
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  )
}

function syncActiveEditable() {
  const active = document.activeElement
  if (active instanceof HTMLElement) {
    const editable = active.closest('.editable') ?? active.querySelector('.editable')
    if (editable) {
      editable.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }
}

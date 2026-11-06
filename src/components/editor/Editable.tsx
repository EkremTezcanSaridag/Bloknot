import { useLayoutEffect, useRef } from 'react'
import type { BlockType } from '../../types'
import { getCaretOffset, isCaretAtEnd, isCaretAtStart, splitEditableAtCaret } from '../../lib/dom'
import { sanitizeHtml } from '../../lib/sanitize'

interface EditableProps {
  html: string
  placeholder?: string
  className?: string
  ariaLabel?: string
  autoFocus?: boolean
  onChange: (html: string) => void
  onSplit?: (before: string, after: string) => void
  onBackspaceEmpty?: () => void
  onMergePrevious?: () => void
  onArrowUp?: () => void
  onArrowDown?: () => void
  onSlash?: () => void
  onShortcut?: (type: BlockType) => void
  onPasteText?: (text: string) => void
}

const SHORTCUTS: Array<[RegExp, BlockType]> = [
  [/^#$/, 'heading1'],
  [/^##$/, 'heading2'],
  [/^###$/, 'heading3'],
  [/^[-*]$/, 'bulleted'],
  [/^1\.$/, 'numbered'],
  [/^\[\]$/, 'todo'],
  [/^\[ ]$/, 'todo'],
  [/^>$/, 'quote'],
  [/^```$/, 'code'],
]

export function Editable({
  html,
  placeholder,
  className = '',
  ariaLabel,
  autoFocus,
  onChange,
  onSplit,
  onBackspaceEmpty,
  onMergePrevious,
  onArrowUp,
  onArrowDown,
  onSlash,
  onShortcut,
  onPasteText,
}: EditableProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    if (document.activeElement === element) return
    if (element.innerHTML === html) return
    element.innerHTML = html
  }, [html])

  useLayoutEffect(() => {
    if (!autoFocus) return
    const element = ref.current
    if (!element) return
    element.focus()
    const selection = window.getSelection()
    if (!selection) return
    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }, [autoFocus])

  const pushUpdate = (element: HTMLDivElement) => {
    const raw = element.innerHTML === '<br>' ? '' : element.innerHTML
    onChange(raw)
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="false"
      aria-label={ariaLabel ?? placeholder ?? 'Metin bloğu'}
      spellCheck
      data-placeholder={placeholder}
      className={`editable ${className}`}
      onInput={(event) => pushUpdate(event.currentTarget)}
      onBlur={(event) => pushUpdate(event.currentTarget)}
      onPaste={(event) => {
        event.preventDefault()
        const text = event.clipboardData.getData('text/plain')
        const htmlPaste = event.clipboardData.getData('text/html')

        if (text.includes('\n')) {
          onPasteText?.(text)
          return
        }

        if (htmlPaste) {
          document.execCommand('insertHTML', false, sanitizeHtml(htmlPaste))
        } else if (text) {
          document.execCommand('insertText', false, text)
        }

        const element = event.currentTarget
        window.setTimeout(() => pushUpdate(element), 0)
      }}
      onKeyDown={(event) => {
        const element = event.currentTarget
        const native = event.nativeEvent
        if (native.isComposing) return

        if ((event.metaKey || event.ctrlKey) && !event.altKey) {
          const key = event.key.toLowerCase()
          if (key === 'b' || key === 'i' || key === 'u') {
            event.preventDefault()
            document.execCommand(key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline')
            pushUpdate(element)
            return
          }
        }

        if (event.key === 'Enter') {
          event.preventDefault()
          if (event.shiftKey) {
            document.execCommand('insertLineBreak')
            pushUpdate(element)
            return
          }

          if (onSplit) {
            const { before, after } = splitEditableAtCaret(element)
            onSplit(sanitizeHtml(before), sanitizeHtml(after))
          }
          return
        }

        if (event.key === 'Backspace' && window.getSelection()?.isCollapsed !== false) {
          const isEmpty = !(element.textContent ?? '') && !element.querySelector('br')
          if (isEmpty) {
            event.preventDefault()
            onBackspaceEmpty?.()
            return
          }
          if (isCaretAtStart(element)) {
            event.preventDefault()
            onMergePrevious?.()
            return
          }
        }

        if (event.key === 'ArrowUp' && !event.shiftKey && isCaretAtStart(element)) {
          event.preventDefault()
          onArrowUp?.()
          return
        }

        if (event.key === 'ArrowDown' && !event.shiftKey && isCaretAtEnd(element)) {
          event.preventDefault()
          onArrowDown?.()
          return
        }

        if (event.key === '/' && isCaretAtStart(element)) {
          event.preventDefault()
          onSlash?.()
          return
        }

        if (event.key === ' ' && !event.shiftKey && onShortcut) {
          if (element.querySelector('b, strong, i, em, u, s, code, a')) return
          const offset = getCaretOffset(element)
          const before = (element.textContent ?? '').slice(0, offset)
          const match = SHORTCUTS.find(([pattern]) => pattern.test(before))
          if (match) {
            event.preventDefault()
            element.innerHTML = ''
            onChange('')
            onShortcut(match[1])
          }
        }
      }}
    />
  )
}

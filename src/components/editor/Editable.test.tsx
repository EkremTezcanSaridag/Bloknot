import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Editable } from './Editable'

function setCaretAtEnd(element: HTMLElement) {
  element.focus()
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.selectNodeContents(element)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

describe('Editable', () => {
  it('markdown kısayolunu uygular ve işaretçiyi temizler', () => {
    const onChange = vi.fn()
    const onShortcut = vi.fn()

    render(
      <Editable
        html=""
        ariaLabel="Metin"
        onChange={onChange}
        onShortcut={onShortcut}
      />,
    )

    const editor = screen.getByRole('textbox', { name: 'Metin' })
    editor.textContent = '#'
    setCaretAtEnd(editor)

    fireEvent.keyDown(editor, { key: ' ' })

    expect(onShortcut).toHaveBeenCalledWith('heading1')
    expect(onChange).toHaveBeenCalledWith('')
    expect(editor.textContent).toBe('')
  })

  it('Enter ile bloğu imleç konumundan böler', () => {
    const onSplit = vi.fn()

    render(
      <Editable html="" ariaLabel="Metin" onChange={vi.fn()} onSplit={onSplit} />,
    )

    const editor = screen.getByRole('textbox', { name: 'Metin' })
    editor.textContent = 'Merhaba dünya'
    setCaretAtEnd(editor)

    fireEvent.keyDown(editor, { key: 'Enter' })

    expect(onSplit).toHaveBeenCalledTimes(1)
    expect(onSplit.mock.calls[0][0]).toBe('Merhaba dünya')
    expect(onSplit.mock.calls[0][1]).toBe('')
  })
})

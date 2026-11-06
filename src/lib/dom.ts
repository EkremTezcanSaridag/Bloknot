/** İmleci belirtilen bloğun başına veya sonuna getirir. */
export function focusEditable(blockId: string, position: 'start' | 'end' = 'start'): void {
  let attempts = 0

  const attempt = () => {
    const element = document.querySelector<HTMLElement>(
      `[data-block-id="${blockId}"] .editable`,
    )

    if (!element) {
      if (attempts < 20) {
        attempts += 1
        requestAnimationFrame(attempt)
      }
      return
    }

    element.focus({ preventScroll: false })

    const selection = window.getSelection()
    if (!selection) return

    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(position === 'start')
    selection.removeAllRanges()
    selection.addRange(range)
  }

  requestAnimationFrame(attempt)
}

export function focusTitle(): void {
  const element = document.querySelector<HTMLTextAreaElement>('[data-note-title]')
  element?.focus()
  element?.setSelectionRange(element.value.length, element.value.length)
}

/** İmlecin blok içindeki düz metin konumu. */
export function getCaretOffset(element: HTMLElement): number {
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return 0
  const range = selection.getRangeAt(0)
  if (!element.contains(range.startContainer)) return 0

  const before = range.cloneRange()
  before.selectNodeContents(element)
  before.setEnd(range.startContainer, range.startOffset)
  return before.toString().length
}

export function isCaretAtStart(element: HTMLElement): boolean {
  const selection = window.getSelection()
  if (!selection || !selection.isCollapsed) return false
  return getCaretOffset(element) === 0
}

export function isCaretAtEnd(element: HTMLElement): boolean {
  const selection = window.getSelection()
  if (!selection || !selection.isCollapsed) return false
  return getCaretOffset(element) === (element.textContent ?? '').length
}

export function splitEditableAtCaret(element: HTMLElement): { before: string; after: string } {
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) {
    return { before: element.innerHTML, after: '' }
  }

  const range = selection.getRangeAt(0)
  const beforeRange = range.cloneRange()
  beforeRange.selectNodeContents(element)
  beforeRange.setEnd(range.startContainer, range.startOffset)

  const afterRange = range.cloneRange()
  afterRange.selectNodeContents(element)
  afterRange.setStart(range.endContainer, range.endOffset)

  return {
    before: fragmentToHtml(beforeRange.cloneContents()),
    after: fragmentToHtml(afterRange.cloneContents()),
  }
}

/** Seçili içeriği (varsa) silip verilen HTML'i imleç konumuna ekler. */
export function insertHtmlAtCaret(html: string): void {
  document.execCommand('insertHTML', false, html)
}

export function serializeEditable(element: HTMLElement): string {
  if (!element.textContent?.trim() && !element.querySelector('br,img')) {
    return ''
  }
  return element.innerHTML
}

function fragmentToHtml(fragment: DocumentFragment): string {
  const container = document.createElement('div')
  container.append(fragment)
  return container.innerHTML
}

/** HTML içindeki düz metni satır sonlarını koruyarak çıkarır (kod blokları). */
export function decodeHtmlText(html: string): string {
  if (!html) return ''
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
  }
  const doc = new DOMParser().parseFromString(
    html.replace(/<br\s*\/?>/gi, '\n'),
    'text/html',
  )
  return doc.body.textContent ?? ''
}

export function elById(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-block-id="${id}"]`)
}

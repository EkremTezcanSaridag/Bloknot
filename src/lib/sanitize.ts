import {
  ALLOWED_TEXT_STYLE_CLASSES,
  TEXT_POINT_CLASS,
  TEXT_POINT_MAX,
  TEXT_POINT_MIN,
  TEXT_POINT_STYLE_PROPERTY,
} from './textStyles'

const ALLOWED_TAGS = new Set([
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'S',
  'STRIKE',
  'CODE',
  'BR',
  'A',
  'MARK',
  'SPAN',
])

/** Uygulama içi not kimliği (createId('n')). */
const NOTE_ID_PATTERN = /^n_[a-z0-9]+$/i
/** Uygulama içi not bağlantısı adresi. */
const NOTE_LINK_HREF = /^#\/note\/n_[a-z0-9]+$/i

const DROP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'LINK',
  'META',
  'FORM',
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'BUTTON',
  'SVG',
  'IMG',
  'VIDEO',
  'AUDIO',
])

/** Editör/blok içeriği için güvenli HTML üretir. */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return ''

  if (typeof DOMParser === 'undefined') {
    return dirty.replace(/<[^>]*>/g, '')
  }

  const doc = new DOMParser().parseFromString(dirty, 'text/html')
  cleanChildren(doc.body)
  return doc.body.innerHTML.replace(/^(?:<br\s*\/?>)+/i, '')
}

function cleanChildren(parent: Element): void {
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === 3) continue // metin
    if (node.nodeType !== 1) {
      node.remove()
      continue
    }

    const element = node as Element
    const tag = element.tagName

    if (DROP_TAGS.has(tag)) {
      element.remove()
      continue
    }

    if (tag === 'DIV' || tag === 'P') {
      cleanChildren(element)
      const fragment = document.createDocumentFragment()
      fragment.append(document.createElement('br'))
      while (element.firstChild) {
        fragment.append(element.firstChild)
      }
      element.replaceWith(fragment)
      continue
    }

    if (!ALLOWED_TAGS.has(tag)) {
      cleanChildren(element)
      const children = Array.from(element.childNodes)
      element.replaceWith(...children)
      continue
    }

    for (const attribute of Array.from(element.attributes)) {
      if (tag === 'A' && attribute.name === 'href') {
        const href = attribute.value.trim()
        if (!/^(https?:|mailto:)/i.test(href) && !NOTE_LINK_HREF.test(href)) {
          element.removeAttribute('href')
        }
        continue
      }

      if (tag === 'A' && attribute.name === 'data-note-id') {
        if (!NOTE_ID_PATTERN.test(attribute.value.trim())) {
          element.removeAttribute('data-note-id')
        }
        continue
      }

      if (tag === 'SPAN' && (attribute.name === 'class' || attribute.name === 'style')) {
        continue
      }

      element.removeAttribute(attribute.name)
    }

    if (tag === 'SPAN') cleanSpanAttributes(element)

    if (tag === 'A') {
      let noteId = element.getAttribute('data-note-id')
      const href = element.getAttribute('href') ?? ''
      const hrefMatch = href.match(NOTE_LINK_HREF)
      if (!noteId && hrefMatch) {
        noteId = href.slice('#/note/'.length)
        element.setAttribute('data-note-id', noteId)
      }
      if (noteId) {
        // Not bağlantısı: adres her zaman uygulama içi ve kimlikten üretilir.
        element.setAttribute('href', `#/note/${noteId}`)
      } else if (element.getAttribute('href')) {
        element.setAttribute('rel', 'noopener noreferrer')
        element.setAttribute('target', '_blank')
      }
    }

    cleanChildren(element)

    // Sınıfı kalmayan span'ı gereksiz yere DOM'da tutma.
    if (tag === 'SPAN' && !element.getAttribute('class')) {
      element.replaceWith(...Array.from(element.childNodes))
    }
  }
}

/**
 * Span üzerindeki yalnızca izinli sınıfları ve doğrulanmış punto değişkenini
 * bırakır. Serbest `style` içeriği hiçbir zaman korunmaz.
 */
function cleanSpanAttributes(element: Element): void {
  const rawClasses = (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
  const hasPointClass = rawClasses.includes(TEXT_POINT_CLASS)
  const style = element.getAttribute('style') ?? ''
  const match = style.match(
    new RegExp(
      `^\\s*${TEXT_POINT_STYLE_PROPERTY}\\s*:\\s*(\\d{1,3}(?:\\.\\d)?)pt\\s*;?\\s*$`,
      'i',
    ),
  )
  const point = match ? Number(match[1]) : Number.NaN
  const validPoint =
    hasPointClass && Number.isFinite(point) && point >= TEXT_POINT_MIN && point <= TEXT_POINT_MAX

  if (validPoint) {
    element.setAttribute('style', `${TEXT_POINT_STYLE_PROPERTY}: ${point}pt`)
  } else {
    element.removeAttribute('style')
  }

  const allowed = rawClasses.filter(
    (className) =>
      ALLOWED_TEXT_STYLE_CLASSES.has(className) &&
      (className !== TEXT_POINT_CLASS || validPoint),
  )

  if (allowed.length) {
    element.setAttribute('class', Array.from(new Set(allowed)).join(' '))
  } else {
    element.removeAttribute('class')
  }
}

/**
 * Uygulama içi not bağlantılarını düz metne indirger.
 * Paylaşılan notlarda hedef not bulunmadığı için bağlantı anlamsız kalır.
 */
export function stripNoteLinks(html: string): string {
  if (!html || typeof DOMParser === 'undefined') return html

  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const anchor of Array.from(doc.body.querySelectorAll('a[data-note-id], a[href^="#/note/"]'))) {
    anchor.replaceWith(...Array.from(anchor.childNodes))
  }
  return doc.body.innerHTML
}

/** Blok HTML'inden düz metin çıkarır (arama, kelime sayımı). */
export function htmlToText(html: string): string {
  if (!html) return ''

  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]*>/g, ' ').trim()
  }

  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const br of Array.from(doc.body.querySelectorAll('br'))) {
    br.replaceWith(' ')
  }
  return (doc.body.textContent ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Blok HTML'ini Markdown'a çevirir. */
export function htmlToMarkdown(html: string): string {
  if (!html) return ''
  if (typeof DOMParser === 'undefined') return htmlToText(html)

  const doc = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(doc.body.childNodes)
    .map(nodeToMarkdown)
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === 3) return node.nodeValue ?? ''
  if (node.nodeType !== 1) return ''

  const element = node as Element
  const inner = Array.from(element.childNodes).map(nodeToMarkdown).join('')

  switch (element.tagName) {
    case 'BR':
      return '\n'
    case 'B':
    case 'STRONG':
      return inner.trim() ? `**${inner}**` : inner
    case 'I':
    case 'EM':
      return inner.trim() ? `*${inner}*` : inner
    case 'S':
    case 'STRIKE':
      return inner.trim() ? `~~${inner}~~` : inner
    case 'CODE':
      return inner.trim() ? `\`${inner}\`` : inner
    case 'MARK':
      return inner.trim() ? `==${inner}==` : inner
    case 'A': {
      const href = element.getAttribute('href')
      return href ? `[${inner}](${href})` : inner
    }
    default:
      return inner
  }
}

/** Kullanıcının yapıştırdığı düz metni güvenli HTML'e çevirir. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Basit satır içi Markdown → HTML (içe aktarma için). */
export function inlineMarkdownToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+|#\/note\/n_[a-z0-9]+)\)/g, '<a href="$2">$1</a>')
}

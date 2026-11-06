import { ALLOWED_TEXT_STYLE_CLASSES } from './textStyles'

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
        if (!/^(https?:|mailto:)/i.test(href)) {
          element.removeAttribute('href')
        }
        continue
      }

      if (tag === 'SPAN' && attribute.name === 'class') {
        const allowed = attribute.value
          .split(/\s+/)
          .filter((className) => ALLOWED_TEXT_STYLE_CLASSES.has(className))
        if (allowed.length) element.setAttribute('class', Array.from(new Set(allowed)).join(' '))
        else element.removeAttribute('class')
        continue
      }

      element.removeAttribute(attribute.name)
    }

    if (tag === 'A' && element.getAttribute('href')) {
      element.setAttribute('rel', 'noopener noreferrer')
      element.setAttribute('target', '_blank')
    }

    cleanChildren(element)

    // Sınıfı kalmayan span'ı gereksiz yere DOM'da tutma.
    if (tag === 'SPAN' && !element.getAttribute('class')) {
      element.replaceWith(...Array.from(element.childNodes))
    }
  }
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
    .replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
}

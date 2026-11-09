import type JSZip from 'jszip'
import type { Slide, SlideDeck, SlideTextItem } from './slides'

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
}

/** Küçük simge ve logoları atlamak için en az bu kadar base64 karakteri. */
const MIN_DOCX_IMAGE_LENGTH = 5_000

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml')
}

function allByLocalName(root: Document | Element, name: string): Element[] {
  return Array.from(root.getElementsByTagNameNS('*', name))
}

function firstByLocalName(root: Document | Element, name: string): Element | null {
  return allByLocalName(root, name)[0] ?? null
}

function childrenByLocalName(parent: Element, name: string): Element[] {
  return Array.from(parent.children).filter((element) => element.localName === name)
}

function childByLocalName(parent: Element | null, name: string): Element | null {
  if (!parent) return null
  return Array.from(parent.children).find((element) => element.localName === name) ?? null
}

function attr(element: Element | null, name: string, namespace?: string): string {
  if (!element) return ''
  if (namespace) {
    const namespaced = element.getAttributeNS(namespace, name)
    if (namespaced) return namespaced
  }
  return (
    element.getAttributeNS(W_NS, name) ||
    element.getAttribute(`w:${name}`) ||
    element.getAttribute(name) ||
    ''
  )
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** Paragraf içindeki metni, sekme ve satır sonlarını koruyarak toplar. */
function collectRunText(node: Element, parts: string[]): void {
  for (const child of Array.from(node.children)) {
    switch (child.localName) {
      case 't':
        parts.push(child.textContent ?? '')
        break
      case 'tab':
        parts.push(' ')
        break
      case 'br':
      case 'cr':
        parts.push(' ')
        break
      // Silinmiş ve alan kodu metinleri belge içeriğine dahil edilmez.
      case 'del':
      case 'delText':
      case 'instrText':
        break
      default:
        collectRunText(child, parts)
    }
  }
}

function paragraphText(paragraph: Element): string {
  const parts: string[] = []
  collectRunText(paragraph, parts)
  return cleanText(parts.join(''))
}

function styleId(paragraph: Element): string {
  return attr(childByLocalName(childByLocalName(paragraph, 'pPr'), 'pStyle'), 'val').toLowerCase()
}

function outlineLevel(paragraph: Element): number | null {
  const value = attr(childByLocalName(childByLocalName(paragraph, 'pPr'), 'outlineLvl'), 'val')
  if (!value) return null
  const level = Number(value)
  return Number.isFinite(level) ? level : null
}

/** Başlık düzeyi: 1 = Heading1/Title, 2 = Heading2/Subtitle… */
function headingLevel(paragraph: Element): number | null {
  const style = styleId(paragraph)
  if (style === 'title') return 1
  if (style === 'subtitle') return 2
  const match = style.match(/^(?:heading|baslik)(\d)$/)
  if (match) return Number(match[1])

  const outline = outlineLevel(paragraph)
  if (outline !== null) return Math.min(9, outline + 1)
  return null
}

function listInfo(paragraph: Element): { bullet: boolean; level: number } {
  const numbering = childByLocalName(childByLocalName(paragraph, 'pPr'), 'numPr')
  if (!numbering) return { bullet: false, level: 0 }

  const rawLevel = Number(attr(childByLocalName(numbering, 'ilvl'), 'val') || '0')
  const level = Number.isFinite(rawLevel) ? rawLevel : 0
  return { bullet: true, level: Math.max(0, Math.min(8, level)) }
}

function tableRows(table: Element): string[][] {
  return childrenByLocalName(table, 'tr').map((row) =>
    childrenByLocalName(row, 'tc').map((cell) =>
      allByLocalName(cell, 'p')
        .map(paragraphText)
        .filter(Boolean)
        .join(' '),
    ),
  )
}

/** Paragraftaki resim ilişki kimliklerini (drawing ve VML) toplar. */
function paragraphImageIds(paragraph: Element): string[] {
  const ids: string[] = []

  for (const blip of allByLocalName(paragraph, 'blip')) {
    const id = attr(blip, 'embed', R_NS) || attr(blip, 'link', R_NS)
    if (id && !ids.includes(id)) ids.push(id)
  }

  for (const image of allByLocalName(paragraph, 'imagedata')) {
    const id =
      image.getAttributeNS(R_NS, 'id') ||
      image.getAttribute('r:id') ||
      image.getAttribute('id') ||
      ''
    if (id && !ids.includes(id)) ids.push(id)
  }

  return ids
}

function resolveDocxPath(baseDir: string, target: string): string {
  const normalized = target.replace(/\\/g, '/')
  if (normalized.startsWith('/')) return normalized.replace(/^\/+/, '')

  const parts = `${baseDir}/${normalized}`.split('/')
  const resolved: string[] = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') {
      resolved.pop()
      continue
    }
    resolved.push(part)
  }
  return resolved.join('/')
}

/** Belgedeki resim ilişkilerini data URL olarak yükler. */
async function loadDocumentMedia(zip: JSZip): Promise<Map<string, string>> {
  const media = new Map<string, string>()
  const relsFile = zip.file('word/_rels/document.xml.rels')
  if (!relsFile) return media

  const rels = parseXml(await relsFile.async('string'))
  for (const relationship of allByLocalName(rels, 'Relationship')) {
    const type = relationship.getAttribute('Type') || ''
    if (!type.endsWith('/image')) continue

    const id = relationship.getAttribute('Id') || ''
    const target = relationship.getAttribute('Target') || ''
    if (!id || !target) continue

    const path = resolveDocxPath('word', target)
    const file = zip.file(path)
    if (!file) continue

    const extension = path.split('.').pop()?.toLowerCase() ?? ''
    const mime = IMAGE_MIME_BY_EXTENSION[extension]
    if (!mime) continue

    const base64 = await file.async('base64')
    if (base64.length < MIN_DOCX_IMAGE_LENGTH) continue
    media.set(id, `data:${mime};base64,${base64}`)
  }

  return media
}

/** Gövde çocuklarını sırayla gezer; içerik denetimlerinin (sdt) içine iner. */
function visitBody(node: Element, visit: (element: Element) => void): void {
  for (const child of Array.from(node.children)) {
    if (child.localName === 'sdt') {
      const content = childByLocalName(child, 'sdtContent')
      if (content) visitBody(content, visit)
      continue
    }
    if (child.localName === 'p' || child.localName === 'tbl') visit(child)
  }
}

interface DraftSlide {
  title: string
  items: SlideTextItem[]
  tables: string[][][]
  images: string[]
}

async function readCoreTitle(zip: JSZip): Promise<string> {
  const coreFile = zip.file('docProps/core.xml')
  if (!coreFile) return ''
  const core = parseXml(await coreFile.async('string'))
  return cleanText(firstByLocalName(core, 'title')?.textContent ?? '')
}

export async function parseDocxArchive(
  zip: JSZip,
  fallbackTitle = 'Belge notu',
): Promise<SlideDeck> {
  const documentFile = zip.file('word/document.xml')
  if (!documentFile) {
    throw new Error('DOCX içinde belge metni bulunamadı.')
  }

  const document = parseXml(await documentFile.async('string'))
  const body = firstByLocalName(document, 'body')
  if (!body) {
    throw new Error('DOCX içinde belge metni bulunamadı.')
  }

  const blocks: Element[] = []
  visitBody(body, (element) => blocks.push(element))

  // Belge H1 kullanıyorsa H1'lerde, yalnızca H2 varsa H2'lerde böl.
  let hasHeading1 = false
  let hasHeading2 = false
  for (const block of blocks) {
    if (block.localName !== 'p') continue
    const level = headingLevel(block)
    if (level === 1) hasHeading1 = true
    else if (level === 2) hasHeading2 = true
  }
  const splitLevel = hasHeading1 ? 1 : hasHeading2 ? 2 : 0

  const drafts: DraftSlide[] = []
  let current: DraftSlide | null = null
  let imageFound = 0
  let imageAdded = 0
  const media = await loadDocumentMedia(zip)

  const ensureCurrent = (): DraftSlide => {
    if (!current) {
      current = { title: '', items: [], tables: [], images: [] }
      drafts.push(current)
    }
    return current
  }

  for (const block of blocks) {
    if (block.localName === 'tbl') {
      const rows = tableRows(block).filter((row) => row.some((cell) => cell.trim()))
      if (rows.length) ensureCurrent().tables.push(rows)
      continue
    }

    const imageIds = paragraphImageIds(block)
    if (imageIds.length) {
      imageFound += imageIds.length
      const draft = ensureCurrent()
      for (const id of imageIds) {
        const source = media.get(id)
        if (source && !draft.images.includes(source)) {
          draft.images.push(source)
          imageAdded += 1
        }
      }
    } else if (
      allByLocalName(block, 'drawing').length ||
      allByLocalName(block, 'pict').length
    ) {
      imageFound += 1
    }

    const text = paragraphText(block)
    if (!text) continue

    const level = headingLevel(block)
    if (splitLevel && level !== null && level <= splitLevel) {
      current = { title: text, items: [], tables: [], images: [] }
      drafts.push(current)
      continue
    }

    const list = listInfo(block)
    ensureCurrent().items.push({ text, bullet: list.bullet, level: list.level })
  }

  // Başlık stili hiç yoksa ilk paragrafı slayt başlığı olarak kullan.
  if (!splitLevel) {
    const draft = drafts[0]
    if (draft && !draft.title && draft.items.length) {
      draft.title = draft.items[0].text
      draft.items = draft.items.slice(1)
    }
  }

  const coreTitle = await readCoreTitle(zip)
  const deckTitle =
    coreTitle || drafts.find((draft) => draft.title)?.title || fallbackTitle

  const slides: Slide[] = drafts
    .filter(
      (draft) => draft.title || draft.items.length || draft.tables.length || draft.images.length,
    )
    .map((draft, index) => ({
      number: index + 1,
      title: draft.title || `Slayt ${index + 1}`,
      items: draft.items,
      notes: [],
      tables: draft.tables.length ? draft.tables : undefined,
      images: draft.images.length ? draft.images : undefined,
    }))

  if (!slides.length) {
    throw new Error('DOCX içinde okunabilir metin bulunamadı.')
  }

  const warnings: string[] = []
  if (imageFound && !imageAdded) {
    warnings.push('DOCX içindeki görseller nota eklenemedi.')
  }

  return {
    title: deckTitle,
    slides,
    warnings: warnings.length ? warnings : undefined,
  }
}

export async function readDocxFile(file: File): Promise<SlideDeck> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const fallbackTitle = file.name.replace(/\.[^.]+$/, '') || 'Belge notu'
  return parseDocxArchive(zip, fallbackTitle)
}

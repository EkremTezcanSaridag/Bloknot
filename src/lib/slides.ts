import type JSZip from 'jszip'
import { newBlock } from './markdown'
import { escapeHtml } from './sanitize'
import type { Block } from '../types'

export interface SlideTextItem {
  text: string
  bullet: boolean
  level: number
}

export interface Slide {
  number: number
  title: string
  items: SlideTextItem[]
  notes: string[]
}

export interface SlideDeck {
  title: string
  slides: Slide[]
}

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml')
}

function firstByLocalName(parent: Document | Element, name: string): Element | null {
  const elements = parent.getElementsByTagNameNS('*', name)
  return elements.length ? (elements[0] as Element) : null
}

function allByLocalName(parent: Document | Element, name: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS('*', name)) as Element[]
}

function attr(element: Element | null, name: string, namespace?: string): string {
  if (!element) return ''
  if (namespace) {
    const namespaced = element.getAttributeNS(namespace, name)
    if (namespaced) return namespaced
  }
  return element.getAttribute(name) || ''
}

function relationshipId(element: Element | null): string {
  if (!element) return ''
  return (
    attr(element, 'id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships') ||
    attr(element, 'r:id') ||
    attr(element, 'id')
  )
}

function resolveZipPath(baseDir: string, target: string): string {
  const parts = `${baseDir}/${target}`.split('/')
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

function naturalSort(paths: string[]): string[] {
  return [...paths].sort((left, right) => {
    const leftNumber = Number(left.match(/slide(\d+)\.xml$/i)?.[1] ?? 0)
    const rightNumber = Number(right.match(/slide(\d+)\.xml$/i)?.[1] ?? 0)
    return leftNumber - rightNumber
  })
}

function hasBullet(paragraphProperties: Element | null): boolean {
  if (!paragraphProperties) return false
  return ['buChar', 'buAutoNum', 'buBlip'].some(
    (name) => allByLocalName(paragraphProperties, name).length > 0,
  )
}

function paragraphText(paragraph: Element): string {
  return allByLocalName(paragraph, 't')
    .map((node) => node.textContent || '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseParagraph(paragraph: Element): SlideTextItem | null {
  const text = paragraphText(paragraph)
  if (!text) return null

  const properties = firstByLocalName(paragraph, 'pPr')
  return {
    text,
    bullet: hasBullet(properties),
    level: Number(attr(properties, 'lvl') || '0'),
  }
}

function parseNotes(xml: string): string[] {
  const document = parseXml(xml)
  const paragraphs: string[] = []
  for (const textBody of allByLocalName(document, 'txBody')) {
    for (const paragraph of allByLocalName(textBody, 'p')) {
      const text = paragraphText(paragraph)
      if (text) paragraphs.push(text)
    }
  }
  return paragraphs
}

async function getSlidePaths(zip: JSZip): Promise<string[]> {
  const presentationFile = zip.file('ppt/presentation.xml')
  if (presentationFile) {
    const presentation = parseXml(await presentationFile.async('string'))
    const relsFile = zip.file('ppt/_rels/presentation.xml.rels')
    const relationshipTargets = new Map<string, string>()

    if (relsFile) {
      const relationships = parseXml(await relsFile.async('string'))
      for (const relationship of allByLocalName(relationships, 'Relationship')) {
        const id = attr(relationship, 'Id')
        const target = attr(relationship, 'Target')
        if (id && target) relationshipTargets.set(id, target)
      }
    }

    const slideIds = allByLocalName(presentation, 'sldId')
    const paths = slideIds
      .map((slideId) => {
        const id = relationshipId(slideId)
        const target = id ? relationshipTargets.get(id) : undefined
        return target ? resolveZipPath('ppt', target) : null
      })
      .filter((path): path is string => Boolean(path))

    if (paths.length) return paths
  }

  return naturalSort(
    Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path)),
  )
}

async function getNotesPath(zip: JSZip, slidePath: string): Promise<string | null> {
  const slideName = slidePath.split('/').pop()
  if (!slideName) return null
  const slideDir = slidePath.slice(0, slidePath.lastIndexOf('/'))
  const relsPath = `${slideDir}/_rels/${slideName}.rels`
  const relsFile = zip.file(relsPath)
  if (!relsFile) return null

  const relationships = parseXml(await relsFile.async('string'))
  for (const relationship of allByLocalName(relationships, 'Relationship')) {
    const type = attr(relationship, 'Type')
    const target = attr(relationship, 'Target')
    if (type.endsWith('/notesSlide') && target) {
      return resolveZipPath(slideDir, target)
    }
  }

  return null
}

async function getCoreTitle(zip: JSZip): Promise<string> {
  const coreFile = zip.file('docProps/core.xml')
  if (!coreFile) return ''

  const core = parseXml(await coreFile.async('string'))
  const titleElement = allByLocalName(core, 'title')[0]
  return titleElement?.textContent?.trim() || ''
}

async function parseSlide(
  zip: JSZip,
  slidePath: string,
  number: number,
): Promise<Slide> {
  const slideXml = await zip.file(slidePath)?.async('string')
  if (!slideXml) {
    return { number, title: `Slayt ${number}`, items: [], notes: [] }
  }

  const document = parseXml(slideXml)
  const shapes = allByLocalName(document, 'sp')
  let title = ''
  const items: SlideTextItem[] = []

  for (const shape of shapes) {
    const placeholder = firstByLocalName(shape, 'ph')
    const placeholderType = attr(placeholder, 'type')
    const isTitle = placeholderType === 'title' || placeholderType === 'ctrTitle'
    const textBody = firstByLocalName(shape, 'txBody')
    if (!textBody) continue

    const paragraphs = allByLocalName(textBody, 'p')
      .map(parseParagraph)
      .filter((item): item is SlideTextItem => Boolean(item))

    if (isTitle) {
      if (!title && paragraphs.length) {
        title = paragraphs[0].text
        items.push(...paragraphs.slice(1))
      } else {
        items.push(...paragraphs)
      }
    } else {
      items.push(...paragraphs)
    }
  }

  if (!title && items.length) {
    title = items[0].text
    items.shift()
  }
  if (!title) title = `Slayt ${number}`

  const notesPath = await getNotesPath(zip, slidePath)
  const notes =
    notesPath && zip.file(notesPath)
      ? parseNotes(await zip.file(notesPath)!.async('string'))
      : []

  return { number, title, items, notes }
}

export async function parsePptxArchive(
  zip: JSZip,
  deckTitle = 'Slayt notu',
): Promise<SlideDeck> {
  const coreTitle = await getCoreTitle(zip)
  const slidePaths = await getSlidePaths(zip)
  const slides: Slide[] = []

  for (let index = 0; index < slidePaths.length; index += 1) {
    slides.push(await parseSlide(zip, slidePaths[index], index + 1))
  }

  return {
    title: coreTitle || deckTitle || 'Slayt notu',
    slides,
  }
}

export async function readPptxFile(file: File): Promise<SlideDeck> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  return parsePptxArchive(zip, file.name.replace(/\.[^.]+$/, '') || 'Slayt notu')
}

interface PdfTextItem {
  str: string
  x: number
  y: number
}

const PDF_BULLET_MARKER = /^[\u2022\u25CF\u25CB\u25AA\u25AB\-\*\u2013\u2014]\s+/

export function groupPdfTextItems(items: PdfTextItem[]): string[] {
  const sorted = [...items].sort((left, right) => right.y - left.y || left.x - right.x)
  const lines: { y: number; items: PdfTextItem[] }[] = []

  for (const item of sorted) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(last.y - item.y) <= 4) {
      last.items.push(item)
    } else {
      lines.push({ y: item.y, items: [item] })
    }
  }

  return lines
    .map((line) =>
      line.items
        .sort((left, right) => left.x - right.x)
        .map((item) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
}

export function pdfLinesToSlide(number: number, lines: string[]): Slide {
  const title = lines[0] || `Sayfa ${number}`
  const items = lines.slice(1).map((line) => {
    const bullet = PDF_BULLET_MARKER.test(line)
    return {
      text: bullet ? line.replace(PDF_BULLET_MARKER, '').trim() : line,
      bullet,
      level: 0,
    }
  })

  if (!items.length) {
    items.push({ text: 'Bu sayfada metin bulunamadı.', bullet: false, level: 0 })
  }

  return { number, title, items, notes: [] }
}

export async function readPdfFile(file: File): Promise<SlideDeck> {
  const pdfjs = await import('pdfjs-dist')
  const workerModule = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')) as {
    default: string
  }
  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default

  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const slides: Slide[] = []

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    const rawItems = content.items as Array<{ str?: string; transform?: number[] }>
    const items: PdfTextItem[] = rawItems
      .filter((item) => typeof item.str === 'string' && Array.isArray(item.transform))
      .map((item) => ({
        str: item.str as string,
        x: (item.transform as number[])[4] ?? 0,
        y: (item.transform as number[])[5] ?? 0,
      }))

    slides.push(pdfLinesToSlide(pageNumber, groupPdfTextItems(items)))
  }

  return {
    title: file.name.replace(/\.[^.]+$/, '') || 'PDF notu',
    slides,
  }
}

export function slidesToBlocks(
  deck: SlideDeck,
  mode: 'sections' | 'single',
  includeNotes = true,
): Block[] {
  const blocks: Block[] = [
    newBlock('heading1', { html: escapeHtml(deck.title || 'Slayt notu') }),
  ]

  if (mode === 'sections') {
    for (const slide of deck.slides) {
      blocks.push(newBlock('heading2', { html: escapeHtml(slide.title) }))

      for (const item of slide.items) {
        blocks.push(
          newBlock(item.bullet ? 'bulleted' : 'paragraph', {
            html: escapeHtml(item.text),
          }),
        )
      }

      if (includeNotes && slide.notes.length) {
        blocks.push(
          newBlock('quote', {
            html: escapeHtml(slide.notes.join(' ')),
          }),
        )
      }
    }
  } else {
    for (const slide of deck.slides) {
      if (slide.title) {
        blocks.push(
          newBlock('paragraph', {
            html: `<strong>${escapeHtml(slide.title)}</strong>`,
          }),
        )
      }

      for (const item of slide.items) {
        blocks.push(
          newBlock(item.bullet ? 'bulleted' : 'paragraph', {
            html: escapeHtml(item.text),
          }),
        )
      }

      if (includeNotes && slide.notes.length) {
        blocks.push(
          newBlock('quote', {
            html: escapeHtml(slide.notes.join(' ')),
          }),
        )
      }
    }
  }

  if (blocks.length === 1) {
    blocks.push(
      newBlock('paragraph', {
        html: 'Bu sunumdan metin çıkarlamadı.',
      }),
    )
  }

  return blocks
}

export type PptxTextItem = SlideTextItem
export type PptxSlide = Slide
export type PptxDeck = SlideDeck


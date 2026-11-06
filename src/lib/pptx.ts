import type JSZip from 'jszip'
import { newBlock } from './markdown'
import { escapeHtml } from './sanitize'
import type { Block } from '../types'

export interface PptxTextItem {
  text: string
  bullet: boolean
  level: number
}

export interface PptxSlide {
  number: number
  title: string
  items: PptxTextItem[]
  notes: string[]
}

export interface PptxDeck {
  title: string
  slides: PptxSlide[]
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

function parseParagraph(paragraph: Element): PptxTextItem | null {
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
): Promise<PptxSlide> {
  const slideXml = await zip.file(slidePath)?.async('string')
  if (!slideXml) {
    return { number, title: `Slayt ${number}`, items: [], notes: [] }
  }

  const document = parseXml(slideXml)
  const shapes = allByLocalName(document, 'sp')
  let title = ''
  const items: PptxTextItem[] = []

  for (const shape of shapes) {
    const placeholder = firstByLocalName(shape, 'ph')
    const placeholderType = attr(placeholder, 'type')
    const isTitle = placeholderType === 'title' || placeholderType === 'ctrTitle'
    const textBody = firstByLocalName(shape, 'txBody')
    if (!textBody) continue

    const paragraphs = allByLocalName(textBody, 'p')
      .map(parseParagraph)
      .filter((item): item is PptxTextItem => Boolean(item))

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
): Promise<PptxDeck> {
  const coreTitle = await getCoreTitle(zip)
  const slidePaths = await getSlidePaths(zip)
  const slides: PptxSlide[] = []

  for (let index = 0; index < slidePaths.length; index += 1) {
    slides.push(await parseSlide(zip, slidePaths[index], index + 1))
  }

  return {
    title: coreTitle || deckTitle || 'Slayt notu',
    slides,
  }
}

export async function readPptxFile(file: File): Promise<PptxDeck> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  return parsePptxArchive(zip, file.name.replace(/\.[^.]+$/, '') || 'Slayt notu')
}

export function slidesToBlocks(
  deck: PptxDeck,
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

import type JSZip from 'jszip'
import { newBlock } from './markdown'
import { escapeHtml, inlineMarkdownToHtml } from './sanitize'
import { normalizeTableRows } from './table'
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
  /** Slayttaki tablolar: tablo → satır → hücre. */
  tables?: string[][][]
}

export interface SlideDeck {
  title: string
  slides: Slide[]
  /** İçe aktarma sırasında oluşan, kullanıcıya gösterilecek uyarılar. */
  warnings?: string[]
  /** Slayt metni Markdown biçimlendirmesi içeriyor mu (AI çıktısı). */
  markdown?: boolean
}

const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

/** Alt bilgi, sayfa numarası ve tarih yer tutucuları nota dahil edilmez. */
const NOISE_PLACEHOLDERS = new Set(['sldNum', 'ftr', 'dt', 'hdr'])

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

function childByLocalName(parent: Element, name: string): Element | null {
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType !== 1) continue
    const element = node as Element
    if (element.localName === name) return element
  }
  return null
}

function childrenByLocalName(parent: Element, name: string): Element[] {
  const result: Element[] = []
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType !== 1) continue
    const element = node as Element
    if (element.localName === name) result.push(element)
  }
  return result
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
    attr(element, 'id', R_NS) ||
    attr(element, 'r:id') ||
    attr(element, 'id')
  )
}

function cleanText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const cleaned = cleanText(value)
    if (!cleaned || seen.has(cleaned)) continue
    seen.add(cleaned)
    result.push(cleaned)
  }
  return result
}

function resolveZipPath(baseDir: string, target: string): string {
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
  let text = ''
  for (const element of allByLocalName(paragraph, '*')) {
    if (element.localName === 't') text += element.textContent || ''
    else if (element.localName === 'br' || element.localName === 'tab') text += ' '
  }
  return cleanText(text)
}

function parseParagraph(paragraph: Element): SlideTextItem | null {
  const text = paragraphText(paragraph)
  if (!text) return null

  const properties = firstByLocalName(paragraph, 'pPr')
  return {
    text,
    bullet: hasBullet(properties),
    level: Math.max(0, Math.min(8, Number(attr(properties, 'lvl') || '0') || 0)),
  }
}

function parseTextBody(textBody: Element): SlideTextItem[] {
  return allByLocalName(textBody, 'p')
    .map(parseParagraph)
    .filter((item): item is SlideTextItem => Boolean(item))
}

function parseNotes(xml: string): string[] {
  const document = parseXml(xml)
  const paragraphs: string[] = []
  const shapes = allByLocalName(document, 'sp')

  if (shapes.length) {
    for (const shape of shapes) {
      const placeholder = firstByLocalName(shape, 'ph')
      const placeholderType = attr(placeholder, 'type')
      if (NOISE_PLACEHOLDERS.has(placeholderType)) continue

      const textBody = childByLocalName(shape, 'txBody') ?? firstByLocalName(shape, 'txBody')
      if (!textBody) continue
      for (const paragraph of allByLocalName(textBody, 'p')) {
        const text = paragraphText(paragraph)
        if (text) paragraphs.push(text)
      }
    }
  } else {
    for (const textBody of allByLocalName(document, 'txBody')) {
      for (const paragraph of allByLocalName(textBody, 'p')) {
        const text = paragraphText(paragraph)
        if (text) paragraphs.push(text)
      }
    }
  }

  return uniqueStrings(paragraphs)
}

interface SlideRelation {
  type: string
  target: string
}

async function readRelationships(zip: JSZip, relsPath: string): Promise<Map<string, SlideRelation>> {
  const result = new Map<string, SlideRelation>()
  const file = zip.file(relsPath)
  if (!file) return result

  const document = parseXml(await file.async('string'))
  for (const relationship of allByLocalName(document, 'Relationship')) {
    const id = attr(relationship, 'Id')
    const target = attr(relationship, 'Target')
    if (id && target) {
      result.set(id, { type: attr(relationship, 'Type'), target })
    }
  }
  return result
}

async function getSlideRelationships(zip: JSZip, slidePath: string): Promise<Map<string, SlideRelation>> {
  const slideName = slidePath.split('/').pop()
  if (!slideName) return new Map()
  const slideDir = slidePath.slice(0, slidePath.lastIndexOf('/'))
  return readRelationships(zip, `${slideDir}/_rels/${slideName}.rels`)
}

function findRelationshipTarget(
  relationships: Map<string, SlideRelation>,
  typeSuffix: string,
): string | null {
  for (const relationship of relationships.values()) {
    if (relationship.type.endsWith(typeSuffix)) return relationship.target
  }
  return null
}

async function getSlidePaths(zip: JSZip): Promise<string[]> {
  const presentationFile = zip.file('ppt/presentation.xml')
  if (presentationFile) {
    const presentation = parseXml(await presentationFile.async('string'))
    const relationships = await readRelationships(zip, 'ppt/_rels/presentation.xml.rels')

    const slideIds = allByLocalName(presentation, 'sldId')
    const paths = slideIds
      .map((slideId) => {
        const id = relationshipId(slideId)
        const relationship = id ? relationships.get(id) : undefined
        return relationship ? resolveZipPath('ppt', relationship.target) : null
      })
      .filter((path): path is string => Boolean(path))

    if (paths.length) return paths
  }

  return naturalSort(
    Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path)),
  )
}

async function getCoreTitle(zip: JSZip): Promise<string> {
  const coreFile = zip.file('docProps/core.xml')
  if (!coreFile) return ''

  const core = parseXml(await coreFile.async('string'))
  const titleElement = allByLocalName(core, 'title')[0]
  return cleanText(titleElement?.textContent)
}

interface SlideCollector {
  title: string
  items: SlideTextItem[]
  tables: string[][][]
  /** Slaytta resim var mı? (Metin çıkmayan görsel slaytları ayırt etmek için.) */
  hasVisual: boolean
}

function collectTextShape(shape: Element, collector: SlideCollector): void {
  const placeholder = firstByLocalName(shape, 'ph')
  const placeholderType = attr(placeholder, 'type')
  if (NOISE_PLACEHOLDERS.has(placeholderType)) return

  const textBody = childByLocalName(shape, 'txBody') ?? firstByLocalName(shape, 'txBody')
  if (!textBody) return

  const paragraphs = parseTextBody(textBody)
  if (!paragraphs.length) return

  if (placeholderType === 'title' || placeholderType === 'ctrTitle') {
    if (!collector.title) {
      collector.title = paragraphs[0].text
      collector.items.push(...paragraphs.slice(1))
    } else {
      collector.items.push(...paragraphs)
    }
    return
  }

  if (placeholderType === 'subTitle') {
    collector.items.push(...paragraphs.map((item) => ({ ...item, bullet: false })))
    return
  }

  collector.items.push(...paragraphs)
}

function parseTable(table: Element): string[][] {
  const rows: string[][] = []

  for (const row of childrenByLocalName(table, 'tr')) {
    const cells: string[] = []
    for (const cell of childrenByLocalName(row, 'tc')) {
      const text = allByLocalName(cell, 'p')
        .map(paragraphText)
        .filter(Boolean)
        .join(' ')
      cells.push(cleanText(text))
    }
    if (cells.some(Boolean)) rows.push(cells)
  }

  return rows
}

function extractChartItems(document: Document): SlideTextItem[] {
  const items: SlideTextItem[] = []

  const titles = uniqueStrings(
    allByLocalName(document, 't').map((node) => node.textContent ?? ''),
  ).slice(0, 8)
  for (const title of titles) {
    items.push({ text: title, bullet: false, level: 0 })
  }

  const seriesNames: string[] = []
  const categories: string[] = []
  const valueLines: string[] = []

  for (const series of allByLocalName(document, 'ser')) {
    const titleNode = childByLocalName(series, 'tx')
    let name = ''
    if (titleNode) {
      const richName = cleanText(
        allByLocalName(titleNode, 't')
          .map((node) => node.textContent ?? '')
          .join(' '),
      )
      const cachedName = cleanText(allByLocalName(titleNode, 'v')[0]?.textContent)
      name = richName || cachedName
      if (name) seriesNames.push(name)
    }

    const categoryNode = childByLocalName(series, 'cat')
    if (categoryNode) {
      for (const value of allByLocalName(categoryNode, 'v')) {
        const text = cleanText(value.textContent)
        if (text) categories.push(text)
      }
    }

    const valueNode = childByLocalName(series, 'val')
    if (valueNode) {
      const values = uniqueStrings(
        allByLocalName(valueNode, 'v').map((value) => value.textContent ?? ''),
      ).slice(0, 12)
      if (values.length) {
        valueLines.push(`${name || 'Seri'}: ${values.join(', ')}`)
      }
    }
  }

  if (seriesNames.length) {
    items.push({
      text: `Seriler: ${uniqueStrings(seriesNames).slice(0, 12).join(', ')}`,
      bullet: false,
      level: 0,
    })
  }
  if (categories.length) {
    items.push({
      text: `Kategoriler: ${uniqueStrings(categories).slice(0, 12).join(', ')}`,
      bullet: false,
      level: 0,
    })
  }
  if (valueLines.length) {
    items.push({
      text: `Değerler — ${valueLines.slice(0, 6).join('; ')}`,
      bullet: false,
      level: 0,
    })
  }

  return items
}

function collectPictureAltText(picture: Element, collector: SlideCollector): void {
  const properties = firstByLocalName(picture, 'cNvPr')
  const description = cleanText(attr(properties, 'descr') || attr(properties, 'title'))
  if (description.length < 5) return
  if (/^(resim|görsel|image|picture|photo|fotoğraf)\s*\d*$/i.test(description)) return
  collector.items.push({ text: `Görsel: ${description}`, bullet: false, level: 0 })
}

async function collectGraphicFrame(
  zip: JSZip,
  slidePath: string,
  relationships: Map<string, SlideRelation>,
  frame: Element,
  collector: SlideCollector,
): Promise<void> {
  const slideDir = slidePath.slice(0, slidePath.lastIndexOf('/'))

  const table = firstByLocalName(frame, 'tbl')
  if (table) {
    const rows = parseTable(table)
    if (rows.length) collector.tables.push(rows)
    return
  }

  const relIds = firstByLocalName(frame, 'relIds')
  if (relIds) {
    const dataId = attr(relIds, 'dm', R_NS) || attr(relIds, 'dm')
    const relationship = dataId ? relationships.get(dataId) : undefined
    if (relationship) {
      const file = zip.file(resolveZipPath(slideDir, relationship.target))
      if (file) {
        const data = parseXml(await file.async('string'))
        const texts = uniqueStrings(
          allByLocalName(data, 't').map((node) => node.textContent ?? ''),
        )
        for (const text of texts) {
          collector.items.push({ text, bullet: true, level: 0 })
        }
      }
    }
    return
  }

  const chartReference = firstByLocalName(frame, 'chart')
  if (chartReference) {
    const chartId = relationshipId(chartReference)
    const relationship = chartId ? relationships.get(chartId) : undefined
    if (relationship) {
      const file = zip.file(resolveZipPath(slideDir, relationship.target))
      if (file) {
        const chart = parseXml(await file.async('string'))
        collector.items.push(...extractChartItems(chart))
      }
    }
  }
}

async function collectShapeTree(
  zip: JSZip,
  slidePath: string,
  relationships: Map<string, SlideRelation>,
  parent: Element,
  collector: SlideCollector,
): Promise<void> {
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType !== 1) continue
    const element = node as Element

    switch (element.localName) {
      case 'sp':
        collectTextShape(element, collector)
        break
      case 'cxnSp':
        collectTextShape(element, collector)
        break
      case 'grpSp':
        await collectShapeTree(zip, slidePath, relationships, element, collector)
        break
      case 'graphicFrame':
        await collectGraphicFrame(zip, slidePath, relationships, element, collector)
        break
      case 'pic':
        collector.hasVisual = true
        collectPictureAltText(element, collector)
        break
      default:
        break
    }
  }
}

function pickFallbackTitle(items: SlideTextItem[]): string {
  const index = items.findIndex(
    (item) =>
      !item.bullet &&
      item.text.length <= 90 &&
      !/[.!?]$/.test(item.text) &&
      item.text.split(' ').length <= 12,
  )
  const candidateIndex = index >= 0 ? index : items.length ? 0 : -1
  if (candidateIndex < 0) return ''
  return items.splice(candidateIndex, 1)[0].text
}

interface ParsedSlide {
  slide: Slide
  hidden: boolean
  /** Slaytta metin dışında görsel içerik var mı? */
  hasVisual: boolean
}

async function parseSlide(
  zip: JSZip,
  slidePath: string,
  number: number,
): Promise<ParsedSlide> {
  const slideXml = await zip.file(slidePath)?.async('string')
  if (!slideXml) {
    return { slide: { number, title: '', items: [], notes: [] }, hidden: false, hasVisual: false }
  }

  const document = parseXml(slideXml)
  // Sunumda gizlenmiş slaytlar (<p:sld show="0">) nota dahil edilmez.
  const hidden = attr(document.documentElement, 'show') === '0'
  const relationships = await getSlideRelationships(zip, slidePath)
  const collector: SlideCollector = { title: '', items: [], tables: [], hasVisual: false }

  const shapeTree = firstByLocalName(document, 'spTree')
  if (shapeTree) {
    await collectShapeTree(zip, slidePath, relationships, shapeTree, collector)
  } else {
    for (const shape of allByLocalName(document, 'sp')) {
      collectTextShape(shape, collector)
    }
  }

  if (!collector.title) {
    collector.title = pickFallbackTitle(collector.items)
  }

  const notesTarget = findRelationshipTarget(relationships, '/notesSlide')
  const notesPath = notesTarget
    ? resolveZipPath(slidePath.slice(0, slidePath.lastIndexOf('/')), notesTarget)
    : null
  const notesFile = notesPath ? zip.file(notesPath) : null
  const notes = notesFile ? parseNotes(await notesFile.async('string')) : []

  return {
    slide: {
      number,
      title: collector.title,
      items: collector.items,
      notes,
      tables: collector.tables.length ? collector.tables : undefined,
    },
    hidden,
    hasVisual: collector.hasVisual,
  }
}

export async function parsePptxArchive(
  zip: JSZip,
  deckTitle = 'Slayt notu',
): Promise<SlideDeck> {
  const coreTitle = await getCoreTitle(zip)
  const slidePaths = await getSlidePaths(zip)
  const slides: Slide[] = []
  let skipped = 0
  let hiddenCount = 0
  let imageOnly = 0

  for (let index = 0; index < slidePaths.length; index += 1) {
    const { slide, hidden, hasVisual } = await parseSlide(zip, slidePaths[index], index + 1)

    if (hidden) {
      hiddenCount += 1
      continue
    }

    const hasContent =
      Boolean(slide.title) ||
      slide.items.length > 0 ||
      Boolean(slide.tables?.length) ||
      slide.notes.length > 0

    if (!hasContent) {
      if (hasVisual) imageOnly += 1
      else skipped += 1
      continue
    }

    if (!slide.title) slide.title = `Slayt ${slide.number}`
    slides.push(slide)
  }

  const warnings: string[] = []
  if (skipped) {
    warnings.push(`${skipped} slayt atlandı: seçilebilir metin bulunamadı.`)
  }
  if (imageOnly) {
    warnings.push(
      `${imageOnly} slayt yalnızca görsel içeriyor; metin çıkarılamadı (OCR yok).`,
    )
  }
  if (hiddenCount) {
    warnings.push(`${hiddenCount} gizli slayt atlandı.`)
  }

  return {
    title: coreTitle || deckTitle || 'Slayt notu',
    slides,
    warnings: warnings.length ? warnings : undefined,
  }
}

export async function readPptxFile(file: File): Promise<SlideDeck> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const deck = await parsePptxArchive(zip, file.name.replace(/\.[^.]+$/, '') || 'Slayt notu')
  if (!deck.slides.length) {
    throw new Error(
      'PPTX içinde okunabilir metin bulunamadı. Slaytlar yalnızca görsel içeriyor olabilir.',
    )
  }
  return deck
}

export interface PdfTextItem {
  str: string
  x: number
  y: number
  width?: number
  height?: number
  fontSize?: number
  fontName?: string
  /** pdf.js stillerinden gelen font ailesi (ör. "Arial-Bold"). */
  fontFamily?: string
  hasEOL?: boolean
}

export interface PdfLine {
  text: string
  x: number
  y: number
  fontSize: number
  /** Satırdaki metin kalın fontla yazılmış mı? */
  bold: boolean
  column: number
  gapBefore: number
}

const PDF_BULLET_MARKER = /^[\u2022\u25CF\u25CB\u25AA\u25AB\u25A0\u25A1\u2013\u2014\u2043\-\*]\s+/
const PDF_NUMBERED_MARKER = /^\d{1,2}[.)]\s+/
const PDF_PAGE_NUMBER = /^(?:sayfa\s*)?[-–—]?\s*\d{1,3}\s*(?:\/\s*\d{1,3})?$/i

function pdfListMatch(text: string): RegExpMatchArray | null {
  return text.match(PDF_BULLET_MARKER) ?? text.match(PDF_NUMBERED_MARKER)
}

function isBoldItem(item: PdfTextItem): boolean {
  return /bold|black|heavy|semibold|demi/i.test(item.fontFamily ?? '')
}

function fontSizeOf(item: PdfTextItem): number {
  if (item.fontSize && item.fontSize > 0) return item.fontSize
  if (item.height && item.height > 0) return item.height
  return 10
}

function itemWidth(item: PdfTextItem): number {
  if (item.width && item.width > 0) return item.width
  return Math.max(1, item.str.length * fontSizeOf(item) * 0.5)
}

function assignPdfColumns(lines: PdfLine[]): void {
  if (lines.length < 4) return

  const starts = Array.from(
    new Set(lines.map((line) => Math.round(line.x)).filter((value) => value >= 0)),
  ).sort((left, right) => left - right)
  if (starts.length < 2) return

  let bestGap = 0
  let boundary = 0
  for (let index = 0; index < starts.length - 1; index += 1) {
    const gap = starts[index + 1] - starts[index]
    if (gap > bestGap) {
      bestGap = gap
      boundary = (starts[index] + starts[index + 1]) / 2
    }
  }

  if (bestGap < 60) return

  const leftLines = lines.filter((line) => line.x < boundary)
  const rightLines = lines.filter((line) => line.x >= boundary)
  if (leftLines.length < 2 || rightLines.length < 2) return

  // Gerçek iki sütunda satırlar aynı hizalarda bulunur. Ortalanmış bir başlık
  // ile gövde metni yanlışlıkla iki sütun sanılmasın diye dikey örtüşme ara.
  const overlap = leftLines.filter((line) =>
    rightLines.some(
      (other) =>
        Math.abs(other.y - line.y) <=
        Math.max(other.fontSize, line.fontSize) * 1.2,
    ),
  ).length
  if (overlap < 2) return

  for (const line of lines) {
    line.column = line.x < boundary ? 0 : 1
  }
}

/** PDF metin parçalarını satırlara, satırları da sütun sırasına göre dizer. */
export function buildPdfLines(items: PdfTextItem[]): PdfLine[] {
  const usable = items
    .map((item) => ({
      ...item,
      str: cleanText(item.str),
      fontSize: fontSizeOf(item),
    }))
    .filter((item) => item.str)
  if (!usable.length) return []

  const sorted = [...usable].sort((left, right) => right.y - left.y || left.x - right.x)
  const rows: Array<{ y: number; fontSize: number; items: PdfTextItem[] }> = []

  for (const item of sorted) {
    const last = rows[rows.length - 1]
    const tolerance = Math.max(3, Math.max(last?.fontSize ?? 0, item.fontSize ?? 10) * 0.55)
    if (last && Math.abs(last.y - item.y) <= tolerance) {
      last.items.push(item)
      last.fontSize = Math.max(last.fontSize, item.fontSize ?? 10)
    } else {
      rows.push({ y: item.y, fontSize: item.fontSize ?? 10, items: [item] })
    }
  }

  const lines: PdfLine[] = []

  for (const row of rows) {
    const rowItems = [...row.items].sort((left, right) => left.x - right.x)
    let current: PdfTextItem[] = []
    let currentEnd = 0

    const flush = () => {
      if (!current.length) return
      const text = cleanText(current.map((item) => item.str).join(' '))
      if (text) {
        lines.push({
          text,
          x: current[0].x,
          y: row.y,
          fontSize: Math.max(...current.map((item) => fontSizeOf(item))),
          bold: current.some(isBoldItem),
          column: 0,
          gapBefore: 0,
        })
      }
      current = []
    }

    for (const item of rowItems) {
      if (!current.length) {
        current = [item]
        currentEnd = item.x + itemWidth(item)
        continue
      }

      const gap = item.x - currentEnd
      const threshold = Math.max(14, Math.max(fontSizeOf(item), row.fontSize) * 2.2)
      if (gap > threshold) {
        flush()
        current = [item]
        currentEnd = item.x + itemWidth(item)
      } else {
        current.push(item)
        currentEnd = Math.max(currentEnd, item.x + itemWidth(item))
      }
    }

    flush()
  }

  assignPdfColumns(lines)
  lines.sort((left, right) => left.column - right.column || right.y - left.y || left.x - right.x)

  let previous: PdfLine | null = null
  for (const line of lines) {
    line.gapBefore =
      previous && previous.column === line.column ? Math.max(0, previous.y - line.y) : 0
    previous = line
  }

  return lines
}

function isPdfPageNumber(line: PdfLine, allLines: PdfLine[], pageHeight: number): boolean {
  if (!PDF_PAGE_NUMBER.test(line.text)) return false
  if (!allLines.length) return false

  const ys = allLines.map((item) => item.y)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const bottomLimit =
    pageHeight > 0 ? minY + pageHeight * 0.12 : minY + Math.max(1, maxY - minY) * 0.12
  return line.y <= bottomLimit
}

function pickPdfTitle(lines: PdfLine[]): PdfLine | null {
  if (!lines.length) return null

  const fontSizes = lines.map((line) => line.fontSize).sort((left, right) => left - right)
  const median = fontSizes[Math.floor(fontSizes.length / 2)] || 10
  const largest = Math.max(...fontSizes)
  const ys = lines.map((line) => line.y)
  const top = Math.max(...ys)
  const bottom = Math.min(...ys)
  const topLimit = top - Math.max(1, top - bottom) * 0.45

  const candidates = lines
    .filter(
      (line) =>
        line.y >= topLimit && line.fontSize >= largest * 0.95 && line.text.length <= 140,
    )
    .sort((left, right) => right.fontSize - left.fontSize || right.y - left.y)

  if (largest >= median * 1.15 && candidates.length) {
    // Aynı boyuttaki adaylar arasında kalın yazılmış olanı başlık say.
    const boldCandidate = candidates.find((line) => line.bold)
    return boldCandidate ?? candidates[0]
  }
  return lines[0]
}

function pdfIndentLevel(x: number, minX: number, fontSize: number): number {
  const offset = x - minX
  if (offset > fontSize * 5) return 2
  if (offset > fontSize * 2.2) return 1
  return 0
}

function shouldMergePdfLine(previousLine: PdfLine, line: PdfLine, previousText: string): boolean {
  if (previousLine.column !== line.column) return false
  if (pdfListMatch(line.text)) return false
  if (line.gapBefore > Math.max(previousLine.fontSize, line.fontSize) * 1.7) return false
  if (/[.!?:;]$/.test(previousText)) return false
  const startsLowercase = /^[a-zçğıöşü]/.test(line.text)
  return startsLowercase || previousText.length > 55
}

/** Tekrar eden üst/alt bilgi satırlarını karşılaştırmak için metni sadeleştirir. */
function normalizeRunningText(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—|•·]+|[\s\-–—|•·]+$/g, '')
    .trim()
}

export interface PdfPageData {
  number: number
  items: PdfTextItem[]
  /** Sayfa yüksekliği (pdf.js viewport). Bilinmiyorsa 0. */
  height: number
}

/**
 * Sayfaların üst ve alt kenarında tekrar eden satırları (kurum adı, bölüm
 * başlığı, tarih vb.) bulur. En az 3 sayfada görünenler ayıklanır.
 */
export function collectRepeatedPdfLines(pages: PdfPageData[]): Set<string> {
  const repeated = new Set<string>()
  if (pages.length < 3) return repeated

  const pageNumbers = new Map<string, Set<number>>()

  for (const page of pages) {
    const lines = buildPdfLines(page.items)
    if (!lines.length) continue

    const ys = lines.map((line) => line.y)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const largest = Math.max(...lines.map((line) => line.fontSize))
    const height = page.height > 0 ? page.height : Math.max(1, maxY - minY)
    const bottomLimit = minY + height * 0.14
    const topLimit = maxY - height * 0.14

    const seen = new Set<string>()
    for (const line of lines) {
      if (line.y > bottomLimit && line.y < topLimit) continue
      // Sayfa başlığı büyük fontla yazılır; üst/alt bilgi sanılıp silinmesin.
      if (line.fontSize >= largest * 0.9) continue
      const key = normalizeRunningText(line.text)
      if (key.length < 3 || seen.has(key)) continue
      seen.add(key)

      const numbers = pageNumbers.get(key) ?? new Set<number>()
      numbers.add(page.number)
      pageNumbers.set(key, numbers)
    }
  }

  const threshold = Math.max(3, Math.ceil(pages.length * 0.6))
  for (const [key, numbers] of pageNumbers) {
    if (numbers.size >= threshold) repeated.add(key)
  }
  return repeated
}

/** Bir PDF sayfasının metin parçalarından slayt/not bölümü üretir. */
export function pdfPageToSlide(
  number: number,
  items: PdfTextItem[],
  pageHeight = 0,
  repeated: ReadonlySet<string> = new Set(),
): Slide {
  const allLines = buildPdfLines(items)
  const lines = allLines.filter(
    (line) =>
      !isPdfPageNumber(line, allLines, pageHeight) &&
      !repeated.has(normalizeRunningText(line.text)),
  )
  if (!lines.length) return { number, title: '', items: [], notes: [] }

  const titleLine = pickPdfTitle(lines)
  const title = titleLine
    ? titleLine.text.replace(PDF_BULLET_MARKER, '').replace(PDF_NUMBERED_MARKER, '').trim()
    : `Sayfa ${number}`
  const body = titleLine ? lines.filter((line) => line !== titleLine) : lines
  const bodyMinX = body.length ? Math.min(...body.map((line) => line.x)) : 0

  const result: SlideTextItem[] = []
  let previous: { item: SlideTextItem; line: PdfLine } | null = null

  for (const line of body) {
    const listMatch = pdfListMatch(line.text)
    const level = pdfIndentLevel(line.x, bodyMinX, line.fontSize)
    const text = listMatch ? line.text.slice(listMatch[0].length).trim() : line.text
    if (!text) continue

    if (
      !listMatch &&
      previous &&
      shouldMergePdfLine(previous.line, line, previous.item.text)
    ) {
      const hyphenated =
        /[a-zçğıöşü]-$/.test(previous.item.text) && /^[a-zçğıöşü]/.test(text)
      previous.item.text = hyphenated
        ? `${previous.item.text.slice(0, -1)}${text}`
        : cleanText(`${previous.item.text} ${text}`)
      previous.line = line
      continue
    }

    const item: SlideTextItem = { text, bullet: Boolean(listMatch), level }
    result.push(item)
    previous = { item, line }
  }

  return { number, title, items: result, notes: [] }
}

/** Eski API uyumluluğu: PDF metin parçalarını düz satırlara çevirir. */
export function groupPdfTextItems(items: PdfTextItem[]): string[] {
  return buildPdfLines(items).map((line) => line.text)
}

/** Eski API uyumluluğu: düz satırlardan slayt üretir. */
export function pdfLinesToSlide(number: number, lines: string[]): Slide {
  const usable = lines.map((line) => cleanText(line)).filter(Boolean)
  if (!usable.length) return { number, title: '', items: [], notes: [] }

  const title = usable[0]
  const items = usable.slice(1).map((line) => {
    const listMatch = pdfListMatch(line)
    return {
      text: listMatch ? line.slice(listMatch[0].length).trim() : line,
      bullet: Boolean(listMatch),
      level: 0,
    }
  })

  return { number, title, items, notes: [] }
}

interface PdfJsTextItem {
  str?: string
  transform?: number[]
  width?: number
  height?: number
  fontName?: string
  hasEOL?: boolean
}

export async function readPdfFile(file: File): Promise<SlideDeck> {
  const pdfjs = await import('pdfjs-dist')
  const workerModule = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')) as {
    default: string
  }
  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default

  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages: PdfPageData[] = []
  const slides: Slide[] = []
  let emptyPages = 0

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    const rawItems = content.items as PdfJsTextItem[]
    const styles = content.styles as Record<string, { fontFamily?: string }> | undefined
    const items: PdfTextItem[] = []

    for (const item of rawItems) {
      if (typeof item.str !== 'string' || !Array.isArray(item.transform)) continue
      const transform = item.transform
      const height = typeof item.height === 'number' ? item.height : 0
      const fontSize =
        height > 0
          ? height
          : Math.abs(transform[3] ?? 0) || Math.abs(transform[0] ?? 0) || 10
      items.push({
        str: item.str,
        x: transform[4] ?? 0,
        y: transform[5] ?? 0,
        width: item.width,
        height: item.height,
        fontSize,
        fontName: item.fontName,
        fontFamily: item.fontName ? styles?.[item.fontName]?.fontFamily : undefined,
        hasEOL: item.hasEOL,
      })
    }

    if (!items.some((item) => item.str.trim())) {
      emptyPages += 1
      continue
    }

    pages.push({ number: pageNumber, items, height: viewport.height })
  }

  const repeated = collectRepeatedPdfLines(pages)
  for (const page of pages) {
    const slide = pdfPageToSlide(page.number, page.items, page.height, repeated)
    if (slide.items.length || slide.title) slides.push(slide)
  }

  if (!slides.length) {
    throw new Error(
      'PDF’te seçilebilir metin bulunamadı. Taranmış bir PDF olabilir; bu sürümde OCR yok. ' +
        'Metin içeren bir PDF ile tekrar dene.',
    )
  }

  const warnings: string[] = []
  if (emptyPages) {
    warnings.push(
      `${emptyPages} sayfa atlandı: seçilebilir metin yok (taranmış sayfa olabilir).`,
    )
  }

  return {
    title: file.name.replace(/\.[^.]+$/, '') || 'PDF notu',
    slides,
    warnings: warnings.length ? warnings : undefined,
  }
}

function textToHtml(text: string, markdown: boolean): string {
  return markdown ? inlineMarkdownToHtml(text) : escapeHtml(text)
}

function pushTableBlock(blocks: Block[], table: string[][]): void {
  const rows = normalizeTableRows(table)
  const hasContent = rows.some((row) => row.some((cell) => cell.trim()))
  if (hasContent) blocks.push(newBlock('table', { rows, headerRow: true }))
}

export function slidesToBlocks(
  deck: SlideDeck,
  mode: 'sections' | 'single',
  includeNotes = true,
): Block[] {
  const markdown = Boolean(deck.markdown)
  const blocks: Block[] = [
    newBlock('heading1', { html: escapeHtml(deck.title || 'Slayt notu') }),
  ]

  if (mode === 'sections') {
    for (const slide of deck.slides) {
      blocks.push(newBlock('heading2', { html: textToHtml(slide.title, markdown) }))

      for (const item of slide.items) {
        blocks.push(
          newBlock(item.bullet ? 'bulleted' : 'paragraph', {
            html: textToHtml(item.text, markdown),
          }),
        )
      }

      for (const table of slide.tables ?? []) {
        pushTableBlock(blocks, table)
      }

      if (includeNotes && slide.notes.length) {
        blocks.push(
          newBlock('quote', {
            html: textToHtml(slide.notes.join(' '), markdown),
          }),
        )
      }
    }
  } else {
    for (const slide of deck.slides) {
      if (slide.title) {
        blocks.push(
          newBlock('paragraph', {
            html: `<strong>${textToHtml(slide.title, markdown)}</strong>`,
          }),
        )
      }

      for (const item of slide.items) {
        blocks.push(
          newBlock(item.bullet ? 'bulleted' : 'paragraph', {
            html: textToHtml(item.text, markdown),
          }),
        )
      }

      for (const table of slide.tables ?? []) {
        pushTableBlock(blocks, table)
      }

      if (includeNotes && slide.notes.length) {
        blocks.push(
          newBlock('quote', {
            html: textToHtml(slide.notes.join(' '), markdown),
          }),
        )
      }
    }
  }

  if (deck.warnings?.length) {
    blocks.push(
      newBlock('callout', {
        emoji: '⚠️',
        html: escapeHtml(deck.warnings.join(' ')),
      }),
    )
  }

  if (blocks.length === 1) {
    blocks.push(
      newBlock('paragraph', {
        html: 'Bu sunumdan metin çıkarılamadı.',
      }),
    )
  }

  return blocks
}

export type PptxTextItem = SlideTextItem
export type PptxSlide = Slide
export type PptxDeck = SlideDeck

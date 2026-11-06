import type { Block, BlockType, Note } from '../types'
import { createId } from './id'
import { escapeHtml, htmlToMarkdown, inlineMarkdownToHtml } from './sanitize'

const HEADING_PATTERN = /^(#{1,3})\s+(.*)$/
const TODO_PATTERN = /^\s*[-*+]\s+\[([ xX])]\s+(.*)$/
const BULLET_PATTERN = /^\s*[-*+]\s+(.*)$/
const NUMBERED_PATTERN = /^\s*\d+[.)]\s+(.*)$/
const QUOTE_PATTERN = /^>\s?(.*)$/
const IMAGE_PATTERN = /^!\[(.*?)]\((.*?)\)\s*$/
const DIVIDER_PATTERN = /^\s*(---|\*\*\*|___)\s*$/
const FENCE_PATTERN = /^\s*```(.*)$/

export function newBlock(type: BlockType, patch: Partial<Block> = {}): Block {
  return {
    id: createId('b'),
    type,
    html: '',
    ...patch,
  }
}

export function blocksFromPlainText(text: string): Block[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return [newBlock('paragraph')]

  return normalized.split('\n').map((line) => {
    if (!line.trim()) return newBlock('paragraph')
    return newBlock('paragraph', { html: escapeHtml(line) })
  })
}

export function markdownToBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index += 1
      continue
    }

    const fence = line.match(FENCE_PATTERN)
    if (fence) {
      const language = fence[1].trim()
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        codeLines.push(lines[index])
        index += 1
      }
      index += 1
      blocks.push(
        newBlock('code', {
          html: escapeHtml(codeLines.join('\n')),
          language: language || 'text',
        }),
      )
      continue
    }

    const heading = line.match(HEADING_PATTERN)
    if (heading) {
      const type = (['heading1', 'heading2', 'heading3'] as const)[heading[1].length - 1]
      blocks.push(newBlock(type, { html: inlineMarkdownToHtml(heading[2]) }))
      index += 1
      continue
    }

    if (DIVIDER_PATTERN.test(line)) {
      blocks.push(newBlock('divider'))
      index += 1
      continue
    }

    const image = line.match(IMAGE_PATTERN)
    if (image) {
      blocks.push(newBlock('image', { src: image[2], caption: image[1] }))
      index += 1
      continue
    }

    const todo = line.match(TODO_PATTERN)
    if (todo) {
      blocks.push(
        newBlock('todo', {
          html: inlineMarkdownToHtml(todo[2]),
          checked: todo[1].toLowerCase() === 'x',
        }),
      )
      index += 1
      continue
    }

    const bullet = line.match(BULLET_PATTERN)
    if (bullet) {
      blocks.push(newBlock('bulleted', { html: inlineMarkdownToHtml(bullet[1]) }))
      index += 1
      continue
    }

    const numbered = line.match(NUMBERED_PATTERN)
    if (numbered) {
      blocks.push(newBlock('numbered', { html: inlineMarkdownToHtml(numbered[1]) }))
      index += 1
      continue
    }

    const quote = line.match(QUOTE_PATTERN)
    if (quote) {
      blocks.push(newBlock('quote', { html: inlineMarkdownToHtml(quote[1]) }))
      index += 1
      continue
    }

    // Paragraf: boş satıra veya yeni bir blok işaretine kadar birleştir.
    const paragraph: string[] = [line]
    index += 1
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraph.push(lines[index])
      index += 1
    }
    blocks.push(
      newBlock('paragraph', {
        html: paragraph.map((item) => inlineMarkdownToHtml(item)).join('<br>'),
      }),
    )
  }

  return blocks.length ? blocks : [newBlock('paragraph')]
}

function isBlockStart(line: string): boolean {
  return (
    HEADING_PATTERN.test(line) ||
    TODO_PATTERN.test(line) ||
    BULLET_PATTERN.test(line) ||
    NUMBERED_PATTERN.test(line) ||
    QUOTE_PATTERN.test(line) ||
    IMAGE_PATTERN.test(line) ||
    DIVIDER_PATTERN.test(line) ||
    FENCE_PATTERN.test(line)
  )
}

export function blockToMarkdown(block: Block): string {
  const text = htmlToMarkdown(block.html)
  const emoji = block.emoji ?? '💡'

  switch (block.type) {
    case 'heading1':
      return `# ${text}`
    case 'heading2':
      return `## ${text}`
    case 'heading3':
      return `### ${text}`
    case 'bulleted':
      return `- ${text}`
    case 'numbered':
      return `1. ${text}`
    case 'todo':
      return `- [${block.checked ? 'x' : ' '}] ${text}`
    case 'quote':
      return `> ${text.replace(/\n/g, '\n> ')}`
    case 'callout':
      return `> ${emoji} ${text.replace(/\n/g, '\n> ')}`
    case 'code':
      return `\`\`\`${block.language ?? ''}\n${text}\n\`\`\``
    case 'divider':
      return '---'
    case 'image':
      return block.src ? `![${block.caption ?? ''}](${block.src})` : ''
    default:
      return text
  }
}

export function noteToMarkdown(note: Note): string {
  const body = note.blocks
    .map(blockToMarkdown)
    .filter(Boolean)
    .join('\n\n')

  return [`# ${note.title || 'Başlıksız'}`, '', body, ''].join('\n').replace(/\n{3,}/g, '\n\n')
}

export function noteToPlainText(note: Note): string {
  return note.blocks.map((block) => htmlToMarkdown(block.html)).filter(Boolean).join('\n')
}

export function slugify(value: string): string {
  const map: Record<string, string> = {
    ç: 'c',
    ğ: 'g',
    ı: 'i',
    ö: 'o',
    ş: 's',
    ü: 'u',
    Ç: 'c',
    Ğ: 'g',
    İ: 'i',
    Ö: 'o',
    Ş: 's',
    Ü: 'u',
  }

  return (
    value
      .split('')
      .map((char) => map[char] ?? char)
      .join('')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'bloknot'
  )
}

export function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

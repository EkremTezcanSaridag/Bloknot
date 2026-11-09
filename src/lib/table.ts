import type { Block } from '../types'

export const MAX_TABLE_ROWS = 50
export const MAX_TABLE_COLUMNS = 12
export const MAX_CELL_LENGTH = 500

/** Yeni tablolar 2 satır × 2 sütun olarak açılır. */
export function defaultTableRows(): string[][] {
  return [
    ['', ''],
    ['', ''],
  ]
}

/** Herhangi bir girdiyi güvenli, dikdörtgen bir hücre ızgarasına çevirir. */
export function normalizeTableRows(raw: unknown): string[][] {
  const source = Array.isArray(raw) ? raw : []
  const rows: string[][] = []

  for (const rawRow of source.slice(0, MAX_TABLE_ROWS)) {
    const cells = Array.isArray(rawRow) ? rawRow : []
    const row: string[] = []
    for (const cell of cells.slice(0, MAX_TABLE_COLUMNS)) {
      row.push(typeof cell === 'string' ? cell.replace(/\r?\n/g, ' ').slice(0, MAX_CELL_LENGTH) : '')
    }
    rows.push(row)
  }

  if (!rows.length) return defaultTableRows()

  // Satırları en geniş satıra göre tamamla; tablo her zaman dikdörtgen kalsın.
  const width = Math.max(1, Math.min(MAX_TABLE_COLUMNS, Math.max(...rows.map((row) => row.length))))
  return rows.map((row) => {
    const next = row.slice(0, width)
    while (next.length < width) next.push('')
    return next
  })
}

export function addTableRow(rows: string[][]): string[][] {
  const normalized = normalizeTableRows(rows)
  if (normalized.length >= MAX_TABLE_ROWS) return normalized
  return [...normalized, normalized[0].map(() => '')]
}

export function addTableColumn(rows: string[][]): string[][] {
  const normalized = normalizeTableRows(rows)
  if (normalized[0].length >= MAX_TABLE_COLUMNS) return normalized
  return normalized.map((row) => [...row, ''])
}

export function removeTableRow(rows: string[][], index: number): string[][] {
  const normalized = normalizeTableRows(rows)
  if (normalized.length <= 1) return normalized.map((row) => row.map(() => ''))
  return normalized.filter((_, rowIndex) => rowIndex !== index)
}

export function removeTableColumn(rows: string[][], index: number): string[][] {
  const normalized = normalizeTableRows(rows)
  if (normalized[0].length <= 1) return normalized.map(() => [''])
  return normalized.map((row) => row.filter((_, columnIndex) => columnIndex !== index))
}

export function setTableCell(rows: string[][], row: number, column: number, value: string): string[][] {
  const normalized = normalizeTableRows(rows)
  if (!normalized[row] || normalized[row][column] === undefined) return normalized

  return normalized.map((item, rowIndex) =>
    rowIndex === row
      ? item.map((cell, columnIndex) =>
          columnIndex === column ? value.replace(/\r?\n/g, ' ').slice(0, MAX_CELL_LENGTH) : cell,
        )
      : item,
  )
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').trim()
}

/** GFM tablo metni üretir. */
export function tableToMarkdown(block: Pick<Block, 'rows' | 'headerRow'>): string {
  const rows = normalizeTableRows(block.rows)
  const header = block.headerRow === false ? rows[0].map(() => '') : rows[0]
  const body = block.headerRow === false ? rows : rows.slice(1)
  const width = rows[0].length

  const line = (cells: string[]) => `| ${cells.map(escapeCell).join(' | ')} |`
  const divider = `| ${Array.from({ length: width }, () => '---').join(' | ')} |`

  return [line(header), divider, ...body.map(line)].join('\n')
}

/** `| a | b |` satırlarını hücrelere ayırır. */
export function parseTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  const cells: string[] = []
  let current = ''
  let escaped = false

  for (const char of trimmed) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === '|') {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += char
  }

  cells.push(current.trim())
  return cells
}

const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)+\|?\s*$/

export function isTableDivider(line: string): boolean {
  return TABLE_DIVIDER.test(line)
}

export function isTableLine(line: string): boolean {
  return line.includes('|') && line.trim().length > 1
}

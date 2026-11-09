import { describe, expect, it } from 'vitest'
import {
  MAX_TABLE_COLUMNS,
  addTableColumn,
  addTableRow,
  defaultTableRows,
  normalizeTableRows,
  parseTableRow,
  removeTableColumn,
  removeTableRow,
  setTableCell,
  tableToMarkdown,
} from './table'
import { blockToMarkdown, markdownToBlocks } from './markdown'

describe('normalizeTableRows', () => {
  it('eksik hücreleri tamamlayıp dikdörtgen üretir', () => {
    const rows = normalizeTableRows([['a'], ['b', 'c', 'd']])
    expect(rows).toEqual([
      ['a', '', ''],
      ['b', 'c', 'd'],
    ])
  })

  it('boş girdide varsayılan tabloyu döndürür', () => {
    expect(normalizeTableRows(undefined)).toEqual(defaultTableRows())
    expect(normalizeTableRows([])).toEqual(defaultTableRows())
  })

  it('satır sonlarını boşluğa çevirir ve sütun sayısını sınırlar', () => {
    const wide = normalizeTableRows([Array.from({ length: 30 }, (_, i) => `h${i}`)])
    expect(wide[0]).toHaveLength(MAX_TABLE_COLUMNS)
    expect(normalizeTableRows([['bir\niki']])[0][0]).toBe('bir iki')
  })
})

describe('tablo düzenleme', () => {
  it('satır ve sütun ekler', () => {
    const rows = addTableRow(addTableColumn(defaultTableRows()))
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveLength(3)
  })

  it('son satır ve sütunu silerken en az bir hücre bırakır', () => {
    const single = [['x']]
    expect(removeTableRow(single, 0)).toEqual([['']])
    expect(removeTableColumn(single, 0)).toEqual([['']])

    const rows = [
      ['a', 'b'],
      ['c', 'd'],
    ]
    expect(removeTableRow(rows, 1)).toEqual([['a', 'b']])
    expect(removeTableColumn(rows, 0)).toEqual([['b'], ['d']])
  })

  it('tek hücreyi günceller', () => {
    const rows = setTableCell(
      [
        ['a', 'b'],
        ['c', 'd'],
      ],
      1,
      0,
      'yeni',
    )
    expect(rows[1][0]).toBe('yeni')
    expect(rows[0][0]).toBe('a')
  })
})

describe('tablo markdown', () => {
  it('GFM tablosu üretir', () => {
    const markdown = tableToMarkdown({
      rows: [
        ['Ad', 'Not'],
        ['Efe', 'İyi'],
      ],
      headerRow: true,
    })
    expect(markdown).toBe('| Ad | Not |\n| --- | --- |\n| Efe | İyi |')
  })

  it('hücrelerdeki boru karakterini kaçırır', () => {
    const markdown = tableToMarkdown({ rows: [['a|b']], headerRow: true })
    expect(markdown).toContain('a\\|b')
  })

  it('markdown tablosunu bloklara geri çevirir', () => {
    const blocks = markdownToBlocks('| Ad | Not |\n| --- | --- |\n| Efe | İyi |')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('table')
    expect(blocks[0].rows).toEqual([
      ['Ad', 'Not'],
      ['Efe', 'İyi'],
    ])
    expect(blocks[0].headerRow).toBe(true)
  })

  it('markdown gidiş-dönüşü içeriği korur', () => {
    const block = {
      id: 'b1',
      type: 'table' as const,
      html: '',
      rows: [
        ['Ürün', 'Fiyat'],
        ['Kalem', '10'],
      ],
      headerRow: true,
    }
    const markdown = blockToMarkdown(block)
    const [parsed] = markdownToBlocks(markdown)
    expect(parsed.type).toBe('table')
    expect(parsed.rows).toEqual(block.rows)
  })

  it('kaçışlı boruları ayrıştırır', () => {
    expect(parseTableRow('| a\\|b | c |')).toEqual(['a|b', 'c'])
  })
})

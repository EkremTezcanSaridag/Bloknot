import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { parseDocxArchive } from './docx'

const NS = `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"`

function wrapDocument(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}><w:body>${body}</w:body></w:document>`
}

function paragraph(text: string, options: { style?: string; bullet?: boolean } = {}): string {
  const properties = [
    options.style ? `<w:pStyle w:val="${options.style}"/>` : '',
    options.bullet ? '<w:numPr><w:ilvl w:val="0"/></w:numPr>' : '',
  ].join('')
  return `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ''}<w:r><w:t>${text}</w:t></w:r></w:p>`
}

const table = `<w:tbl>
  <w:tr>
    <w:tc><w:p><w:r><w:t>Organel</w:t></w:r></w:p></w:tc>
    <w:tc><w:p><w:r><w:t>Görev</w:t></w:r></w:p></w:tc>
  </w:tr>
  <w:tr>
    <w:tc><w:p><w:r><w:t>Mitokondri</w:t></w:r></w:p></w:tc>
    <w:tc><w:p><w:r><w:t>Enerji</w:t></w:r></w:p></w:tc>
  </w:tr>
</w:tbl>`

describe('docx çıkarımı', () => {
  it('başlıklardan slayt böler, maddeleri ve tabloları toplar', async () => {
    const zip = new JSZip()
    zip.file(
      'word/document.xml',
      wrapDocument(`
        ${paragraph('Giriş', { style: 'Heading1' })}
        ${paragraph('Birinci madde', { bullet: true })}
        ${paragraph('Tablo', { style: 'Heading1' })}
        ${table}
        ${paragraph('Kapanış paragrafı')}
      `),
    )

    const deck = await parseDocxArchive(zip, 'Belge')

    expect(deck.slides).toHaveLength(2)
    expect(deck.slides[0].title).toBe('Giriş')
    expect(deck.slides[0].items).toEqual([
      { text: 'Birinci madde', bullet: true, level: 0 },
    ])
    expect(deck.slides[1].title).toBe('Tablo')
    expect(deck.slides[1].tables?.[0]).toEqual([
      ['Organel', 'Görev'],
      ['Mitokondri', 'Enerji'],
    ])
    expect(deck.slides[1].items[0].text).toBe('Kapanış paragrafı')
  })

  it('çekirdek özelliklerdeki belge başlığını kullanır', async () => {
    const zip = new JSZip()
    zip.file('word/document.xml', wrapDocument(paragraph('Metin')))
    zip.file(
      'docProps/core.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>Biyoloji Notları</dc:title>
</cp:coreProperties>`,
    )

    const deck = await parseDocxArchive(zip, 'Belge')

    expect(deck.title).toBe('Biyoloji Notları')
  })

  it('başlık stili yoksa ilk paragrafı slayt başlığı yapar', async () => {
    const zip = new JSZip()
    zip.file(
      'word/document.xml',
      wrapDocument(`
        ${paragraph('Belge başlığı')}
        ${paragraph('İlk paragraf')}
        ${paragraph('İkinci paragraf')}
      `),
    )

    const deck = await parseDocxArchive(zip, 'Belge')

    expect(deck.slides).toHaveLength(1)
    expect(deck.slides[0].title).toBe('Belge başlığı')
    expect(deck.slides[0].items.map((item) => item.text)).toEqual([
      'İlk paragraf',
      'İkinci paragraf',
    ])
  })

  it('görselleri atladığını uyarıyla bildirir', async () => {
    const zip = new JSZip()
    zip.file(
      'word/document.xml',
      wrapDocument(
        `<w:p><w:r><w:drawing/></w:r><w:r><w:t>Görselli paragraf</w:t></w:r></w:p>`,
      ),
    )

    const deck = await parseDocxArchive(zip, 'Belge')

    expect(deck.slides).toHaveLength(1)
    expect(deck.warnings?.[0]).toContain('görseller nota eklenmedi')
  })

  it('boş belgede okunabilir metin hatası verir', async () => {
    const zip = new JSZip()
    zip.file('word/document.xml', wrapDocument(''))

    await expect(parseDocxArchive(zip, 'Belge')).rejects.toThrow('okunabilir metin')
  })
})

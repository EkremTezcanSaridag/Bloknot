import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import {
  buildPdfLines,
  collectRepeatedPdfLines,
  groupPdfTextItems,
  parsePptxArchive,
  pdfPageToSlide,
  slidesToBlocks,
  type PdfPageData,
} from './slides'

const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title"/>
          <p:cNvSpPr/>
          <p:nvPr><a:ph type="title"/></p:nvPr>
        </p:nvSpPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p><a:r><a:t>Başlık</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Content"/>
          <p:cNvSpPr/>
          <p:nvPr><a:ph type="body"/></p:nvPr>
        </p:nvSpPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:pPr lvl="0"><a:buChar char="•"/></a:pPr>
            <a:r><a:t>Madde 1</a:t></a:r>
          </a:p>
          <a:p><a:r><a:t>Düz metin</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`

describe('pptx', () => {
  it('slayt başlığını ve maddeleri çıkarır', async () => {
    const zip = new JSZip()
    zip.file('ppt/slides/slide1.xml', slideXml)

    const deck = await parsePptxArchive(zip, 'Sunum')

    expect(deck.title).toBe('Sunum')
    expect(deck.slides).toHaveLength(1)
    expect(deck.slides[0].title).toBe('Başlık')
    expect(deck.slides[0].items).toEqual([
      { text: 'Madde 1', bullet: true, level: 0 },
      { text: 'Düz metin', bullet: false, level: 0 },
    ])
  })

  it('konuşmacı notlarını çıkarır', async () => {
    const zip = new JSZip()
    zip.file('ppt/slides/slide1.xml', slideXml)
    zip.file(
      'ppt/slides/_rels/slide1.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/>
</Relationships>`,
    )
    zip.file(
      'ppt/notesSlides/notesSlide1.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Konuşmacı notu</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:notes>`,
    )

    const deck = await parsePptxArchive(zip, 'Sunum')

    expect(deck.slides[0].notes).toEqual(['Konuşmacı notu'])
  })

  it('slayt başına bölüm blokları üretir', () => {
    const blocks = slidesToBlocks(
      {
        title: 'Sunum',
        slides: [
          {
            number: 1,
            title: 'Başlık',
            items: [
              { text: 'Madde 1', bullet: true, level: 0 },
              { text: 'Düz metin', bullet: false, level: 0 },
            ],
            notes: ['Not'],
          },
        ],
      },
      'sections',
      true,
    )

    expect(blocks.map((block) => block.type)).toEqual([
      'heading1',
      'heading2',
      'bulleted',
      'paragraph',
      'quote',
    ])
  })

  it('tüm metni tek notta toplar', () => {
    const blocks = slidesToBlocks(
      {
        title: 'Sunum',
        slides: [
          {
            number: 1,
            title: 'Başlık',
            items: [{ text: 'Madde 1', bullet: true, level: 0 }],
            notes: [],
          },
        ],
      },
      'single',
      false,
    )

    expect(blocks.map((block) => block.type)).toEqual(['heading1', 'paragraph', 'bulleted'])
    expect(blocks[1].html).toContain('Başlık')
  })
})

const NS = `xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`

function wrapSlide(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld ${NS}><p:cSld><p:spTree>${body}</p:spTree></p:cSld></p:sld>`
}

function textShape(placeholder: string, text: string, bullet = false): string {
  return `<p:sp>
  <p:nvSpPr><p:cNvPr id="2" name="Shape"/><p:cNvSpPr/><p:nvPr><a:ph type="${placeholder}"/></p:nvPr></p:nvSpPr>
  <p:txBody><a:bodyPr/><a:lstStyle/>
    <a:p>${bullet ? '<a:pPr><a:buChar char="•"/></a:pPr>' : ''}<a:r><a:t>${text}</a:t></a:r></a:p>
  </p:txBody>
</p:sp>`
}

describe('pptx gelişmiş çıkarım', () => {
  it('grup şekillerini, alt başlığı ve gürültü yer tutucularını yönetir', async () => {
    const zip = new JSZip()
    zip.file(
      'ppt/slides/slide1.xml',
      wrapSlide(`
        ${textShape('title', 'Gerçek başlık')}
        ${textShape('subTitle', 'Alt başlık')}
        <p:grpSp>
          <p:grpSpPr/>
          ${textShape('body', 'Grup maddesi', true)}
        </p:grpSp>
        ${textShape('sldNum', '12')}
        ${textShape('ftr', 'Şirket adı')}
      `),
    )

    const deck = await parsePptxArchive(zip, 'Sunum')

    expect(deck.slides[0].title).toBe('Gerçek başlık')
    expect(deck.slides[0].items).toEqual([
      { text: 'Alt başlık', bullet: false, level: 0 },
      { text: 'Grup maddesi', bullet: true, level: 0 },
    ])
  })

  it('tablo hücrelerini çıkarır ve tablo bloğu üretir', async () => {
    const zip = new JSZip()
    zip.file(
      'ppt/slides/slide1.xml',
      wrapSlide(`
        ${textShape('title', 'Puan tablosu')}
        <p:graphicFrame>
          <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
            <a:tbl>
              <a:tr>
                <a:tc><a:txBody><a:p><a:r><a:t>Ad</a:t></a:r></a:p></a:txBody></a:tc>
                <a:tc><a:txBody><a:p><a:r><a:t>Puan</a:t></a:r></a:p></a:txBody></a:tc>
              </a:tr>
              <a:tr>
                <a:tc><a:txBody><a:p><a:r><a:t>Ali</a:t></a:r></a:p></a:txBody></a:tc>
                <a:tc><a:txBody><a:p><a:r><a:t>90</a:t></a:r></a:p></a:txBody></a:tc>
              </a:tr>
            </a:tbl>
          </a:graphicData></a:graphic>
        </p:graphicFrame>
      `),
    )

    const deck = await parsePptxArchive(zip, 'Sunum')

    expect(deck.slides[0].tables).toEqual([
      [
        ['Ad', 'Puan'],
        ['Ali', '90'],
      ],
    ])

    const blocks = slidesToBlocks(deck, 'sections', false)
    expect(blocks.map((block) => block.type)).toEqual(['heading1', 'heading2', 'table'])
    expect(blocks[2].rows).toEqual([
      ['Ad', 'Puan'],
      ['Ali', '90'],
    ])
  })

  it('SmartArt veri parçasındaki metni okur', async () => {
    const zip = new JSZip()
    zip.file(
      'ppt/slides/slide1.xml',
      wrapSlide(`
        ${textShape('title', 'Süreç')}
        <p:graphicFrame>
          <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram">
            <dgm:relIds xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram"
              xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
              r:dm="rId5"/>
          </a:graphicData></a:graphic>
        </p:graphicFrame>
      `),
    )
    zip.file(
      'ppt/slides/_rels/slide1.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData" Target="../diagrams/data1.xml"/>
</Relationships>`,
    )
    zip.file(
      'ppt/diagrams/data1.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <dgm:ptLst><dgm:pt><dgm:t><a:p><a:r><a:t>Fikir</a:t></a:r></a:p></dgm:t></dgm:pt></dgm:ptLst>
</dgm:dataModel>`,
    )

    const deck = await parsePptxArchive(zip, 'Sunum')

    expect(deck.slides[0].items).toContainEqual({ text: 'Fikir', bullet: true, level: 0 })
  })

  it('grafik başlığını, seri ve kategori adlarını okur', async () => {
    const zip = new JSZip()
    zip.file(
      'ppt/slides/slide1.xml',
      wrapSlide(`
        ${textShape('title', 'Satış grafiği')}
        <p:graphicFrame>
          <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
            <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
              xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
              r:id="rId6"/>
          </a:graphicData></a:graphic>
        </p:graphicFrame>
      `),
    )
    zip.file(
      'ppt/slides/_rels/slide1.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
</Relationships>`,
    )
    zip.file(
      'ppt/charts/chart1.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <c:chart>
    <c:title><c:tx><c:rich><a:p><a:r><a:t>Satışlar</a:t></a:r></a:p></c:rich></c:tx></c:title>
    <c:plotArea><c:barChart><c:ser>
      <c:tx><c:strRef><c:strCache><c:pt><c:v>Ürün A</c:v></c:pt></c:strCache></c:strRef></c:tx>
      <c:cat><c:strRef><c:strCache>
        <c:pt><c:v>Ocak</c:v></c:pt><c:pt><c:v>Şubat</c:v></c:pt>
      </c:strCache></c:strRef></c:cat>
      <c:val><c:numRef><c:numCache>
        <c:pt><c:v>10</c:v></c:pt><c:pt><c:v>20</c:v></c:pt>
      </c:numCache></c:numRef></c:val>
    </c:ser></c:barChart></c:plotArea>
  </c:chart>
</c:chartSpace>`,
    )

    const deck = await parsePptxArchive(zip, 'Sunum')
    const texts = deck.slides[0].items.map((item) => item.text)

    expect(texts).toContain('Satışlar')
    expect(texts).toContain('Seriler: Ürün A')
    expect(texts).toContain('Kategoriler: Ocak, Şubat')
    expect(texts).toContain('Değerler — Ürün A: 10, 20')
  })

  it('metin bulunamayan slaytları atlar ve uyarı ekler', async () => {
    const zip = new JSZip()
    zip.file('ppt/slides/slide1.xml', wrapSlide(textShape('title', 'Dolu slayt')))
    zip.file('ppt/slides/slide2.xml', wrapSlide(''))

    const deck = await parsePptxArchive(zip, 'Sunum')

    expect(deck.slides).toHaveLength(1)
    expect(deck.warnings?.[0]).toContain('1 slayt atlandı')
  })

  it('gizli slaytları atlar ve uyarı ekler', async () => {
    const zip = new JSZip()
    zip.file('ppt/slides/slide1.xml', wrapSlide(textShape('title', 'Görünür slayt')))
    zip.file(
      'ppt/slides/slide2.xml',
      wrapSlide(textShape('title', 'Gizli slayt')).replace('<p:sld ', '<p:sld show="0" '),
    )

    const deck = await parsePptxArchive(zip, 'Sunum')

    expect(deck.slides).toHaveLength(1)
    expect(deck.slides[0].title).toBe('Görünür slayt')
    expect(deck.warnings?.some((warning) => warning.includes('1 gizli slayt atlandı'))).toBe(true)
  })
})

describe('pdf çıkarımı', () => {
  it('başlığı font boyutundan seçer, satır kaydırmalarını birleştirir', () => {
    const slide = pdfPageToSlide(
      1,
      [
        { str: 'Büyük Başlık', x: 50, y: 700, fontSize: 24 },
        { str: '• Birinci madde', x: 50, y: 650, fontSize: 12 },
        { str: 'devam eden satır', x: 50, y: 632, fontSize: 12 },
        { str: '• İkinci madde', x: 50, y: 600, fontSize: 12 },
        { str: '1. Numaralı madde', x: 50, y: 570, fontSize: 12 },
        { str: '1', x: 300, y: 20, fontSize: 10 },
      ],
      800,
    )

    expect(slide.title).toBe('Büyük Başlık')
    expect(slide.items).toEqual([
      { text: 'Birinci madde devam eden satır', bullet: true, level: 0 },
      { text: 'İkinci madde', bullet: true, level: 0 },
      { text: 'Numaralı madde', bullet: true, level: 0 },
    ])
  })

  it('iki sütunlu sayfayı sütun sırasına göre dizer', () => {
    const lines = buildPdfLines([
      { str: 'Sol 1', x: 50, y: 700, fontSize: 12 },
      { str: 'Sağ 1', x: 320, y: 700, fontSize: 12 },
      { str: 'Sol 2', x: 50, y: 680, fontSize: 12 },
      { str: 'Sağ 2', x: 320, y: 680, fontSize: 12 },
      { str: 'Sol 3', x: 50, y: 660, fontSize: 12 },
      { str: 'Sağ 3', x: 320, y: 660, fontSize: 12 },
    ])

    expect(lines.map((line) => line.text)).toEqual([
      'Sol 1',
      'Sol 2',
      'Sol 3',
      'Sağ 1',
      'Sağ 2',
      'Sağ 3',
    ])
  })

  it('ortalanmış başlığı iki sütun sanmaz', () => {
    const lines = buildPdfLines([
      { str: 'Ortalanmış Başlık', x: 200, y: 700, fontSize: 24 },
      { str: 'Alt başlık', x: 200, y: 676, fontSize: 18 },
      { str: 'Gövde 1', x: 50, y: 640, fontSize: 12 },
      { str: 'Gövde 2', x: 50, y: 620, fontSize: 12 },
      { str: 'Gövde 3', x: 50, y: 600, fontSize: 12 },
    ])

    expect(lines.every((line) => line.column === 0)).toBe(true)
    expect(lines.map((line) => line.text)[0]).toBe('Ortalanmış Başlık')
  })

  it('eski satır API’siyle uyumlu kalır', () => {
    const lines = groupPdfTextItems([
      { str: 'Başlık', x: 10, y: 100 },
      { str: 'Madde', x: 10, y: 80 },
    ])

    expect(lines).toEqual(['Başlık', 'Madde'])
  })

  it('sayfalarda tekrar eden üst/alt bilgi satırlarını ayıklar', () => {
    const pages: PdfPageData[] = [1, 2, 3].map((number) => ({
      number,
      height: 800,
      items: [
        { str: 'Şirket Sunumu', x: 50, y: 780, fontSize: 10 },
        { str: 'Sayfa ' + number, x: 300, y: 10, fontSize: 10 },
        { str: 'Başlık ' + number, x: 50, y: 700, fontSize: 24 },
        { str: 'İçerik ' + number, x: 50, y: 650, fontSize: 12 },
      ],
    }))

    const repeated = collectRepeatedPdfLines(pages)

    expect(repeated.has('şirket sunumu')).toBe(true)

    const slide = pdfPageToSlide(1, pages[0].items, 800, repeated)

    expect(slide.title).toBe('Başlık 1')
    expect(slide.items.map((item) => item.text)).toEqual(['İçerik 1'])
  })

  it('aynı boyuttaki adaylar arasında kalın satırı başlık seçer', () => {
    const slide = pdfPageToSlide(1, [
      { str: 'Normal Üst Satır', x: 50, y: 700, fontSize: 18 },
      { str: 'Kalın Başlık', x: 50, y: 680, fontSize: 18, fontFamily: 'Arial-Bold' },
      { str: 'Gövde metni', x: 50, y: 400, fontSize: 12 },
      { str: 'İkinci gövde', x: 50, y: 380, fontSize: 12 },
      { str: 'Üçüncü gövde', x: 50, y: 360, fontSize: 12 },
    ])

    expect(slide.title).toBe('Kalın Başlık')
  })

  it('uyarıları nota kutu olarak ekler', () => {
    const blocks = slidesToBlocks(
      {
        title: 'Sunum',
        slides: [{ number: 1, title: 'Slayt', items: [], notes: [] }],
        warnings: ['1 sayfa atlandı.'],
      },
      'sections',
      false,
    )

    expect(blocks.at(-1)?.type).toBe('callout')
    expect(blocks.at(-1)?.html).toContain('1 sayfa atlandı')
  })
})

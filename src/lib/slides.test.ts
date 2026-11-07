import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { parsePptxArchive, slidesToBlocks } from './slides'

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

import { describe, expect, it } from 'vitest'
import type { SlideDeck } from './slides'
import {
  buildSlideAiPrompt,
  chunkDeckForAi,
  deckToPromptText,
  mergeAiChunk,
  parseSlideAiResponse,
} from './slideAi'

const deck: SlideDeck = {
  title: 'Biyoloji Sunumu',
  slides: [
    {
      number: 1,
      title: 'Hücre',
      items: [
        { text: 'Hücre zarı', bullet: true, level: 0 },
        { text: 'Çekirdek', bullet: true, level: 0 },
      ],
      notes: ['Zar seçici geçirgendir.'],
      tables: [
        [
          ['Organel', 'Görev'],
          ['Mitokondri', 'Enerji'],
        ],
      ],
    },
  ],
}

describe('slayt AI istemi', () => {
  it('slayt metnini, tabloyu ve notları isteme koyar', () => {
    const text = deckToPromptText(deck)

    expect(text).toContain('Biyoloji Sunumu')
    expect(text).toContain('[Slayt 1] Hücre')
    expect(text).toContain('- Hücre zarı')
    expect(text).toContain('| Organel | Görev |')
    expect(text).toContain('Konuşmacı notu: Zar seçici geçirgendir.')
  })

  it('moda özel yönerge ve JSON şeması üretir', () => {
    const prompt = buildSlideAiPrompt(deck, 'summarize', 'Sınav odaklı olsun')

    expect(prompt.system).toContain('yalnızca geçerli JSON')
    expect(prompt.user).toContain('en fazla 5 kısa maddeye özetle')
    expect(prompt.user).toContain('ŞEMA:')
    expect(prompt.user).toContain('Ek istek: Sınav odaklı olsun')
    expect(prompt.user).toContain('SLAYT METNİ:')
  })
})

describe('uzun sunum parçalama', () => {
  it('küçük desteyi tek parça bırakır', () => {
    expect(chunkDeckForAi(deck)).toHaveLength(1)
  })

  it('uzun desteyi sırayı koruyarak parçalara böler', () => {
    const longDeck: SlideDeck = {
      title: 'Uzun sunum',
      slides: Array.from({ length: 30 }, (_, index) => ({
        number: index + 1,
        title: `Slayt ${index + 1}`,
        items: [{ text: 'uzun metin '.repeat(40), bullet: true, level: 0 }],
        notes: [],
      })),
    }

    const chunks = chunkDeckForAi(longDeck, 4_000, 10)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.flatMap((chunk) => chunk.slides.map((slide) => slide.number))).toEqual(
      longDeck.slides.map((slide) => slide.number),
    )
    expect(chunks.every((chunk) => chunk.slides.length > 0)).toBe(true)
    expect(chunks.every((chunk) => chunk.slides.length <= 10)).toBe(true)
  })
})

describe('AI parçasını ham slaytlarla hizalama', () => {
  const chunk: SlideDeck = {
    title: 'Sunum',
    slides: [
      { number: 3, title: 'Üç', items: [{ text: 'a', bullet: true, level: 0 }], notes: [] },
      { number: 4, title: 'Dört', items: [{ text: 'b', bullet: true, level: 0 }], notes: [] },
      { number: 5, title: 'Beş', items: [{ text: 'c', bullet: true, level: 0 }], notes: [] },
    ],
  }

  it('numaralar korunmuşsa eksik slaytın ham metnini kullanır', () => {
    const improved: SlideDeck = {
      title: 'Sunum',
      slides: [
        { number: 3, title: 'Üç (AI)', items: [{ text: 'a', bullet: true, level: 0 }], notes: [] },
        { number: 5, title: 'Beş (AI)', items: [{ text: 'c', bullet: true, level: 0 }], notes: [] },
      ],
    }

    const merged = mergeAiChunk(chunk, improved)

    expect(merged.slides.map((slide) => slide.title)).toEqual(['Üç (AI)', 'Dört', 'Beş (AI)'])
    expect(merged.slides.map((slide) => slide.number)).toEqual([3, 4, 5])
    expect(merged.keptRaw).toBe(1)
  })

  it('AI yeniden numaralandırdıysa sırayla eşleştirir', () => {
    const improved: SlideDeck = {
      title: 'Sunum',
      slides: [
        { number: 1, title: 'Bir (AI)', items: [{ text: 'a', bullet: true, level: 0 }], notes: [] },
        { number: 2, title: 'İki (AI)', items: [{ text: 'b', bullet: true, level: 0 }], notes: [] },
      ],
    }

    const merged = mergeAiChunk(chunk, improved)

    expect(merged.slides.map((slide) => slide.title)).toEqual(['Bir (AI)', 'İki (AI)', 'Beş'])
    expect(merged.slides.map((slide) => slide.number)).toEqual([3, 4, 5])
    expect(merged.keptRaw).toBe(1)
  })
})

describe('slayt AI yanıtı', () => {
  it('kod bloğu içindeki JSON’u çözer', () => {
    const response = `\`\`\`json
{
  "title": "Düzenlenmiş sunum",
  "slides": [
    {
      "number": 1,
      "title": "Hücre yapısı",
      "items": [
        { "text": "Hücre zarı", "bullet": true, "level": 0 },
        { "text": "Çekirdek", "bullet": true, "level": 9 }
      ],
      "notes": ["Zar seçici geçirgendir."],
      "tables": [[["Organel", "Görev"], ["Mitokondri", "Enerji"]]]
    }
  ]
}
\`\`\``

    const parsed = parseSlideAiResponse(response, 'Yedek başlık')

    expect(parsed.title).toBe('Düzenlenmiş sunum')
    expect(parsed.markdown).toBe(true)
    expect(parsed.slides[0].title).toBe('Hücre yapısı')
    expect(parsed.slides[0].items[1].level).toBe(3)
    expect(parsed.slides[0].tables).toEqual([
      [
        ['Organel', 'Görev'],
        ['Mitokondri', 'Enerji'],
      ],
    ])
  })

  it('JSON bozuksa Markdown çıktısına düşer', () => {
    const response = `# Ders Notu
## Hücre
- Hücre zarı
- Çekirdek
> Zar seçici geçirgendir.
## Mitokondri
- Enerji üretir`

    const parsed = parseSlideAiResponse(response, 'Yedek')

    expect(parsed.title).toBe('Ders Notu')
    expect(parsed.slides).toHaveLength(2)
    expect(parsed.slides[0].items[0]).toEqual({
      text: 'Hücre zarı',
      bullet: true,
      level: 0,
    })
    expect(parsed.slides[0].notes).toEqual(['Zar seçici geçirgendir.'])
  })

  it('geçerli içerik yoksa anlaşılır hata verir', () => {
    expect(() => parseSlideAiResponse('üzgünüm, yapamadım')).toThrow(
      'AI geçerli slayt içeriği döndürmedi',
    )
  })

  it('boş slaytları atlar ve numaraları korur', () => {
    const parsed = parseSlideAiResponse(
      JSON.stringify({
        title: 'Sunum',
        slides: [
          { number: 2, title: '', items: [], notes: [] },
          { number: 3, title: 'Dolu', items: ['Metin'] },
        ],
      }),
    )

    expect(parsed.slides).toHaveLength(1)
    expect(parsed.slides[0].number).toBe(3)
    expect(parsed.slides[0].items[0]).toEqual({ text: 'Metin', bullet: false, level: 0 })
  })

  it('tek tablo satır dizisi olarak dönerse de kabul eder', () => {
    const parsed = parseSlideAiResponse(
      JSON.stringify({
        title: 'Sunum',
        slides: [
          {
            title: 'Tablo',
            items: ['Metin'],
            tables: [
              ['Ad', 'Puan'],
              ['Ali', '90'],
            ],
          },
        ],
      }),
    )

    expect(parsed.slides[0].tables).toEqual([
      [
        ['Ad', 'Puan'],
        ['Ali', '90'],
      ],
    ])
  })

  it('Markdown alt başlıklarını ayrı slayt yapmaz', () => {
    const parsed = parseSlideAiResponse(`# Ders
## Hücre
### Organeller
- Mitokondri
### Zar
- Seçici geçirgen`)

    expect(parsed.slides).toHaveLength(1)
    expect(parsed.slides[0].items.map((item) => item.text)).toEqual([
      'Organeller',
      'Mitokondri',
      'Zar',
      'Seçici geçirgen',
    ])
  })
})

import type { Slide, SlideDeck, SlideTextItem } from './slides'

export type SlideAiMode = 'clean' | 'summarize' | 'study'

export interface SlideAiModeInfo {
  id: SlideAiMode
  label: string
  description: string
}

export const SLIDE_AI_MODES: SlideAiModeInfo[] = [
  {
    id: 'clean',
    label: 'Düzenle ve netleştir',
    description: 'Yazımı düzeltir, başlıkları netleştirir, maddeleri toparlar. İçerik eklemez.',
  },
  {
    id: 'summarize',
    label: 'Slayt slayt özetle',
    description: 'Her slaytı en fazla 5 kısa maddeye indirir; konuşmacı notlarını ayrı tutar.',
  },
  {
    id: 'study',
    label: 'Ders notuna çevir',
    description: 'Başlık, maddeler ve konuşmacı notlarını birleştirip çalışılabilir not üretir.',
  },
]

const PROMPT_TEXT_LIMIT = 18_000

const JSON_SCHEMA = `{
  "title": "Sunumun başlığı",
  "slides": [
    {
      "number": 1,
      "title": "Slayt başlığı",
      "items": [
        { "text": "Madde veya paragraf", "bullet": true, "level": 0 }
      ],
      "notes": ["Konuşmacı notu (varsa)"],
      "tables": [
        [["Başlık 1", "Başlık 2"], ["Hücre 1", "Hücre 2"]]
      ]
    }
  ]
}`

function clean(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanHeading(value: unknown): string {
  return clean(value).replace(/^#{1,6}\s+/, '')
}

function cleanItemText(value: unknown): string {
  return clean(value).replace(/^(?:#{1,6}|[-*+]|\d{1,2}[.)])\s+/, '')
}

/** Slayt destesini AI'ya gönderilecek okunabilir metne çevirir. */
export function deckToPromptText(deck: SlideDeck, limit = PROMPT_TEXT_LIMIT): string {
  const lines: string[] = [`Sunum başlığı: ${deck.title || 'Slayt notu'}`]

  for (const slide of deck.slides) {
    lines.push('')
    lines.push(`[Slayt ${slide.number}] ${slide.title}`)

    for (const item of slide.items) {
      const indent = '  '.repeat(Math.max(0, Math.min(3, item.level)))
      lines.push(`${indent}${item.bullet ? '- ' : ''}${item.text}`)
    }

    for (const table of slide.tables ?? []) {
      lines.push('Tablo:')
      for (const row of table) {
        lines.push(`| ${row.join(' | ')} |`)
      }
    }

    if (slide.notes.length) {
      lines.push(`Konuşmacı notu: ${slide.notes.join(' ')}`)
    }
  }

  const text = lines.join('\n')
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}\n… (metin kısaltıldı)`
}

function modeInstruction(mode: SlideAiMode): string {
  switch (mode) {
    case 'summarize':
      return (
        'Her slaytı en fazla 5 kısa maddeye özetle. Gereksiz ayrıntıları at, ana fikri koru. ' +
        'Konuşmacı notlarını özetin içine katma; kısa bir notes dizisi olarak bırak.'
      )
    case 'study':
      return (
        'Slaytları çalışılabilir bir ders notuna çevir. Her slayt için kısa ve net bir başlık, ' +
        '3-7 madde ve varsa konuşmacı notlarını kullan. Önemli terimleri **kalın** yaz. ' +
        'Yeni bilgi uydurma; yalnızca verilen metne dayan.'
      )
    default:
      return (
        'Her slaytın yazımını ve dilbilgisini Türkçe kurallara göre düzelt. Başlıkları kısa ve ' +
        'net yap, maddeleri mantıklı sıraya koy. Yeni bilgi ekleme, içerik çıkarma; yalnızca ' +
        'var olan metni düzenle. Konuşmacı notlarını olduğu gibi koru.'
      )
  }
}

/** AI'ya gönderilecek sistem ve kullanıcı iletilerini üretir. */
export function buildSlideAiPrompt(
  deck: SlideDeck,
  mode: SlideAiMode,
  extra = '',
): { system: string; user: string } {
  const extraLine = extra.trim() ? `\n\nEk istek: ${extra.trim()}` : ''
  const system =
    'Sen Bloknot adlı Türkçe not defterinin slayt içe aktarma asistanısın. ' +
    'Sana verilen slayt metnini düzenlersin. Yanıtı yalnızca geçerli JSON olarak ver; ' +
    'Markdown kod bloğu, açıklama veya JSON dışında metin ekleme. ' +
    'Türkçe yazım kurallarına uy. Slayt sayısını ve sırasını koru.'

  const user =
    `${modeInstruction(mode)}\n\n` +
    `Yanıtı aşağıdaki JSON şemasına uygun ver. "items" içindeki her öğe bir madde veya ` +
    `paragraftır; "bullet" maddeler için true, düz paragraf için false olsun. ` +
    `"level" girintidir (0-3). Tablo varsa "tables" alanına satır ve hücreler halinde koy. ` +
    `Boş slaytları atlama; başlık ve en az bir madde üret.\n\n` +
    `ŞEMA:\n${JSON_SCHEMA}\n\nSLAYT METNİ:\n${deckToPromptText(deck)}${extraLine}`

  return { system, user }
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json|markdown|md)?\s*\r?\n([\s\S]*?)\r?\n```$/i)
  return (fenced ? fenced[1] : trimmed).trim()
}

function extractJsonObject(text: string): string | null {
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first < 0 || last <= first) return null
  return text.slice(first, last + 1)
}

function normalizeItem(raw: unknown): SlideTextItem | null {
  if (typeof raw === 'string') {
    const text = cleanItemText(raw)
    return text ? { text, bullet: false, level: 0 } : null
  }
  if (!raw || typeof raw !== 'object') return null

  const value = raw as Record<string, unknown>
  const text = cleanItemText(value.text ?? value.title ?? value.content)
  if (!text) return null

  const bullet = typeof value.bullet === 'boolean' ? value.bullet : true
  const rawLevel = Number(value.level)
  const level = Number.isFinite(rawLevel) ? Math.max(0, Math.min(3, Math.trunc(rawLevel))) : 0

  return { text, bullet, level }
}

function normalizeNotes(raw: unknown): string[] {
  if (typeof raw === 'string') {
    const note = clean(raw)
    return note ? [note] : []
  }
  if (!Array.isArray(raw)) return []
  return raw.map((item) => clean(item)).filter(Boolean)
}

function normalizeTable(raw: unknown): string[][] | null {
  if (!Array.isArray(raw)) return null

  const rows: string[][] = []
  for (const rawRow of raw) {
    if (!Array.isArray(rawRow)) continue
    const row = rawRow.map((cell) => clean(cell))
    if (row.some(Boolean)) rows.push(row)
  }

  return rows.length >= 2 ? rows : null
}

function normalizeTables(raw: unknown): string[][][] {
  if (!Array.isArray(raw) || !raw.length) return []

  const isRow = (value: unknown): boolean =>
    Array.isArray(value) &&
    value.every((cell) => typeof cell === 'string' || typeof cell === 'number')

  // Model bazen tek tabloyu doğrudan satır dizisi olarak döndürür.
  if (raw.every(isRow)) {
    const table = normalizeTable(raw)
    return table ? [table] : []
  }

  return raw
    .map(normalizeTable)
    .filter((table): table is string[][] => Boolean(table))
}

function normalizeSlide(raw: unknown, index: number): Slide | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>

  const title = cleanHeading(value.title ?? value.heading)
  const items = Array.isArray(value.items)
    ? value.items
        .map(normalizeItem)
        .filter((item): item is SlideTextItem => Boolean(item))
    : []
  const notes = normalizeNotes(value.notes)
  const tables = normalizeTables(value.tables)

  if (!title && !items.length && !notes.length && !tables.length) return null

  const rawNumber = Number(value.number)
  return {
    number: Number.isFinite(rawNumber) && rawNumber > 0 ? Math.trunc(rawNumber) : index + 1,
    title: title || `Slayt ${index + 1}`,
    items,
    notes,
    tables: tables.length ? tables : undefined,
  }
}

function deckFromJson(raw: string, fallbackTitle: string): SlideDeck | null {
  const source = extractJsonObject(raw)
  if (!source) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch {
    try {
      parsed = JSON.parse(source.replace(/,\s*([}\]])/g, '$1'))
    } catch {
      return null
    }
  }

  if (!parsed || typeof parsed !== 'object') return null
  const root = parsed as Record<string, unknown>
  const payload =
    root.deck && typeof root.deck === 'object'
      ? (root.deck as Record<string, unknown>)
      : root

  const rawSlides = Array.isArray(payload.slides) ? payload.slides : []
  const slides = rawSlides
    .map((slide, index) => normalizeSlide(slide, index))
    .filter((slide): slide is Slide => Boolean(slide))

  if (!slides.length) return null

  return {
    title: cleanHeading(payload.title) || fallbackTitle || 'Slayt notu',
    slides,
    markdown: true,
  }
}

/** AI JSON üretmezse Markdown çıktısını da slayt destesine çevirir. */
function deckFromMarkdown(raw: string, fallbackTitle: string): SlideDeck | null {
  const lines = stripCodeFence(raw).replace(/\r\n/g, '\n').split('\n')
  const slides: Slide[] = []
  let deckTitle = ''
  let current: Slide | null = null
  let structured = false

  const ensureSlide = (title: string): Slide => {
    if (current) return current
    current = {
      number: slides.length + 1,
      title: title || `Slayt ${slides.length + 1}`,
      items: [],
      notes: [],
    }
    slides.push(current)
    return current
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      const text = clean(heading[2])
      if (level === 1 && !slides.length && !deckTitle) {
        deckTitle = text
        continue
      }
      if (level >= 3) {
        structured = true
        const itemText = cleanHeading(text)
        if (itemText) {
          ensureSlide('').items.push({ text: itemText, bullet: false, level: level - 2 })
        }
        continue
      }
      structured = true
      current = {
        number: slides.length + 1,
        title: text || `Slayt ${slides.length + 1}`,
        items: [],
        notes: [],
      }
      slides.push(current)
      continue
    }

    const note = line.match(/^>\s?(.*)$/)
    if (note) {
      const text = clean(note[1])
      if (text) {
        structured = true
        ensureSlide('').notes.push(text)
      }
      continue
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/)
    if (bullet) {
      const text = clean(bullet[1])
      if (text) {
        structured = true
        ensureSlide('').items.push({ text, bullet: true, level: 0 })
      }
      continue
    }

    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (numbered) {
      const text = clean(numbered[1])
      if (text) {
        structured = true
        ensureSlide('').items.push({ text, bullet: true, level: 0 })
      }
      continue
    }

    const text = clean(line.replace(/[*_`~]/g, ''))
    if (text) ensureSlide('').items.push({ text, bullet: false, level: 0 })
  }

  const hasContent = slides.some((slide) => slide.items.length || slide.notes.length)
  if (!structured || !hasContent) return null

  return {
    title: deckTitle || fallbackTitle || 'Slayt notu',
    slides,
    markdown: false,
  }
}

/**
 * AI yanıtını slayt destesine çevirir. Önce JSON, olmazsa Markdown denenir.
 * Geçerli içerik yoksa anlaşılır bir hata fırlatır.
 */
export function parseSlideAiResponse(text: string, fallbackTitle = 'Slayt notu'): SlideDeck {
  const cleaned = stripCodeFence(text)
  const fromJson = deckFromJson(cleaned, fallbackTitle)
  if (fromJson) return fromJson

  const fromMarkdown = deckFromMarkdown(cleaned, fallbackTitle)
  if (fromMarkdown) return fromMarkdown

  throw new Error(
    'AI geçerli slayt içeriği döndürmedi. Tekrar dene veya “AI olmadan oluştur” seçeneğini kullan.',
  )
}

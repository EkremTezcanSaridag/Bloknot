import type { AiProvider, BlockType, Note } from '../types'
import { noteToMarkdown } from './markdown'
import { inlineMarkdownToHtml, sanitizeHtml } from './sanitize'
import { SHARED_GROQ_MODEL, SHARED_GROQ_PROXY_URL } from './aiConfig'

export type AiActionId =
  | 'improve'
  | 'summarize'
  | 'format'
  | 'ideas'
  | 'diagram'
  | 'image'
  | 'custom'

export interface AiProviderPreset {
  id: AiProvider
  label: string
  description: string
  baseUrl: string
  model: string
  keyUrl: string
  requiresKey?: boolean
  shared?: boolean
}

export const AI_PROVIDERS: Record<AiProvider, AiProviderPreset> = {
  'groq-proxy': {
    id: 'groq-proxy',
    label: 'Groq (paylaşımlı)',
    description: 'Tek anahtar sunucuda saklanır. Anahtar girmene gerek yok.',
    baseUrl: SHARED_GROQ_PROXY_URL,
    model: SHARED_GROQ_MODEL,
    keyUrl: '',
    requiresKey: false,
    shared: true,
  },
  groq: {
    id: 'groq',
    label: 'Groq (kendi anahtarım)',
    description: 'Kendi Groq anahtarınla tarayıcıdan doğrudan bağlan.',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'openai/gpt-oss-120b',
    keyUrl: 'https://console.groq.com/keys',
    requiresKey: true,
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    description: 'Tek anahtarla Grok, GPT ve daha fazlası. Tarayıcıdan çalışır.',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'x-ai/grok-4.7',
    keyUrl: 'https://openrouter.ai/keys',
    requiresKey: true,
  },
  xai: {
    id: 'xai',
    label: 'xAI / Grok',
    description: 'Doğrudan xAI. Bazı tarayıcılarda CORS engeli olabilir.',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-4.7',
    keyUrl: 'https://console.x.ai',
    requiresKey: true,
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    description: 'GPT modelleriyle doğrudan bağlantı.',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1',
    keyUrl: 'https://platform.openai.com/api-keys',
    requiresKey: true,
  },
  custom: {
    id: 'custom',
    label: 'Özel',
    description: 'OpenAI uyumlu herhangi bir uç nokta veya proxy.',
    baseUrl: '',
    model: '',
    keyUrl: '',
    requiresKey: false,
  },
}

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiConfig {
  provider: AiProvider
  baseUrl: string
  model: string
  apiKey: string
}

export interface ChatOptions {
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

const SYSTEM_PROMPT =
  'Sen Bloknot adlı Türkçe not defterinin yapay zekâ asistanısın. Kısa, net ve samimi yaz. ' +
  'Kullanıcı istemedikçe giriş cümlesi, özür veya gereksiz açıklama ekleme. Sadece istenen sonucu ver. ' +
  'Türkçe yazım kurallarına uy.'

const NOTE_LIMIT = 14_000

export function aiConfigFromSettings(settings: {
  aiProvider: AiProvider
  aiBaseUrl: string
  aiModel: string
}, apiKey: string): AiConfig {
  return {
    provider: settings.aiProvider,
    baseUrl: settings.aiBaseUrl,
    model: settings.aiModel,
    apiKey,
  }
}

export function chatEndpoint(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  if (!base) throw new Error('AI sunucu adresi boş. Ayarlardan bir adres gir.')
  if (/\/chat\/completions$/i.test(base)) return base
  return `${base}/chat/completions`
}

export async function chatComplete(
  config: AiConfig,
  messages: AiMessage[],
  options: ChatOptions = {},
): Promise<string> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 60_000)
  const onAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onAbort)

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (config.apiKey.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`
    if (config.provider === 'openrouter') headers['X-Title'] = 'Bloknot'

    const maxTokens = options.maxTokens ?? 1400
    const body: Record<string, unknown> = {
      model: config.model.trim(),
      messages,
      temperature: options.temperature ?? 0.35,
      stream: false,
    }
    // Groq, max_tokens yerine max_completion_tokens kullanıyor.
    if (config.provider === 'groq') body.max_completion_tokens = maxTokens
    else body.max_tokens = maxTokens

    const response = await fetch(chatEndpoint(config.baseUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(await describeHttpError(response))
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string | Array<{ type?: string; text?: string }> }
        text?: string
      }>
      output_text?: string
      error?: { message?: string }
    }

    const content = data.choices?.[0]?.message?.content
    const text =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.map((part) => part.text ?? '').join('')
          : data.choices?.[0]?.text ?? data.output_text ?? ''

    if (!text.trim()) {
      throw new Error(data.error?.message || 'AI boş bir yanıt döndürdü. Tekrar dene.')
    }

    return text.trim()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI isteği zaman aşımına uğradı. Tekrar dene.')
    }
    if (error instanceof TypeError) {
      throw new Error(
        'İstek tarayıcıdan gönderilemedi (CORS). Sağlayıcı tarayıcı isteklerine izin vermiyor ' +
          'olabilir. Groq veya OpenRouter’ı deneyebilirsin.',
      )
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
    options.signal?.removeEventListener('abort', onAbort)
  }
}

async function describeHttpError(response: Response): Promise<string> {
  let detail = ''
  try {
    const raw = await response.text()
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string }
        detail = parsed.error?.message ?? parsed.message ?? raw
      } catch {
        detail = raw
      }
    }
  } catch {
    // yanıt gövdesi okunamadı
  }

  const clipped = detail.replace(/\s+/g, ' ').slice(0, 280)
  const suffix = clipped ? ` (${clipped})` : ''

  switch (response.status) {
    case 401:
      return `API anahtarı geçersiz veya süresi dolmuş.${suffix}`
    case 402:
      return `Bu istek için yeterli kredi yok.${suffix}`
    case 403:
      return `Bu anahtar veya model için izin yok.${suffix}`
    case 404:
      return `Model ya da uç nokta bulunamadı. Model adını kontrol et.${suffix}`
    case 429:
      return `Çok fazla istek veya kota doldu. Biraz sonra tekrar dene.${suffix}`
    default:
      return response.status >= 500
        ? `AI sağlayıcısı şu anda yanıt veremiyor (${response.status}).${suffix}`
        : `AI isteği başarısız oldu (${response.status}).${suffix}`
  }
}

const DIAGRAM_START =
  /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|requirementDiagram|C4Context|sankey-beta|xychart-beta|block-beta|packet-beta|architecture-beta)\b/m

/** AI yanıtından Mermaid kodunu çıkarır. */
export function extractMermaid(text: string): string | null {
  const fences = Array.from(text.matchAll(/```([^\n`]*)\r?\n([\s\S]*?)```/g))

  for (const match of fences) {
    const language = (match[1] ?? '').trim().toLowerCase()
    const body = (match[2] ?? '').trim()
    if (!body) continue
    if (language.includes('mermaid') || DIAGRAM_START.test(body)) return body
  }

  const trimmed = text.trim()
  if (DIAGRAM_START.test(trimmed)) return trimmed
  return null
}

/** Mermaid kodunu mermaid.ink üzerinden SVG görseline çevirir. */
export function mermaidInkUrl(code: string): string {
  const bytes = new TextEncoder().encode(code.trim())
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const base64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `https://mermaid.ink/svg/${base64}?bgColor=ffffff`
}

/** Pollinations ile anahtarsız, ücretsiz görsel üretir. */
export function pollinationsUrl(prompt: string, width = 1024, height = 768, seed = Date.now()): string {
  const cleaned = prompt.trim().slice(0, 1200)
  // Pollinations tohumu 32 bit işaretli tam sayı bekliyor.
  const safeSeed = Math.abs(Math.trunc(seed)) % 2_147_483_647
  return (
    `https://image.pollinations.ai/prompt/${encodeURIComponent(cleaned)}` +
    `?width=${width}&height=${height}&nologo=true&model=flux&seed=${safeSeed}`
  )
}

/** Harici görseli IndexedDB'de saklanabilen bir data URL'ye çevirir. */
export async function urlToDataUrl(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 18_000)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      if (response.status === 402) {
        throw new Error('Görsel kotası doldu. Yaklaşık 45 saniye sonra tekrar dene.')
      }
      if (response.status === 429) {
        throw new Error('Çok fazla görsel isteği. Biraz bekleyip tekrar dene.')
      }
      throw new Error(`Görsel indirilemedi (${response.status}).`)
    }
    const blob = await response.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(reader.error ?? new Error('Görsel okunamadı.'))
      reader.readAsDataURL(blob)
    })
  } finally {
    window.clearTimeout(timer)
  }
}

/** Mümkünse görseli data URL yapar; CORS engeli varsa doğrudan adresi döndürür. */
export async function bestEffortDataUrl(url: string): Promise<string> {
  try {
    const dataUrl = await urlToDataUrl(url)
    return dataUrl || url
  } catch {
    return url
  }
}

export function buildPrompt(
  action: AiActionId,
  note: Note | null,
  userPrompt: string,
  includeNote: boolean,
): string {
  const extra = userPrompt.trim() ? `\n\nEk istek: ${userPrompt.trim()}` : ''
  const noteText = note && includeNote ? noteToMarkdown(note).slice(0, NOTE_LIMIT) : ''
  const noteSection = noteText.trim()
    ? `\n\n--- NOT ---\n${noteText}\n--- NOT SONU ---`
    : ''

  switch (action) {
    case 'improve':
      return `Aşağıdaki notun yazımını, dilbilgisini ve anlatımını düzelt. Anlamı değiştirme, daha akıcı hale getir.${noteSection}${extra}`
    case 'summarize':
      return `Aşağıdaki notu Türkçe olarak özetle. Kısa bir giriş cümlesi ve en fazla 5 madde kullan.${noteSection}${extra}`
    case 'format':
      return `Aşağıdaki notu daha okunabilir hale getir. Uygun yerlerde başlıklar, kısa paragraflar, maddeler ve yapılacaklar kullan. Yanıtı Markdown olarak ver; en başa not başlığı ekleme.${noteSection}${extra}`
    case 'ideas':
      return `Aşağıdaki not hakkında 5 yaratıcı fikir, soru veya sonraki adım üret. Her biri kısa ve uygulanabilir olsun.${noteSection}${extra}`
    case 'diagram':
      return (
        'Aşağıdaki notu anlaşılır bir Mermaid diyagramına dönüştür. ' +
        'Yalnızca ```mermaid ile başlayan tek bir kod bloğu döndür; başka açıklama yazma. ' +
        'Uygun olduğunda flowchart TD kullan ve etiketleri Türkçe yaz.' +
        `${noteSection}${extra}`
      )
    case 'image':
      return userPrompt.trim() || (note ? `Notun konusunu anlatan yaratıcı bir görsel: ${note.title}` : '')
    case 'custom':
      return `${userPrompt.trim() || 'Bu not hakkında bana yardım et.'}${noteSection}`
    default:
      return `${userPrompt.trim()}${noteSection}`
  }
}

const BLOCK_TYPE_HINTS: Partial<Record<BlockType, string>> = {
  paragraph: 'paragraf',
  heading1: 'başlık',
  heading2: 'başlık',
  heading3: 'başlık',
  bulleted: 'liste öğesi',
  numbered: 'numaralı liste öğesi',
  todo: 'yapılacak iş',
  quote: 'alıntı',
  callout: 'not kutusu',
}

/** Tek bir bloğu düzeltmek için AI istemi üretir. */
export function buildBlockPrompt(type: BlockType, text: string, extraPrompt = ''): string {
  const hint = BLOCK_TYPE_HINTS[type] ?? 'metin'
  const extra =
    type === 'heading1' || type === 'heading2' || type === 'heading3'
      ? 'Başlığı kısa tut.'
      : type === 'quote'
        ? 'Alıntı tonunu koru.'
        : type === 'todo'
          ? 'Yapılacak işi kısa ve net tut.'
          : 'Metni tek satırda tut.'
  const custom = extraPrompt.trim() ? `\nEk istek: ${extraPrompt.trim()}` : ''

  return (
    `Aşağıdaki ${hint} metnini Türkçe yazım, dilbilgisi ve anlatım açısından düzelt. ` +
    'Anlamı değiştirme, yeni bilgi ekleme, metni gereksiz uzatma. ' +
    'Yalnızca düzeltilmiş metni döndür; açıklama, tırnak, başlık işareti (#), ' +
    `madde işareti (-), numara veya kod bloğu ekleme. ${extra}${custom}\n\n` +
    `METİN:\n${text.trim()}`
  )
}

/** Boş veya dolu bir bloktan yeni, çok bloklu içerik üretmek için AI istemi. */
export function buildBlockGeneratePrompt(
  type: BlockType,
  text: string,
  prompt: string,
): string {
  const hint = BLOCK_TYPE_HINTS[type] ?? 'metin'
  const context = text.trim() ? `\n\nMEVCUT BLOK (${hint}):\n${text.trim()}` : ''

  return (
    'Kullanıcının isteğine göre not içeriği oluştur. ' +
    'Yanıtı yalnızca Markdown olarak ver; giriş cümlesi, özür, açıklama veya kod bloğu ekleme. ' +
    'Gerekirse birden fazla blok üret: ana başlık için #, alt başlık için ## veya ###, ' +
    'açıklama için düz paragraf, listeler için - veya 1. kullan. ' +
    'Başlıkları kısa tut ve her alt başlığın altına en az bir kısa açıklama yaz. ' +
    `\n\nİSTEK:\n${prompt.trim()}${context}`
  )
}

/** AI'ın ürettiği Markdown'ı saran kod bloğunu temizler. */
export function cleanGeneratedMarkdown(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:markdown|md)?\s*\r?\n([\s\S]*?)\r?\n```$/i)
  return (fenced ? fenced[1] : trimmed).trim()
}

/** AI'ın blok için döndürdüğü metni temizler. */
export function cleanBlockAiText(text: string): string {
  return text
    .replace(/```[a-z]*\s*/gi, '')
    .replace(/```/g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s{0,3}(?:#{1,6}|[-*+]|\d+[.)])\s+/, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, '')
    .trim()
}

/** AI metnini bloğun sakladığı güvenli satır içi HTML'e çevirir. */
export function blockAiTextToHtml(text: string): string {
  return sanitizeHtml(inlineMarkdownToHtml(cleanBlockAiText(text)))
}

export function noteTextForAi(note: Note | null, includeNote: boolean): string {
  return note && includeNote ? noteToMarkdown(note).slice(0, NOTE_LIMIT) : ''
}

export function defaultSystemPrompt(action: AiActionId): string {
  if (action === 'diagram') {
    return `${SYSTEM_PROMPT} Mermaid sözdizimini eksiksiz ve geçerli kullan.`
  }
  return SYSTEM_PROMPT
}

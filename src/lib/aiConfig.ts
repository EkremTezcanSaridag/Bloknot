import type { AiProvider } from '../types'

/**
 * Paylaşımlı Groq proxy'si. Cloudflare Worker adresi build sırasında
 * VITE_GROQ_PROXY_URL ortam değişkeninden okunur. GitHub Actions değişkeni
 * tanımlı değilse buradaki herkese açık Worker adresine düşer.
 */
const FALLBACK_SHARED_GROQ_PROXY_URL = 'https://bloknot-groq.ets123main.workers.dev'

export const SHARED_GROQ_PROXY_URL = (
  import.meta.env.VITE_GROQ_PROXY_URL || FALLBACK_SHARED_GROQ_PROXY_URL
)
  .trim()
  .replace(/\/+$/, '')

export const SHARED_GROQ_MODEL = 'openai/gpt-oss-120b'

export const DEFAULT_AI_PROVIDER: AiProvider = SHARED_GROQ_PROXY_URL
  ? 'groq-proxy'
  : 'groq'

export const DEFAULT_AI_BASE_URL =
  SHARED_GROQ_PROXY_URL || 'https://api.groq.com/openai/v1'

export const DEFAULT_AI_MODEL = SHARED_GROQ_MODEL

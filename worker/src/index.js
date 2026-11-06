/**
 * Bloknot paylaşımlı Groq proxy'si (Cloudflare Worker)
 *
 * Groq anahtarı yalnızca Cloudflare secret olarak saklanır. Tarayıcı bu
 * Worker'a istek atar; Worker anahtarı ekleyip Groq'a iletir. Böylece siteyi
 * kullanan herkes kendi anahtarını girmek zorunda kalmaz.
 *
 * Gerekli secret:
 *   npx wrangler secret put GROQ_API_KEY
 */

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_ALLOWED_ORIGINS =
  'https://ekremtezcansaridag.github.io,http://localhost:*,http://127.0.0.1:*'
const ALLOWED_MODELS = new Set(['openai/gpt-oss-120b', 'openai/gpt-oss-20b'])
const MAX_BODY_BYTES = 64 * 1024
const MAX_OUTPUT_TOKENS = 2000
const DEFAULT_OUTPUT_TOKENS = 1400

function wildcardMatch(pattern, value) {
  if (pattern === '*') return true
  if (!pattern.includes('*')) return pattern === value
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`, 'i').test(value)
}

function originAllowed(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  return Boolean(origin) && allowed.some((pattern) => wildcardMatch(pattern, origin))
}

function corsHeaders(origin, env) {
  const allowed = originAllowed(origin, env)
  return {
    allowed,
    headers: {
      'Access-Control-Allow-Origin': allowed ? origin : 'https://ekremtezcansaridag.github.io',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
      'X-Content-Type-Options': 'nosniff',
    },
  }
}

function jsonResponse(payload, status, cors) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...cors.headers,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function errorResponse(status, message, cors) {
  return jsonResponse({ error: { message } }, status, cors)
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const cors = corsHeaders(origin, env)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors.headers })
    }

    if (request.method !== 'POST') {
      return errorResponse(405, 'Bu proxy yalnızca POST isteklerini kabul eder.', cors)
    }

    if (!cors.allowed) {
      return errorResponse(403, 'Bu origin proxy tarafından izinli değil.', cors)
    }

    const { pathname } = new URL(request.url)
    if (!/\/chat\/completions\/?$/.test(pathname)) {
      return errorResponse(404, 'Bilinmeyen yol. /chat/completions kullan.', cors)
    }

    if (env.AI_RATE_LIMITER) {
      const ip = request.headers.get('cf-connecting-ip') || 'unknown'
      const { success } = await env.AI_RATE_LIMITER.limit({ key: ip })
      if (!success) {
        return errorResponse(
          429,
          'Çok fazla AI isteği. Bir dakika bekleyip tekrar dene.',
          cors,
        )
      }
    }

    if (!env.GROQ_API_KEY) {
      return errorResponse(500, 'Sunucuda GROQ_API_KEY tanımlı değil.', cors)
    }

    const declaredLength = Number(request.headers.get('content-length') || 0)
    if (declaredLength > MAX_BODY_BYTES) {
      return errorResponse(413, 'İstek gövdesi çok büyük.', cors)
    }

    const raw = await request.text()
    if (raw.length > MAX_BODY_BYTES) {
      return errorResponse(413, 'İstek gövdesi çok büyük.', cors)
    }

    let body
    try {
      body = JSON.parse(raw)
    } catch {
      return errorResponse(400, 'İstek gövdesi geçerli JSON değil.', cors)
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return errorResponse(400, 'İstek gövdesi bir nesne olmalı.', cors)
    }

    if (!ALLOWED_MODELS.has(body.model)) {
      return errorResponse(
        403,
        `Bu proxy yalnızca şu modelleri destekler: ${Array.from(ALLOWED_MODELS).join(', ')}.`,
        cors,
      )
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return errorResponse(400, 'messages alanı boş olamaz.', cors)
    }

    if (body.messages.length > 40) {
      return errorResponse(400, 'Çok fazla mesaj gönderildi.', cors)
    }

    const requestedTokens = Number(body.max_completion_tokens ?? body.max_tokens)
    body.max_completion_tokens = Number.isFinite(requestedTokens)
      ? Math.max(1, Math.min(Math.trunc(requestedTokens), MAX_OUTPUT_TOKENS))
      : DEFAULT_OUTPUT_TOKENS
    delete body.max_tokens
    body.stream = false

    try {
      const upstream = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify(body),
      })

      const text = await upstream.text()
      return new Response(text, {
        status: upstream.status,
        headers: {
          ...cors.headers,
          'Content-Type':
            upstream.headers.get('Content-Type') || 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      })
    } catch {
      return errorResponse(502, 'Groq’a ulaşılamadı. Daha sonra tekrar dene.', cors)
    }
  },
}

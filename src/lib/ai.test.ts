import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Note } from '../types'
import {
  AI_PROVIDERS,
  buildPrompt,
  chatComplete,
  chatEndpoint,
  extractMermaid,
  mermaidInkUrl,
  pollinationsUrl,
} from './ai'

afterEach(() => {
  vi.restoreAllMocks()
})

const note: Note = {
  id: 'n1',
  title: 'Deneme',
  emoji: '📝',
  tags: [],
  favorite: false,
  createdAt: 1,
  updatedAt: 1,
  blocks: [
    { id: 'b1', type: 'paragraph', html: 'Merhaba dünya' },
    { id: 'b2', type: 'todo', html: 'Test yaz', checked: false },
  ],
}

describe('extractMermaid', () => {
  it('mermaid kod bloğunu ayıklar', () => {
    const text = 'İşte şema:\n\n```mermaid\nflowchart TD\n  A --> B\n```\n'
    expect(extractMermaid(text)).toBe('flowchart TD\n  A --> B')
  })

  it('dilsiz kod bloğunu da tanır', () => {
    expect(extractMermaid('```\ngraph LR\n  A --> B\n```')).toBe('graph LR\n  A --> B')
  })

  it('kod bloğu olmayan çıplak diyagramı kabul eder', () => {
    expect(extractMermaid('sequenceDiagram\n  A->>B: Merhaba')).toContain('sequenceDiagram')
  })

  it('diyagram olmayan yanıtta null döndürür', () => {
    expect(extractMermaid('Bu sadece normal bir metin.')).toBeNull()
  })
})

describe('görsel adresleri', () => {
  it('mermaid.ink için URL güvenli base64 üretir', () => {
    const url = mermaidInkUrl('flowchart TD\n  A[Merhaba] --> B[Dünya]')
    expect(url).toMatch(/^https:\/\/mermaid\.ink\/svg\/[A-Za-z0-9_-]+\?bgColor=ffffff$/)
    expect(url).not.toContain('+')
    expect(url.split('?')[0]).not.toMatch(/=$/)
  })

  it('pollinations adresine tarifi ve tohumu koyar', () => {
    const url = pollinationsUrl('ay ışığında tilki', 800, 600, 42)
    expect(url).toContain('ay%20%C4%B1%C5%9F%C4%B1%C4%9F%C4%B1nda%20tilki')
    expect(url).toContain('width=800')
    expect(url).toContain('height=600')
    expect(url).toContain('seed=42')
  })

  it('pollinations tohumunu 32 bit sınırına indirir', () => {
    const url = pollinationsUrl('test', 512, 512, Date.now())
    const seed = Number(new URL(url).searchParams.get('seed'))
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThan(2_147_483_647)
  })
})

describe('sağlayıcılar', () => {
  it('Groq doğrudan bağlantı varsayılanlarını tanımlar', () => {
    const groq = AI_PROVIDERS.groq
    expect(groq.model).toBe('openai/gpt-oss-120b')
    expect(groq.baseUrl).toBe('https://api.groq.com/openai/v1')
    expect(groq.requiresKey).toBe(true)
  })

  it('paylaşımlı Groq sağlayıcısı anahtar istemez', () => {
    const shared = AI_PROVIDERS['groq-proxy']
    expect(shared.shared).toBe(true)
    expect(shared.requiresKey).toBe(false)
    expect(shared.model).toBe('openai/gpt-oss-120b')
  })
})

describe('istek üretimi', () => {
  it('uç noktayı tamamlar ve tekrar eklemez', () => {
    expect(chatEndpoint('https://openrouter.ai/api/v1/')).toBe(
      'https://openrouter.ai/api/v1/chat/completions',
    )
    expect(chatEndpoint('https://example.com/v1/chat/completions')).toBe(
      'https://example.com/v1/chat/completions',
    )
  })

  it('notu ve ek isteği bağlama katar', () => {
    const prompt = buildPrompt('format', note, 'kısa tut', true)
    expect(prompt).toContain('Merhaba dünya')
    expect(prompt).toContain('- [ ] Test yaz')
    expect(prompt).toContain('kısa tut')
    expect(prompt).toContain('Markdown')
  })

  it('not gönderimi kapalıyken notu eklemez', () => {
    const prompt = buildPrompt('custom', note, 'Sadece fikir ver', false)
    expect(prompt).toContain('Sadece fikir ver')
    expect(prompt).not.toContain('Merhaba dünya')
  })

  it('görsel isteminde doğrudan tarifi döndürür', () => {
    expect(buildPrompt('image', note, 'pastel tilki', true)).toBe('pastel tilki')
  })

  it('Groq isteğinde max_completion_tokens ve anahtarı gönderir', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: 'tamam' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

    const result = await chatComplete(
      {
        provider: 'groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        model: 'openai/gpt-oss-120b',
        apiKey: 'gsk_test',
      },
      [{ role: 'user', content: 'selam' }],
    )

    expect(result).toBe('tamam')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.max_completion_tokens).toBe(1400)
    expect(body.max_tokens).toBeUndefined()
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer gsk_test')
  })
})

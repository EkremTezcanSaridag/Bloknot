import type { AccentId, Cover } from '../types'

export interface CoverGradient {
  id: string
  name: string
  css: string
}

export const COVER_GRADIENTS: CoverGradient[] = [
  {
    id: 'lavanta',
    name: 'Lavanta rüyası',
    css: 'linear-gradient(120deg, #b8a6ff 0%, #e7c3f5 48%, #ffd6c9 100%)',
  },
  {
    id: 'gunbatimi',
    name: 'Gün batımı',
    css: 'linear-gradient(120deg, #ff9a6b 0%, #ffc371 45%, #ffe0b2 100%)',
  },
  {
    id: 'okyanus',
    name: 'Okyanus',
    css: 'linear-gradient(120deg, #5ec7d8 0%, #7fa8f7 55%, #c2d4ff 100%)',
  },
  {
    id: 'orman',
    name: 'Orman sabahı',
    css: 'linear-gradient(120deg, #79c99e 0%, #bfe3b4 50%, #f3f0c8 100%)',
  },
  {
    id: 'kiraz',
    name: 'Kiraz çiçeği',
    css: 'linear-gradient(120deg, #ffb3c6 0%, #ffd6e0 50%, #ffeaf1 100%)',
  },
  {
    id: 'gece',
    name: 'Gece yarısı',
    css: 'linear-gradient(120deg, #2b2d5e 0%, #5b4b8a 55%, #a56bab 100%)',
  },
  {
    id: 'kagit',
    name: 'Kraft kâğıt',
    css: 'linear-gradient(120deg, #d9c3a5 0%, #efe2cd 55%, #f8f1e4 100%)',
  },
  {
    id: 'limonata',
    name: 'Limonata',
    css: 'linear-gradient(120deg, #ffe066 0%, #ffef9f 50%, #d9f7be 100%)',
  },
]

export function coverStyle(cover?: Cover): string | undefined {
  if (!cover) return undefined
  if (cover.type === 'image') {
    return `linear-gradient(to bottom, rgba(0,0,0,0.06), rgba(0,0,0,0.02)), url("${cover.src}") center / cover no-repeat`
  }
  return COVER_GRADIENTS.find((gradient) => gradient.id === cover.id)?.css
}

export const ACCENTS: Array<{ id: AccentId; name: string; color: string }> = [
  { id: 'lavanta', name: 'Lavanta', color: '#7c5cff' },
  { id: 'okyanus', name: 'Okyanus', color: '#0f9b9b' },
  { id: 'orman', name: 'Orman', color: '#3f9d4f' },
  { id: 'gunbatimi', name: 'Gün batımı', color: '#f97316' },
  { id: 'kiraz', name: 'Kiraz', color: '#e5484d' },
]

export const EMOJI_CHOICES = [
  '📝',
  '📒',
  '💡',
  '✨',
  '🌿',
  '🌙',
  '☀️',
  '🔥',
  '💜',
  '🧃',
  '🍀',
  '🍋',
  '🎧',
  '🎨',
  '📚',
  '🧠',
  '🚀',
  '🛠️',
  '🏠',
  '✈️',
  '☕',
  '🐙',
  '🦊',
  '🐝',
  '🌈',
  '⭐',
  '🎯',
  '🧩',
  '💼',
  '🎓',
  '🍰',
  '🪴',
]

export const CALLOUT_EMOJIS = ['💡', '📌', '⚠️', '✅', '💜', '🎉', '🧠', '☕']

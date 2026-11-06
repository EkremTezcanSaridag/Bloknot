import { describe, expect, it } from 'vitest'
import type { Note } from '../types'
import {
  blockToMarkdown,
  markdownToBlocks,
  noteToMarkdown,
  slugify,
} from './markdown'

describe('markdownToBlocks', () => {
  it('başlıkları ve paragrafları ayrıştırır', () => {
    const blocks = markdownToBlocks('# Başlık\n\nBir paragraf\nikinci satır')
    expect(blocks.map((block) => block.type)).toEqual(['heading1', 'paragraph'])
    expect(blocks[1].html).toBe('Bir paragraf<br>ikinci satır')
  })

  it('listeleri, yapılacakları ve alıntıları ayrıştırır', () => {
    const blocks = markdownToBlocks('- bir\n- iki\n\n- [x] bitti\n\n> alıntı')
    expect(blocks.map((block) => block.type)).toEqual([
      'bulleted',
      'bulleted',
      'todo',
      'quote',
    ])
    expect(blocks[2].checked).toBe(true)
  })

  it('kod bloklarını dil bilgisiyle ayrıştırır', () => {
    const blocks = markdownToBlocks('```ts\nconst x = 1\n```')
    expect(blocks[0].type).toBe('code')
    expect(blocks[0].language).toBe('ts')
    expect(blocks[0].html).toContain('const x = 1')
  })

  it('görsel ve ayırıcıları tanır', () => {
    const blocks = markdownToBlocks('![alt](https://a.co/a.png)\n\n---')
    expect(blocks[0].type).toBe('image')
    expect(blocks[0].src).toBe('https://a.co/a.png')
    expect(blocks[1].type).toBe('divider')
  })
})

describe('noteToMarkdown', () => {
  it('notu başlığıyla birlikte markdown’a çevirir', () => {
    const note: Note = {
      id: 'n1',
      title: 'Deneme',
      emoji: '📝',
      tags: ['test'],
      favorite: false,
      createdAt: 1,
      updatedAt: 1,
      blocks: [
        { id: 'b1', type: 'heading2', html: 'Bölüm' },
        { id: 'b2', type: 'todo', html: 'görev', checked: true },
        { id: 'b3', type: 'code', html: 'const a = 1', language: 'ts' },
      ],
    }

    const markdown = noteToMarkdown(note)
    expect(markdown).toContain('# Deneme')
    expect(markdown).toContain('## Bölüm')
    expect(markdown).toContain('- [x] görev')
    expect(markdown).toContain('```ts')
  })

  it('tek blokları doğru biçimde yazar', () => {
    expect(blockToMarkdown({ id: 'b', type: 'divider', html: '' })).toBe('---')
    expect(
      blockToMarkdown({ id: 'b', type: 'callout', html: 'not', emoji: '💜' }),
    ).toBe('> 💜 not')
  })
})

describe('slugify', () => {
  it('Türkçe karakterleri dosya adına uygunlaştırır', () => {
    expect(slugify('Çok Güzel Bir Not: Deneme')).toBe('cok-guzel-bir-not-deneme')
  })
})

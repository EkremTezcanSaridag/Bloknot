import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, htmlToText, sanitizeHtml } from './sanitize'

describe('sanitizeHtml', () => {
  it('script ve olay dinleyicilerini temizler', () => {
    const dirty = '<script>alert(1)</script><strong onclick="alert(2)">merhaba</strong>'
    expect(sanitizeHtml(dirty)).toBe('<strong>merhaba</strong>')
  })

  it('javascript: bağlantılarını etkisizleştirir', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">tıkla</a>')
    expect(result).toBe('<a>tıkla</a>')
  })

  it('güvenli bağlantılara rel ve target ekler', () => {
    const result = sanitizeHtml('<a href="https://example.com">örnek</a>')
    expect(result).toContain('rel="noopener noreferrer"')
    expect(result).toContain('target="_blank"')
    expect(result).toContain('href="https://example.com"')
  })

  it('div ve p etiketlerini satır sonuna çevirir', () => {
    expect(sanitizeHtml('<div>bir</div><div>iki</div>')).toBe('bir<br>iki')
  })

  it('biçimlendirme etiketlerini korur', () => {
    expect(sanitizeHtml('<b>kalın</b> <i>italik</i> <code>kod</code>')).toBe(
      '<b>kalın</b> <i>italik</i> <code>kod</code>',
    )
  })

  it('izinli metin boyutu ve rengi sınıflarını korur', () => {
    expect(
      sanitizeHtml('<span class="bn-text-size-lg bn-text-color-red">renkli</span>'),
    ).toBe('<span class="bn-text-size-lg bn-text-color-red">renkli</span>')
  })

  it('span üzerindeki izinsiz sınıf ve olay dinleyicilerini temizler', () => {
    const result = sanitizeHtml(
      '<span class="bn-text-size-lg evil" onclick="alert(1)">metin</span>',
    )
    expect(result).toBe('<span class="bn-text-size-lg">metin</span>')
  })

  it('sınıfı kalmayan spanı kaldırır', () => {
    expect(sanitizeHtml('<span style="color:red">metin</span>')).toBe('metin')
    expect(sanitizeHtml('<span class="text-size-huge">metin</span>')).toBe('metin')
  })

  it('punto değerini ve rengi birlikte korur', () => {
    expect(
      sanitizeHtml(
        '<span class="bn-text-pt bn-text-color-red" style="--bn-text-pt: 13.5pt">metin</span>',
      ),
    ).toBe(
      '<span class="bn-text-pt bn-text-color-red" style="--bn-text-pt: 13.5pt">metin</span>',
    )
  })

  it('punto dışındaki stilleri ve izinsiz sınıfları temizler', () => {
    expect(
      sanitizeHtml('<span class="bn-text-pt" style="--bn-text-pt: 13pt; color:red">metin</span>'),
    ).toBe('metin')
  })

  it('punto aralığını 6–200 pt ile sınırlar', () => {
    expect(
      sanitizeHtml('<span class="bn-text-pt" style="--bn-text-pt: 4pt">metin</span>'),
    ).toBe('metin')
    expect(
      sanitizeHtml('<span class="bn-text-pt" style="--bn-text-pt: 500pt">metin</span>'),
    ).toBe('metin')
  })

  it('punto sınıfı olmayan stili korumaz', () => {
    expect(
      sanitizeHtml('<span class="bn-text-color-red" style="--bn-text-pt: 13pt">metin</span>'),
    ).toBe('<span class="bn-text-color-red">metin</span>')
  })
})

describe('htmlToText', () => {
  it('etiketleri temizler ve boşlukları toparlar', () => {
    expect(htmlToText('<strong>merhaba</strong>   dünya<br>yeni satır')).toBe(
      'merhaba dünya yeni satır',
    )
  })
})

describe('htmlToMarkdown', () => {
  it('satır içi biçimleri markdown’a çevirir', () => {
    expect(htmlToMarkdown('<strong>kalın</strong> ve <em>italik</em>')).toBe(
      '**kalın** ve *italik*',
    )
  })

  it('bağlantıları ve kodu korur', () => {
    expect(htmlToMarkdown('<a href="https://a.co">git</a> <code>x=1</code>')).toBe(
      '[git](https://a.co) `x=1`',
    )
  })
})

import type { Block, BlockType, Note } from '../types'
import { createId } from './id'
import { newBlock } from './markdown'
import { escapeHtml } from './sanitize'

function b(type: BlockType, html = '', patch: Partial<Block> = {}): Block {
  return newBlock(type, { html, ...patch })
}

export const WRITING_PROMPTS = [
  'Bugün beni gülümseten üç küçük şey neydi?',
  'Çocukluğundan hatırladığın en tuhaf koku hangisi?',
  'Bir günlüğüne başka bir şehirde yaşasan nereyi seçerdin?',
  'Son zamanlarda sık sık düşündüğün bir cümle yaz.',
  'Sana ilham veren bir insanı ve nedenini anlat.',
  'Bugün öğrendiğin en gereksiz ama en eğlenceli bilgi ne?',
  'Kendine bir süper güç seçecek olsan ne olurdu?',
  'Bir kitabı yeniden yazsan hangi sonu değiştirirdin?',
  'Bugün yapmak istemediğin ama iyi ki yaptığın şey neydi?',
  'On yıl sonraki sana üç cümlelik bir mektup yaz.',
  'En sevdiğin kokunun peşinden giden bir hikâye başlat.',
  'Az önce aklından geçen ilk cümleyi buraya yaz. Gerçekten.',
]

function createWelcomeNote(now: number): Note {
  return {
    id: createId('n'),
    title: "Bloknot'a hoş geldin",
    emoji: '👋',
    cover: { type: 'gradient', id: 'lavanta' },
    tags: ['başlangıç'],
    favorite: true,
    createdAt: now,
    updatedAt: now,
    blocks: [
      b(
        'callout',
        "<strong>Burası senin kişisel defterin.</strong> Hesap yok, sunucu yok: notların sadece bu tarayıcıda saklanır.",
        { emoji: '💜' },
      ),
      b(
        'paragraph',
        'Yazmaya başlamak için herhangi bir yere tıkla. Her satır ayrı bir bloktur; istediğin gibi sürükle, böl, birleştir.',
      ),
      b('heading2', 'Neler yapabilirsin?'),
      b('todo', 'Bir bloğun solundaki tutamaçtan tutup sürükle', { checked: false }),
      b('todo', 'Satır başında <code>/</code> yazıp blok menüsünü aç', { checked: false }),
      b('todo', 'Ctrl/Cmd + K ile notlarda ve komutlarda ara', { checked: false }),
      b('todo', 'Sağ üstteki paylaş düğmesiyle salt okunur bağlantı üret', { checked: false }),
      b('bulleted', 'Yapılacakları işaretleyince küçük bir konfeti partisi olur 🎉'),
      b('bulleted', 'Ayarlardan tema ve vurgu rengini değiştirebilirsin'),
      b('bulleted', 'Notlarını JSON olarak yedekleyip başka cihazda geri yükleyebilirsin'),
      b('quote', 'İyi bir not, aklındakinden daha düzenli görünmek zorunda değil. Karala, sonra toparla.'),
      b('heading2', 'Kısayollar'),
      b(
        'code',
        escapeHtml(
          [
            'Ctrl/Cmd + K   →  komut paleti',
            'Ctrl/Cmd + N   →  yeni not',
            'Ctrl/Cmd + B   →  kalın',
            'Ctrl/Cmd + I   →  italik',
            '# + boşluk    →  başlık',
            '- + boşluk    →  madde',
            '[] + boşluk   →  yapılacak',
          ].join('\n'),
        ),
        { language: 'text' },
      ),
      b('divider'),
      b('paragraph', '<em>Hadi başlayalım. İlk notun seni bekliyor ✨</em>'),
    ],
  }
}

function createIdeaNote(now: number): Note {
  const prompts = WRITING_PROMPTS.slice(0, 6)

  return {
    id: createId('n'),
    title: 'Fikir kutusu',
    emoji: '🧃',
    cover: { type: 'gradient', id: 'limonata' },
    tags: ['ilham', 'eğlence'],
    favorite: false,
    createdAt: now - 1000,
    updatedAt: now - 1000,
    blocks: [
      b(
        'callout',
        'Tıkandığında buradan rastgele bir soru seç. Cevabı mükemmel yazmak zorunda değilsin, sadece başla.',
        { emoji: '💡' },
      ),
      b('heading2', 'Bu haftanın soruları'),
      ...prompts.map((prompt) => b('bulleted', prompt)),
      b('heading2', 'Aklıma gelenler'),
      b('todo', 'Kendi sorularımı buraya ekle', { checked: false }),
    ],
  }
}

function createTodoNote(now: number): Note {
  return {
    id: createId('n'),
    title: 'Bugünün küçük planı',
    emoji: '✅',
    tags: ['plan'],
    favorite: false,
    createdAt: now - 2000,
    updatedAt: now - 2000,
    blocks: [
      b('paragraph', 'Büyük planlar değil, bugünü kurtaran üç küçük adım.'),
      b('todo', 'Bir bardak su iç', { checked: true }),
      b('todo', 'En önemli işe 25 dakika ayır', { checked: false }),
      b('todo', 'On dakika yürüyüş yap', { checked: false }),
      b('divider'),
      b('quote', 'Yarın daha iyi olacaksa, bugün küçük bir şey yeter.'),
    ],
  }
}

export function createSeedNotes(): Note[] {
  const now = Date.now()
  return [createWelcomeNote(now), createIdeaNote(now), createTodoNote(now)]
}

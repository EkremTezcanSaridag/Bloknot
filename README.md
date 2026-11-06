# Bloknot 📝

Bloknot, tarayıcında çalışan; hesap açmadan kullanabileceğin, blok tabanlı ve eğlenceli bir kişisel not defteri. Notion'ın rahatlığını daha küçük, daha sıcak ve tamamen yerel bir uygulamada arıyor.

**Canlı sürüm:** https://ekremtezcansaridag.github.io/Bloknot/

## Neden Bloknot?

- **Hesap yok, sunucu yok.** Notların yalnızca senin tarayıcında (IndexedDB) saklanır.
- **Blok tabanlı düzenleme.** Başlık, liste, yapılacak, alıntı, not kutusu, kod, görsel ve daha fazlası.
- **Sürükle-bırak.** Blokları tutamaçtan tutup istediğin yere taşı.
- **Markdown kısayolları.** `#`, `-`, `[]`, `>`, ` ``` ` ile hızlıca blok oluştur.
- **Slash menüsü.** Boş satırda `/` yaz, blok türünü seç.
- **Bağlantıyla paylaşım.** Notu URL'ye sıkıştırıp salt okunur bağlantı olarak gönder; karşı taraf tek tıkla kendi defterine kopyalasın.
- **Yedekleme.** JSON yedeği indir/geri yükle, Markdown içe/dışa aktar, son 5 anlık yedeği geri döndür.
- **Tema ve vurgu rengi.** Açık/koyu/sistem teması ve beş farklı vurgu rengi.
- **AI asistan.** Notunu düzelt, özetle, şekillendir; Mermaid şeması veya anahtarsız AI görseli ekle. Groq, OpenRouter, xAI ve OpenAI uyumlu uç noktalar desteklenir.
- **Küçük mutluluklar.** Yapılacak işi tamamlayınca konfeti, hafif arayüz sesleri, ilham soruları.
- **Çevrimdışı PWA.** Ana ekrana ekle, internet olmadan da yaz.
- **Mobil uyumlu.** Telefonda da rahat kullanılır.

## Teknolojiler

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Zustand (persist) + IndexedDB
- dnd-kit, Framer Motion, lucide-react, lz-string
- Vitest + Testing Library
- GitHub Actions → GitHub Pages
- vite-plugin-pwa (Workbox)

## Geliştirme

```bash
npm install
npm run dev
```

Diğer komutlar:

```bash
npm test          # birim testleri
npm run build     # üretim derlemesi
npm run preview   # derlemeyi yerelde önizle
npm run icons     # PWA ikonlarını yeniden üret (Windows)
```

## Verilerin nerede?

Notlar **IndexedDB** içinde, yalnızca bu tarayıcıda tutulur. Tarayıcı verilerini temizlersen notlar silinir. Bu yüzden Ayarlar → Yedekleme bölümünden ara sıra JSON yedeği almanı öneririz.

Paylaşım bağlantılarında not içeriği sıkıştırılmış olarak URL'nin `#/p/...` kısmında taşınır. Yani paylaşılan not bir sunucuya yüklenmez; bağlantıyı alan kişi içeriği kendi tarayıcısında açar. Genel adreslerde paylaşım bağlantısı her zaman HTTPS olarak üretilir.

Metinde seçim yapınca açılan biçimlendirme çubuğundan yazı **puntosunu** ve rengini değiştirebilirsin. Punto menüsü 6–200 pt arasını destekler; hızlı seçeneklerin yanında serbest değer de girilebilir. Bu stiller serbest CSS yerine yalnızca izin verilen güvenli sınıf ve doğrulanmış punto değişkeniyle saklanır; paylaşılan notlarda da görünür.

## AI Asistan

Sağ üstteki **AI** düğmesiyle notunu düzeltebilir, özetleyebilir, başlık/listelere bölebilir, fikir üretebilir, Mermaid şeması çizebilir veya anahtarsız AI görseli üretebilirsin. Sonuçları nota ekleyebilir ya da notun tamamını değiştirebilirsin. Ayrıca her bloğun sağ üstünde beliren **✨ AI** düğmesiyle o bloğa özel istem yazabilirsin: boş bir blokta “AI hakkında bir başlık aç ve alt başlıklarda açıklama yap” gibi bir istemle başlık, alt başlık ve açıklama blokları üretebilir; dolu bir blokta **Düzelt** ile blok türünü koruyarak yazımı düzelttirebilir veya **Oluştur** ile çok bloklu yeni içerik hazırlayabilirsin. AI sonucu değiştirilmiş bir bloğa uygulanmaz; önce önizlersin.

**Paylaşımlı anahtar (herkes için tek anahtar):**

Siteyi kullanan herkesin anahtar girmesini istemiyorsan Groq anahtarını Cloudflare Worker'da sakla. Worker adresini `VITE_GROQ_PROXY_URL` olarak tanımladığında uygulama otomatik olarak **Groq (paylaşımlı)** sağlayıcısını kullanır; ziyaretçiler anahtar görmez. Kurulum: [worker/README.md](worker/README.md).

**Kendi anahtarınla doğrudan Groq:**

1. [console.groq.com/keys](https://console.groq.com/keys) üzerinden ücretsiz bir Groq API anahtarı oluştur.
2. AI panelinde sağlayıcı olarak **Groq (kendi anahtarım)** seç. Varsayılan model `openai/gpt-oss-120b`.
3. Anahtarı **API anahtarı** alanına yapıştır. İstekler tarayıcıdan doğrudan `api.groq.com` adresine gider.

Alternatif olarak **OpenRouter**, **xAI** veya OpenAI uyumlu özel bir uç nokta da seçebilirsin. Groq metin üretir; AI görselleri Groq yerine anahtarsız Pollinations servisiyle oluşturulur. Şemalar Mermaid kodu olarak üretilip görsele çevrilir.

Kendi anahtarların varsayılan olarak yalnızca sekmede tutulur. İstersen "Bu cihazda hatırla" ile localStorage'a kaydedebilirsin. Paylaşımlı modda anahtar tarayıcıya hiç inmez; Cloudflare Worker'da kalır.

## GitHub Pages'e yayınlama

1. Depoyu `main` dalına gönder.
2. GitHub'da **Settings → Pages** bölümüne git.
3. **Build and deployment → Source** olarak **GitHub Actions** seç.
4. `.github/workflows/deploy.yml` her `main` push'unda testleri çalıştırır, derler ve yayınlar.

Yayın adresi: `https://ekremtezcansaridag.github.io/Bloknot/`

## Kısayollar

| Kısayol | İşlev |
| --- | --- |
| `Ctrl/Cmd + K` | Komut paleti |
| `Ctrl/Cmd + N` | Yeni not |
| `Ctrl/Cmd + B` | Kalın |
| `Ctrl/Cmd + I` | İtalik |
| `Ctrl/Cmd + U` | Altı çizili |
| `#` + boşluk | Başlık 1 |
| `##` + boşluk | Başlık 2 |
| `-` + boşluk | Madde listesi |
| `[]` + boşluk | Yapılacak |
| `>` + boşluk | Alıntı |
| `/` | Blok menüsü |

## Lisans

MIT © Ekrem Tezcan Sarıdağ

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

Paylaşım bağlantılarında not içeriği sıkıştırılmış olarak URL'nin `#/p/...` kısmında taşınır. Yani paylaşılan not bir sunucuya yüklenmez; bağlantıyı alan kişi içeriği kendi tarayıcısında açar.

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

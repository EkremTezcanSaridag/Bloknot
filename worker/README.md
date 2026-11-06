# Paylaşımlı Groq proxy'si (Cloudflare Worker)

Bloknot statik bir GitHub Pages uygulaması. Groq anahtarını doğrudan siteye koyarsan herkes görebilir. Bu Worker, anahtarı **Cloudflare secret** olarak saklar; site yalnızca Worker'a istek atar.

## Ne yapar?

- `POST /chat/completions` isteklerini Groq'un OpenAI uyumlu uç noktasına iletir.
- `GROQ_API_KEY` secret'ını sunucu tarafında ekler; tarayıcıya asla göndermez.
- Yalnızca `https://ekremtezcansaridag.github.io` ve localhost origin'lerine izin verir.
- Yalnızca `openai/gpt-oss-120b` ve `openai/gpt-oss-20b` modellerine izin verir.
- İstek boyutunu ve çıktı token sayısını sınırlar.
- IP başına dakikada 30 istek sınırı uygular.

## 1. Cloudflare hesabı

Ücretsiz bir [Cloudflare](https://dash.cloudflare.com/sign-up) hesabı aç. Workers ücretsiz planı günde 100.000 istek verir; kişisel kullanım için fazlasıyla yeterli.

## 2. Worker'ı yayınla

Bu klasörde (`Bloknot/worker`) terminal aç:

```bash
npx wrangler login
npx wrangler deploy
npx wrangler secret put GROQ_API_KEY
```

`wrangler deploy` Worker'ı oluşturur ve `https://bloknot-groq.<hesap-adın>.workers.dev` adresini verir. Ardından `secret put` Groq anahtarını soracak. [console.groq.com/keys](https://console.groq.com/keys) üzerinden oluşturduğun anahtarı yapıştır. Anahtar repoya yazılmaz, yalnızca Cloudflare'de saklanır. Secret eklendiğinde Worker otomatik güncellenir; tekrar deploy etmen gerekmez.

Çıktıda şuna benzer bir adres göreceksin:

```
https://bloknot-groq.<hesap-adın>.workers.dev
```

Bu adresi not al. Sonunda `/` olmasın.

## 3. Bloknot'a bağla

GitHub'da depoya git:

**Settings → Secrets and variables → Actions → Variables → New repository variable**

| Alan | Değer |
| --- | --- |
| Name | `VITE_GROQ_PROXY_URL` |
| Value | `https://bloknot-groq.<hesap-adın>.workers.dev` |

Sonra **Actions → GitHub Pages'e yayınla → Run workflow** ile yeniden yayınla. Yeni ziyaretçiler otomatik olarak **Groq (paylaşımlı)** sağlayıcısını görür ve anahtar girmek zorunda kalmaz.

> Alternatif: Worker adresini bana verirsen ben de `VITE_GROQ_PROXY_URL` değerini koda/GitHub'a ekleyip yeniden yayınlayabilirim. Groq anahtarını bana göndermen gerekmez.

## 4. Test et

Tarayıcı konsolunda veya terminalde CORS kontrolü:

```bash
curl -i -X OPTIONS "https://bloknot-groq.<hesap-adın>.workers.dev/chat/completions" \
  -H "Origin: https://ekremtezcansaridag.github.io" \
  -H "Access-Control-Request-Method: POST"
```

`204` ve `Access-Control-Allow-Origin` başlığını görmelisin.

## Yerel geliştirme

`worker/.dev.vars` dosyasına (git tarafından yok sayılır) şunu yaz:

```
GROQ_API_KEY=gsk_...
```

Sonra:

```bash
npx wrangler dev
```

## Güvenlik notları

- `GROQ_API_KEY` yalnızca Cloudflare secret olarak durur. GitHub'a, koda veya tarayıcıya koyma.
- Origin kontrolü tarayıcı dışından taklit edilebilir. Bu yüzden model whitelist'i, gövde/token sınırı ve IP rate limit'i de var. Daha güçlü koruma istersen Cloudflare Turnstile veya Access ekleyebilirsin.
- Anahtar sızarsa Groq konsolundan iptal edip yenisini oluştur, sonra `npx wrangler secret put GROQ_API_KEY` ile güncelle.
- Worker adresi herkese açıktır; gizli bir anahtar değildir. Asıl gizli olan Groq API anahtarıdır.
- `ALLOWED_ORIGINS` değerini `wrangler.jsonc` içinden değiştirebilirsin.

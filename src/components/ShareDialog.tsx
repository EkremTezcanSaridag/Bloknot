import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, Download, ExternalLink, Info, Link2, Share2, ShieldCheck } from 'lucide-react'
import { useStore } from '../store/useStore'
import { createShortShare, encodeNote } from '../lib/share'
import { copyText } from '../lib/clipboard'
import { downloadText, noteToMarkdown, slugify } from '../lib/markdown'
import { noteSnippet } from '../lib/search'
import { Modal } from './Modal'

export function ShareDialog() {
  const dialog = useStore((state) => state.dialog)
  const shareNoteId = useStore((state) => state.shareNoteId)
  const note = useStore((state) => state.notes.find((item) => item.id === shareNoteId))
  const closeDialog = useStore((state) => state.closeDialog)
  const pushToast = useStore((state) => state.pushToast)

  const [shortUrl, setShortUrl] = useState<string | null>(null)
  const [isCreatingShort, setIsCreatingShort] = useState(false)
  const [shortError, setShortError] = useState(false)

  const link = useMemo(() => (note ? encodeNote(note) : null), [note])

  const createShortLink = useCallback(async () => {
    if (!link) return

    setShortUrl(null)
    setShortError(false)
    setIsCreatingShort(true)
    try {
      const url = await createShortShare(link.token)
      if (url) {
        setShortUrl(url)
      } else {
        setShortError(true)
      }
    } catch {
      setShortError(true)
    } finally {
      setIsCreatingShort(false)
    }
  }, [link])

  useEffect(() => {
    if (dialog !== 'share' || !link) {
      setShortUrl(null)
      setShortError(false)
      setIsCreatingShort(false)
      return
    }

    void createShortLink()
  }, [createShortLink, dialog, link])

  if (!note || !link) return null

  const copy = async () => {
    if (!shortUrl) return
    const ok = await copyText(shortUrl)
    pushToast(
      ok ? 'Kısa paylaşım bağlantısı kopyalandı.' : 'Bağlantı kopyalanamadı.',
      ok ? 'success' : 'danger',
    )
  }

  const nativeShare = async () => {
    if (!shortUrl) return
    try {
      await navigator.share({
        title: note.title || 'Bloknot notu',
        text: 'Bloknot’ta paylaşılan bir not',
        url: shortUrl,
      })
    } catch {
      // Kullanıcı paylaşımı iptal etmiş olabilir.
    }
  }

  const whatsapp = () => {
    if (!shortUrl) return
    const text = encodeURIComponent(`${note.title || 'Bir not'} — Bloknot\n${shortUrl}`)
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  const downloadMarkdown = () => {
    downloadText(
      `${slugify(note.title || 'bloknot')}.md`,
      noteToMarkdown(note),
      'text/markdown;charset=utf-8',
    )
    pushToast('Markdown dosyası indirildi.', 'success')
  }

  const snippet = noteSnippet(note)

  return (
    <Modal
      open={dialog === 'share'}
      onClose={closeDialog}
      title="Notu paylaş"
      subtitle="Bağlantıyı açan kişi notu salt okunur görür. Hesap gerekmez."
      size="md"
    >
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-2xl">
            {note.emoji}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold">{note.title || 'Başlıksız not'}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-soft)]">
              {snippet || 'Boş not'}
            </p>
          </div>
        </div>
        {note.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {note.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[0.62rem] font-bold text-[var(--accent)]"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        <label className="mb-1.5 flex items-center gap-1.5 text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-[var(--text-faint)]">
          <Link2 className="size-3.5" />
          Paylaşım bağlantısı
        </label>
        <div className="flex gap-2">
          <input
            readOnly
            value={shortUrl ?? ''}
            placeholder={
              shortError ? 'Kısa bağlantı oluşturulamadı' : 'Kısa bağlantı hazırlanıyor...'
            }
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text-soft)] outline-none focus:border-[var(--accent)]"
            aria-label="Paylaşım bağlantısı"
          />
          {shortError && (
            <button
              type="button"
              onClick={() => void createShortLink()}
              disabled={isCreatingShort}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-extrabold text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] disabled:opacity-60"
            >
              <Link2 className="size-3.5" />
              Tekrar dene
            </button>
          )}
          <button
            type="button"
            onClick={() => void copy()}
            disabled={!shortUrl || isCreatingShort}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-extrabold text-[var(--accent-ink)] transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
          >
            <Copy className="size-3.5" />
            Kopyala
          </button>
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.65rem] font-semibold text-[var(--text-faint)]">
          <ShieldCheck
            className={
              shortError ? 'size-3.5 text-amber-600' : 'size-3.5 text-[var(--success)]'
            }
          />
          {shortUrl
            ? 'Kısa bağlantı hazır'
            : shortError
              ? 'Kısa bağlantı oluşturulamadı, tekrar dene.'
              : 'Kısa bağlantı hazırlanıyor...'}
        </p>
      </div>

      {shortError && link.tooBig && (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-700 dark:text-amber-300">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Not çok büyük olduğu için kısa bağlantı oluşturulamadı. Görselleri kaldırıp tekrar
            dene ya da Markdown olarak indir.
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!shortUrl || isCreatingShort}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs font-bold transition hover:bg-[var(--surface-2)] disabled:opacity-60"
        >
          <Check className="size-4" />
          Bağlantıyı al
        </button>
        <button
          type="button"
          onClick={whatsapp}
          disabled={!shortUrl || isCreatingShort}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs font-bold transition hover:bg-[var(--surface-2)] disabled:opacity-60"
        >
          <ExternalLink className="size-4" />
          WhatsApp
        </button>
        {'share' in navigator ? (
          <button
            type="button"
            onClick={() => void nativeShare()}
            disabled={!shortUrl || isCreatingShort}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs font-bold transition hover:bg-[var(--surface-2)] disabled:opacity-60"
          >
            <Share2 className="size-4" />
            Cihazda paylaş
          </button>
        ) : (
          <button
            type="button"
            onClick={downloadMarkdown}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs font-bold transition hover:bg-[var(--surface-2)]"
          >
            <Download className="size-4" />
            Markdown indir
          </button>
        )}
      </div>

      <div className="mt-4 rounded-xl bg-[var(--surface-2)] p-3">
        <p className="flex items-start gap-2 text-[0.7rem] font-medium leading-relaxed text-[var(--text-soft)]">
          <Info className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]" />
          Bağlantıyı açan arkadaşın notu görüntüleyebilir ve “Defterime kopyala” ile kendi Bloknot’una
          ekleyebilir. Senin defterindeki hali değişmez.
        </p>
      </div>
    </Modal>
  )
}

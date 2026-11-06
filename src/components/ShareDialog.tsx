import { useMemo } from 'react'
import { Check, Copy, Download, ExternalLink, Info, Link2, Share2, ShieldCheck } from 'lucide-react'
import { useStore } from '../store/useStore'
import { encodeNote } from '../lib/share'
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

  const link = useMemo(() => (note ? encodeNote(note) : null), [note])

  if (!note || !link) return null

  const copy = async () => {
    const ok = await copyText(link.url)
    pushToast(
      ok ? 'Paylaşım bağlantısı kopyalandı.' : 'Bağlantı kopyalanamadı.',
      ok ? 'success' : 'danger',
    )
  }

  const nativeShare = async () => {
    try {
      await navigator.share({
        title: note.title || 'Bloknot notu',
        text: 'Bloknot’ta paylaşılan bir not',
        url: link.url,
      })
    } catch {
      // Kullanıcı paylaşımı iptal etmiş olabilir.
    }
  }

  const whatsapp = () => {
    const text = encodeURIComponent(`${note.title || 'Bir not'} — Bloknot\n${link.url}`)
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
  const isHttps = link.url.startsWith('https://')

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
            value={link.url}
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text-soft)] outline-none focus:border-[var(--accent)]"
            aria-label="Paylaşım bağlantısı"
          />
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-extrabold text-[var(--accent-ink)] transition hover:bg-[var(--accent-strong)]"
          >
            <Copy className="size-3.5" />
            Kopyala
          </button>
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.65rem] font-semibold text-[var(--text-faint)]">
          <ShieldCheck className="size-3.5 text-[var(--success)]" />
          {isHttps ? 'HTTPS ile açılır' : 'Yerel geliştirme bağlantısı'} ·{' '}
          {Math.max(1, Math.round(link.length / 1024))} KB · Notun içeriği bağlantının içinde
          taşınır.
        </p>
      </div>

      {link.tooBig && (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-700 dark:text-amber-300">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Not çok büyük (görseller bağlantıyı şişiriyor). Bağlantı bazı uygulamalarda açılmayabilir.
            Görselleri kaldırıp tekrar dene ya da Markdown olarak indir.
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs font-bold transition hover:bg-[var(--surface-2)]"
        >
          <Check className="size-4" />
          Bağlantıyı al
        </button>
        <button
          type="button"
          onClick={whatsapp}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs font-bold transition hover:bg-[var(--surface-2)]"
        >
          <ExternalLink className="size-4" />
          WhatsApp
        </button>
        {'share' in navigator ? (
          <button
            type="button"
            onClick={() => void nativeShare()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs font-bold transition hover:bg-[var(--surface-2)]"
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

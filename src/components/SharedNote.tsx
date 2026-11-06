import { useEffect, useMemo } from 'react'
import { AlertTriangle, ArrowLeft, CopyPlus, Eye, Link2 } from 'lucide-react'
import type { SharedNote as SharedNoteData } from '../lib/share'
import { decodeSharedNote } from '../lib/share'
import { coverStyle } from '../lib/covers'
import { useStore } from '../store/useStore'
import { decodeHtmlText } from '../lib/dom'
import { htmlToText, sanitizeHtml } from '../lib/sanitize'
import { LogoMark } from './Logo'

export function SharedNote({ token }: { token: string }) {
  const createNote = useStore((state) => state.createNote)
  const pushToast = useStore((state) => state.pushToast)

  const shared = useMemo(() => decodeSharedNote(token), [token])

  useEffect(() => {
    const previous = document.title
    document.title = shared?.title ? `${shared.title} · Bloknot` : 'Paylaşılan not · Bloknot'
    return () => {
      document.title = previous
    }
  }, [shared?.title])

  const goHome = () => {
    window.location.hash = ''
  }

  if (!shared) {
    return (
      <div className="flex min-h-dvh flex-col bg-[var(--bg)]">
        <SimpleHeader onHome={goHome} />
        <div className="flex flex-1 items-center justify-center px-5 py-16">
          <div className="paper-panel max-w-md rounded-3xl p-8 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--danger-soft)] text-[var(--danger)]">
              <AlertTriangle className="size-6" />
            </div>
            <h1 className="font-display mt-4 text-2xl font-bold">Bu bağlantı çalışmıyor</h1>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Bağlantı eksik veya bozulmuş olabilir. Notu paylaşan kişiden yeniden göndermesini isteyebilirsin.
            </p>
            <button
              type="button"
              onClick={goHome}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-extrabold text-[var(--accent-ink)]"
            >
              <ArrowLeft className="size-4" />
              Bloknot’a dön
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <SharedNoteView shared={shared} onCopy={() => copyToNotebook(shared)} />

  function copyToNotebook(note: SharedNoteData) {
    createNote({
      title: note.title,
      emoji: note.emoji,
      cover: note.cover,
      tags: note.tags,
      blocks: note.blocks,
    })
    pushToast('Not kendi defterine kopyalandı.', 'success')
    goHome()
  }
}

function SharedNoteView({ shared, onCopy }: { shared: SharedNoteData; onCopy: () => void }) {
  const words = shared.blocks.reduce(
    (total, block) => total + htmlToText(block.html).split(/\s+/).filter(Boolean).length,
    0,
  )
  let number = 0

  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)]/70 bg-[var(--bg)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => {
              window.location.hash = ''
            }}
            className="flex items-center gap-2"
            aria-label="Bloknot ana sayfa"
          >
            <LogoMark className="size-7" />
            <span className="text-base font-black tracking-tight">Bloknot</span>
          </button>

          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[0.62rem] font-bold text-[var(--text-faint)]">
            <Eye className="size-3" />
            Salt okunur
          </span>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-2.5 py-2 text-xs font-extrabold text-[var(--accent-ink)] transition hover:bg-[var(--accent-strong)] sm:px-3.5"
            >
              <CopyPlus className="size-4" />
              <span>Defterime kopyala</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl pb-20">
        {shared.cover && (
          <div className="h-40 w-full sm:h-52" style={{ background: coverStyle(shared.cover) }}>
            <div className="h-full w-full bg-gradient-to-t from-[var(--bg)]/60 to-transparent" />
          </div>
        )}

        <div className={`px-5 sm:px-12 ${shared.cover ? '-mt-10' : 'pt-8'}`}>
          <div className="relative z-10 grid size-[72px] place-items-center rounded-3xl border border-[var(--border)] bg-[var(--surface)] text-5xl shadow-[var(--shadow-pop)] sm:size-[84px]">
            {shared.emoji}
          </div>

          <h1 className="font-display mt-4 text-[2rem] font-bold leading-[1.12] tracking-tight sm:text-[2.7rem]">
            {shared.title || 'Başlıksız not'}
          </h1>

          {shared.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {shared.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--accent)]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[0.7rem] font-semibold text-[var(--text-faint)]">
            <Link2 className="size-3.5" />
            Bloknot bağlantısıyla paylaşıldı · salt okunur
            {words > 0 && <span>· {words} kelime</span>}
          </p>
        </div>

        <article className="readonly-note mt-7 space-y-2 px-5 sm:px-12">
          {shared.blocks.map((block) => {
            if (block.type === 'numbered') {
              number += 1
            } else {
              number = 0
            }

            return <ReadOnlyBlock key={block.id} block={block} number={number} />
          })}
        </article>

        <div className="mx-5 mt-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center shadow-[var(--shadow-pop)] sm:mx-12">
          <p className="font-display text-xl font-bold">Bu not hoşuna gitti mi?</p>
          <p className="mt-1 text-sm text-[var(--text-soft)]">
            Kendi defterine kopyala, dilediğin gibi düzenle. Hesap açmana gerek yok.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-extrabold text-[var(--accent-ink)] transition hover:bg-[var(--accent-strong)]"
            >
              <CopyPlus className="size-4" />
              Defterime kopyala
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.hash = ''
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-bold transition hover:bg-[var(--surface-2)]"
            >
              Bloknot’u aç
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-[0.65rem] font-semibold text-[var(--text-faint)]">
          Bloknot · yerel, ücretsiz, eğlenceli not defteri
        </p>
      </main>
    </div>
  )
}

function SimpleHeader({ onHome }: { onHome: () => void }) {
  return (
    <header className="border-b border-[var(--border)]/70 bg-[var(--bg)]/85">
      <div className="mx-auto flex h-14 max-w-4xl items-center px-4">
        <button type="button" onClick={onHome} className="flex items-center gap-2">
          <LogoMark className="size-7" />
          <span className="text-base font-black tracking-tight">Bloknot</span>
        </button>
      </div>
    </header>
  )
}

function ReadOnlyBlock({ block, number }: { block: SharedNoteData['blocks'][number]; number: number }) {
  const html = sanitizeHtml(block.html)

  switch (block.type) {
    case 'heading1':
      return (
        <h2
          className="font-display pt-5 text-3xl font-bold leading-tight tracking-tight"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )
    case 'heading2':
      return (
        <h3
          className="font-display pt-4 text-2xl font-bold leading-snug"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )
    case 'heading3':
      return (
        <h4
          className="pt-3 text-lg font-extrabold leading-snug"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )
    case 'bulleted':
      return (
        <div className="flex items-start gap-2.5 pl-1 text-[16px] leading-7">
          <span className="mt-[0.68em] size-[5px] shrink-0 rounded-full bg-[var(--accent)]" />
          <div className="editable min-w-0 flex-1" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )
    case 'numbered':
      return (
        <div className="flex items-start gap-2.5 pl-1 text-[16px] leading-7">
          <span className="mt-0.5 min-w-5 shrink-0 text-right text-sm font-bold text-[var(--text-faint)]">
            {number}.
          </span>
          <div className="editable min-w-0 flex-1" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )
    case 'todo':
      return (
        <div className="flex items-start gap-2.5 text-[16px] leading-7">
          <span
            className={`mt-1 grid size-[18px] shrink-0 place-items-center rounded-[5px] border-2 ${
              block.checked
                ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
                : 'border-[var(--border-strong)]'
            }`}
          >
            {block.checked && (
              <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M2 6.5 4.5 9 10 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <div
            className={`editable min-w-0 flex-1 ${block.checked ? 'text-[var(--text-faint)] line-through' : ''}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )
    case 'quote':
      return (
        <blockquote
          className="border-l-[3px] border-[var(--accent)] pl-4 text-[16px] italic leading-7 text-[var(--text-soft)]"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )
    case 'callout':
      return (
        <div className="flex items-start gap-2.5 rounded-2xl bg-[var(--accent-soft)] px-3.5 py-3 text-[15px] leading-7">
          <span className="text-xl leading-none">{block.emoji ?? '💡'}</span>
          <div className="editable min-w-0 flex-1" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )
    case 'code':
      return (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
          <div className="border-b border-[var(--border)] px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-[var(--text-faint)]">
            {block.language ?? 'text'}
          </div>
          <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[13px] leading-6">
            <code>{decodeHtmlText(block.html)}</code>
          </pre>
        </div>
      )
    case 'divider':
      return <hr className="my-4 border-[var(--border-strong)]" />
    case 'image':
      return block.src ? (
        <figure className="overflow-hidden rounded-2xl border border-[var(--border)]">
          <img src={block.src} alt={block.caption || 'Paylaşılan görsel'} className="max-h-[520px] w-full object-cover" />
          {block.caption && (
            <figcaption className="border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center text-xs text-[var(--text-soft)]">
              {block.caption}
            </figcaption>
          )}
        </figure>
      ) : null
    default:
      return (
        <p
          className="editable text-[16px] leading-7"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )
  }
}

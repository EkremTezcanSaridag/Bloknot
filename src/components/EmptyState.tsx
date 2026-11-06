import { useState } from 'react'
import { ArrowRight, LayoutTemplate, Plus, Sparkles } from 'lucide-react'
import { useStore } from '../store/useStore'
import { WRITING_PROMPTS } from '../lib/seed'
import { greeting } from '../lib/date'

export function EmptyState() {
  const createNote = useStore((state) => state.createNote)
  const openDialog = useStore((state) => state.openDialog)
  const notes = useStore((state) => state.notes)
  const [promptIndex, setPromptIndex] = useState(() => Math.floor(Math.random() * WRITING_PROMPTS.length))

  const hasNotes = notes.some((note) => !note.trashedAt)
  const prompt = WRITING_PROMPTS[promptIndex]

  return (
    <div className="relative flex h-full flex-col overflow-y-auto">
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl text-center">
          <div className="animate-float mx-auto mb-6 grid size-20 place-items-center rounded-[28px] border border-[var(--border)] bg-[var(--surface)] text-4xl shadow-[var(--shadow-pop)]">
            {hasNotes ? '🗂️' : '🪴'}
          </div>

          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            {greeting()}
          </p>
          <h1 className="font-display mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            {hasNotes ? 'Hangi notu açalım?' : 'Bugün ne yazıyoruz?'}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] text-[var(--text-soft)]">
            {hasNotes
              ? 'Soldan bir not seç ya da yepyeni bir sayfa aç. Her şey senin tarayıcında, senin kontrolünde.'
              : 'Bloklarla yaz, sürükle, karala. Hesap açmana gerek yok; defterin açılmaya hazır.'}
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              onClick={() => createNote()}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-extrabold text-[var(--accent-ink)] shadow-[0_10px_24px_-12px_var(--accent)] transition hover:bg-[var(--accent-strong)] active:scale-[0.98]"
            >
              <Plus className="size-4" />
              Yeni not
            </button>
            <button
              type="button"
              onClick={() => openDialog('templates')}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-bold transition hover:bg-[var(--surface-2)]"
            >
              <LayoutTemplate className="size-4" />
              Şablonlar
            </button>
          </div>

          <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left shadow-[var(--shadow-pop)]">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                <Sparkles className="size-3.5 text-[var(--accent)]" />
                İlham
              </span>
              <button
                type="button"
                onClick={() =>
                  setPromptIndex((index) => (index + 1 + Math.floor(Math.random() * 4)) % WRITING_PROMPTS.length)
                }
                className="text-xs font-bold text-[var(--accent)] transition hover:opacity-70"
              >
                Başka soru
              </button>
            </div>
            <p className="font-display mt-2 text-lg leading-snug">{prompt}</p>
            <button
              type="button"
              onClick={() => createNote({ title: prompt })}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--text-soft)] transition hover:text-[var(--accent)]"
            >
              Bu soruyla başla
              <ArrowRight className="size-3.5" />
            </button>
          </div>

          <p className="mt-6 text-xs text-[var(--text-faint)]">
            Notların bu cihazda kalır. Ara sıra ayarlardan yedek almayı unutma.
          </p>
        </div>
      </div>
    </div>
  )
}

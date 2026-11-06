import { ArrowRight, FilePlus2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { TEMPLATES } from '../lib/templates'
import { Modal } from './Modal'

const TEMPLATE_COVERS: Record<string, string> = {
  toplanti: 'lavanta',
  gunluk: 'limonata',
  fikir: 'orman',
  kitap: 'okyanus',
  seyahat: 'kiraz',
  ders: 'gece',
}

export function TemplatesDialog() {
  const dialog = useStore((state) => state.dialog)
  const closeDialog = useStore((state) => state.closeDialog)
  const createNote = useStore((state) => state.createNote)
  const pushToast = useStore((state) => state.pushToast)

  return (
    <Modal
      open={dialog === 'templates'}
      onClose={closeDialog}
      title="Şablonlar"
      subtitle="Hazır bir iskeletle başla, sonra kendi hâline getir."
      size="lg"
    >
      <div className="grid gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            createNote()
            pushToast('Boş not açıldı.', 'success')
          }}
          className="group flex items-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border-strong)] p-3.5 text-left transition hover:border-[var(--accent)] hover:bg-[var(--accent-mist)]"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)] transition group-hover:text-[var(--accent)]">
            <FilePlus2 className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-extrabold">Boş sayfa</span>
            <span className="block text-xs text-[var(--text-faint)]">Tamamen sıfırdan başla</span>
          </span>
        </button>

        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => {
              createNote({
                title: template.name,
                emoji: template.emoji,
                tags: template.tags,
                blocks: template.blocks,
                cover: { type: 'gradient', id: TEMPLATE_COVERS[template.id] ?? 'lavanta' },
              })
              pushToast(`“${template.name}” şablonuyla not oluşturuldu.`, 'success')
            }}
            className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-left transition hover:-translate-y-0.5 hover:border-[var(--accent)]/40 hover:shadow-[var(--shadow-pop)]"
          >
            <div
              className="relative flex h-16 items-end px-3.5 pb-2"
              style={{ background: template.accent }}
            >
              <span className="absolute right-3 top-2.5 text-2xl transition group-hover:scale-110">
                {template.emoji}
              </span>
              <span className="rounded-full bg-black/15 px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wider text-white backdrop-blur-sm">
                {template.tags[0]}
              </span>
            </div>
            <div className="flex items-start gap-2 p-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold">{template.name}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-soft)]">{template.description}</p>
              </div>
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-[var(--text-faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
            </div>
          </button>
        ))}
      </div>
    </Modal>
  )
}

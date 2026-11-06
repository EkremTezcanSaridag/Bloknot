import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useStore } from '../store/useStore'

const ICONS = {
  default: Info,
  success: CheckCircle2,
  danger: AlertTriangle,
}

const TONES = {
  default: 'text-[var(--text)]',
  success: 'text-[var(--success)]',
  danger: 'text-[var(--danger)]',
}

export function Toasts() {
  const toasts = useStore((state) => state.toasts)
  const dismissToast = useStore((state) => state.dismissToast)

  if (!toasts.length) return null

  return (
    <div
      className="pointer-events-none fixed bottom-5 left-1/2 z-[95] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone]
        return (
          <div
            key={toast.id}
            className="animate-fade-up pointer-events-auto flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-pop)]"
          >
            <Icon className={`size-4.5 shrink-0 ${TONES[toast.tone]}`} />
            <p className="min-w-0 flex-1 text-sm font-semibold">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="grid size-6 shrink-0 place-items-center rounded-full text-[var(--text-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              aria-label="Bildirimi kapat"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

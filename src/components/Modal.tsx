import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  footer?: ReactNode
}

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
}

export function Modal({ open, onClose, title, subtitle, children, size = 'md', footer }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const timer = window.setTimeout(() => panelRef.current?.focus(), 20)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.clearTimeout(timer)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 backdrop-blur-[3px] sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Pencere'}
        className={`animate-fade-up flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] outline-none sm:rounded-3xl ${SIZES[size]}`}
      >
        {(title || subtitle) && (
          <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-6">
            <div>
              {title && <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-sm text-[var(--text-soft)]">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--text-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            >
              <X className="size-4.5" />
            </button>
          </header>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {footer && (
          <footer className="border-t border-[var(--border)] bg-[var(--surface-2)]/60 px-5 py-3.5 sm:px-6">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}

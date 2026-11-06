interface LogoMarkProps {
  className?: string
  withSpark?: boolean
}

/** Bloknot'un iki bloklu, küçük kıvılcımlı işareti. */
export function LogoMark({ className = 'size-8', withSpark = true }: LogoMarkProps) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="Bloknot logosu">
      <rect x="5" y="9" width="22" height="9" rx="4.5" fill="var(--accent)" opacity="0.42" />
      <rect x="11" y="17" width="24" height="14" rx="5" fill="var(--accent)" />
      <path
        d="M17.5 24.2h11"
        stroke="var(--accent-ink)"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.9"
      />
      {withSpark && (
        <path
          d="M33.2 6.2c.5 2.3 1.3 3.1 3.6 3.6-2.3.5-3.1 1.3-3.6 3.6-.5-2.3-1.3-3.1-3.6-3.6 2.3-.5 3.1-1.3 3.6-3.6Z"
          fill="var(--accent)"
          opacity="0.75"
        />
      )}
    </svg>
  )
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className="size-8.5" />
      {!compact && (
        <div className="leading-none">
          <p className="text-[1.2rem] font-black tracking-tight">Bloknot</p>
          <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            kişisel defter
          </p>
        </div>
      )}
    </div>
  )
}

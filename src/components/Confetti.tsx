import { useEffect, useState, type CSSProperties } from 'react'
import { useStore } from '../store/useStore'

interface Piece {
  id: number
  left: number
  drift: number
  spin: number
  duration: number
  delay: number
  size: number
  color: string
  round: boolean
}

const COLORS = ['#7c5cff', '#f97316', '#0f9b9b', '#e5484d', '#f5b301', '#3f9d4f', '#ff8fb1']

export function Confetti() {
  const burst = useStore((state) => state.burst)
  const enabled = useStore((state) => state.settings.confetti)
  const [pieces, setPieces] = useState<Piece[]>([])

  useEffect(() => {
    if (!burst || !enabled) return

    const next = Array.from({ length: 34 }, (_, index) => ({
      id: burst * 100 + index,
      left: Math.random() * 100,
      drift: (Math.random() - 0.5) * 260,
      spin: 360 + Math.random() * 900,
      duration: 1300 + Math.random() * 900,
      delay: Math.random() * 180,
      size: 6 + Math.random() * 8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      round: Math.random() > 0.55,
    }))

    setPieces(next)
    const timer = window.setTimeout(() => setPieces([]), 2600)
    return () => window.clearTimeout(timer)
  }, [burst, enabled])

  if (!pieces.length) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden" aria-hidden="true">
      {pieces.map((piece) => {
        const style = {
          left: `${piece.left}%`,
          width: piece.size,
          height: piece.size * (piece.round ? 1 : 1.7),
          background: piece.color,
          borderRadius: piece.round ? '999px' : '2px',
          animation: `confetti-fall ${piece.duration}ms cubic-bezier(0.2, 0.6, 0.35, 1) ${piece.delay}ms forwards`,
          '--drift': `${piece.drift}px`,
          '--spin': `${piece.spin}deg`,
        } as CSSProperties

        return <span key={piece.id} className="absolute top-0 block" style={style} />
      })}
    </div>
  )
}

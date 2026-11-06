import { useEffect, useState } from 'react'
import { useStore } from './store/useStore'
import { maybeSaveSnapshot } from './lib/backup'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/editor/Editor'
import { CommandPalette } from './components/CommandPalette'
import { SettingsDialog } from './components/SettingsDialog'
import { TemplatesDialog } from './components/TemplatesDialog'
import { ShareDialog } from './components/ShareDialog'
import { AiDialog } from './components/AiDialog'
import { Toasts } from './components/Toasts'
import { Confetti } from './components/Confetti'
import { FormattingToolbar } from './components/editor/FormattingToolbar'
import { SharedNote } from './components/SharedNote'
import { LogoMark } from './components/Logo'

type Route = { kind: 'app' } | { kind: 'share'; token: string }

function readRoute(): Route {
  const hash = window.location.hash
  if (hash.startsWith('#/p/')) {
    return { kind: 'share', token: hash.slice(4) }
  }
  return { kind: 'app' }
}

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(readRoute)

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return route
}

function useSystemDark(): boolean {
  const [dark, setDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return dark
}

export default function App() {
  const route = useRoute()
  const systemDark = useSystemDark()

  const hydrated = useStore((state) => state.hydrated)
  const initialize = useStore((state) => state.initialize)
  const settings = useStore((state) => state.settings)
  const notes = useStore((state) => state.notes)
  const focusMode = useStore((state) => state.focusMode)
  const sidebarOpen = useStore((state) => state.sidebarOpen)
  const setSidebarOpen = useStore((state) => state.setSidebarOpen)
  const setPaletteOpen = useStore((state) => state.setPaletteOpen)
  const createNote = useStore((state) => state.createNote)

  const activeNote = useStore((state) =>
    state.activeNoteId ? state.notes.find((note) => note.id === state.activeNoteId) : undefined,
  )

  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', isDark)
    root.dataset.accent = settings.accent
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', isDark ? '#1b1917' : '#faf8f4')
  }, [isDark, settings.accent])

  useEffect(() => {
    if (!hydrated) return
    initialize()
  }, [hydrated, initialize])

  useEffect(() => {
    document.title = activeNote?.title
      ? `${activeNote.title} · Bloknot`
      : 'Bloknot — eğlenceli not defteri'
  }, [activeNote?.title])

  useEffect(() => {
    if (!hydrated) return
    const timer = window.setTimeout(() => {
      void maybeSaveSnapshot(notes)
    }, 12_000)
    return () => window.clearTimeout(timer)
  }, [notes, hydrated])

  useEffect(() => {
    if (!hydrated) return
    const interval = window.setInterval(() => {
      void maybeSaveSnapshot(useStore.getState().notes)
    }, 5 * 60_000)
    return () => window.clearInterval(interval)
  }, [hydrated])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey

      if (mod && event.key.toLocaleLowerCase('tr') === 'k') {
        event.preventDefault()
        setPaletteOpen(!useStore.getState().paletteOpen)
        return
      }

      if (mod && !event.shiftKey && event.key.toLocaleLowerCase('tr') === 'n') {
        event.preventDefault()
        createNote()
        return
      }

      if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) {
        setSidebarOpen(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [setPaletteOpen, createNote, setSidebarOpen])

  if (!hydrated) {
    return <Splash />
  }

  if (route.kind === 'share') {
    return (
      <>
        <SharedNote token={route.token} />
        <Toasts />
      </>
    )
  }

  return (
    <div
      className="flex h-dvh overflow-hidden bg-[var(--bg)] text-[var(--text)]"
      data-compact={settings.compact ? 'true' : 'false'}
    >
      {!focusMode && <Sidebar />}

      {sidebarOpen && !focusMode && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Menüyü kapat"
        />
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <Editor />
      </main>

      <CommandPalette />
      <SettingsDialog />
      <TemplatesDialog />
      <ShareDialog />
      <AiDialog />
      <Toasts />
      <Confetti />
      <FormattingToolbar />
    </div>
  )
}

function Splash() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[var(--bg)] px-6">
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative flex flex-col items-center text-center">
        <div className="animate-float grid size-20 place-items-center rounded-[26px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-pop)]">
          <LogoMark className="size-11" />
        </div>
        <p className="font-display mt-6 text-3xl font-bold tracking-tight">Bloknot</p>
        <p className="mt-1.5 text-sm font-semibold text-[var(--text-soft)]">Defterin açılıyor…</p>
        <div className="mt-5 flex gap-1.5" aria-hidden="true">
          <span className="size-1.5 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:-0.2s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:-0.1s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-[var(--accent)]" />
        </div>
      </div>
      <p className="absolute bottom-6 text-[0.65rem] font-semibold text-[var(--text-faint)]">
        Yerel · ücretsiz · senin defterin
      </p>
    </div>
  )
}

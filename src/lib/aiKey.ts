const SESSION_KEY = 'bloknot:ai-key'
const REMEMBERED_KEY = 'bloknot:ai-key-remembered'

function safeSession(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function safeLocal(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Anahtar önce sekmede tutulur; kullanıcı isterse bu cihazda da saklanır. */
export function getAiKey(): string {
  const session = safeSession()
  const local = safeLocal()
  return session?.getItem(SESSION_KEY) || local?.getItem(REMEMBERED_KEY) || ''
}

export function hasRememberedAiKey(): boolean {
  return Boolean(safeLocal()?.getItem(REMEMBERED_KEY))
}

export function saveAiKey(key: string, remember: boolean): void {
  const cleaned = key.trim()
  const session = safeSession()
  const local = safeLocal()

  if (cleaned) {
    session?.setItem(SESSION_KEY, cleaned)
  } else {
    session?.removeItem(SESSION_KEY)
  }

  if (remember && cleaned) {
    local?.setItem(REMEMBERED_KEY, cleaned)
  } else {
    local?.removeItem(REMEMBERED_KEY)
  }
}

export function forgetAiKey(): void {
  safeSession()?.removeItem(SESSION_KEY)
  safeLocal()?.removeItem(REMEMBERED_KEY)
}

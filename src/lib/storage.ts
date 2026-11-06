const DB_NAME = 'bloknot-db'
const DB_VERSION = 1
const STORE_NAME = 'kv'

let dbPromise: Promise<IDBDatabase | null> | null = null
let idbBroken = false

function openDb(): Promise<IDBDatabase | null> {
  if (idbBroken || typeof indexedDB === 'undefined') {
    return Promise.resolve(null)
  }

  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    let request: IDBOpenDBRequest

    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      idbBroken = true
      resolve(null)
      return
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)

    request.onerror = () => {
      idbBroken = true
      resolve(null)
    }

    request.onblocked = () => {
      idbBroken = true
      resolve(null)
    }
  })

  return dbPromise
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb()

  if (!db) {
    return fallbackGet<T>(key)
  }

  return new Promise<T | undefined>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(key)
      request.onsuccess = () => resolve(request.result as T | undefined)
      request.onerror = () => resolve(fallbackGet<T>(key))
    } catch {
      resolve(fallbackGet<T>(key))
    }
  })
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await openDb()

  if (!db) {
    fallbackSet(key, value)
    return
  }

  return new Promise<void>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(value, key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => {
        fallbackSet(key, value)
        resolve()
      }
    } catch {
      fallbackSet(key, value)
      resolve()
    }
  })
}

export async function idbRemove(key: string): Promise<void> {
  const db = await openDb()

  if (!db) {
    fallbackRemove(key)
    return
  }

  return new Promise<void>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).delete(key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

/* localStorage / bellek yedeği (gizli mod veya IDB kapalıysa) */

function fallbackGet<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

function fallbackSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Depo dolu ya da erişim yok; sessizce devam et.
  }
}

function fallbackRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // yoksay
  }
}

/* Zustand persist için gecikmeli yazma */

const pending = new Map<string, string>()
let flushTimer: ReturnType<typeof setTimeout> | null = null
let registered = false

function registerFlush(): void {
  if (registered || typeof window === 'undefined') return
  registered = true
  window.addEventListener('pagehide', () => {
    void flushStorage()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushStorage()
  })
}

export async function flushStorage(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }

  const entries = Array.from(pending.entries())
  pending.clear()

  await Promise.all(entries.map(([key, value]) => idbSet(key, value)))
}

function scheduleWrite(key: string, value: string): void {
  registerFlush()
  pending.set(key, value)

  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    void flushStorage()
  }, 220)
}

export const appStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const value = await idbGet<string>(name)
    return value ?? null
  },
  setItem: (name: string, value: string): void => {
    scheduleWrite(name, value)
  },
  removeItem: async (name: string): Promise<void> => {
    pending.delete(name)
    await idbRemove(name)
  },
}

/** Depolama alanı tahmini (bayt). Desteklenmiyorsa null. */
export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    return { usage, quota }
  } catch {
    return null
  }
}

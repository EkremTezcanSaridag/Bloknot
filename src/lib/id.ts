/** Kısa, çakışma ihtimali düşük kimlik üretir. */
export function createId(prefix = ''): string {
  const bytes = new Uint8Array(9)

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }

  const body = Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0')).join('')
  return prefix ? `${prefix}_${body}` : body
}

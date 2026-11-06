/** Panoya kopyalar; Clipboard API yoksa eski yönteme düşer. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const element = document.createElement('textarea')
      element.value = text
      element.style.position = 'fixed'
      element.style.opacity = '0'
      document.body.append(element)
      element.select()
      const ok = document.execCommand('copy')
      element.remove()
      return ok
    } catch {
      return false
    }
  }
}

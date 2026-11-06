const MAX_INPUT_BYTES = 12 * 1024 * 1024
const MAX_DIMENSION = 1500

export async function imageFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Lütfen bir görsel dosyası seç.')
  }

  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('Görsel çok büyük. 12 MB altındaki bir dosya seç.')
  }

  const dataUrl = await readAsDataUrl(file)

  // Küçük görselleri yeniden sıkıştırmadan kullan.
  if (file.size < 220_000) {
    return dataUrl
  }

  const image = await loadImage(dataUrl)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return dataUrl

  context.drawImage(image, 0, 0, width, height)

  const webp = canvas.toDataURL('image/webp', 0.84)
  if (webp.startsWith('data:image/webp')) return webp
  return canvas.toDataURL('image/jpeg', 0.86)
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Görsel okunamadı.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Görsel yüklenemedi.'))
    image.src = src
  })
}

export function isImageDataUrl(value: string): boolean {
  return /^data:image\//i.test(value)
}

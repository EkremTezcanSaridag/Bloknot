/**
 * Blok içi metin boyutu ve rengi için güvenli sınıf adları.
 * Bu sınıflar sanitizeHtml tarafından korunur; serbest CSS kabul edilmez.
 */

export interface TextStyleOption {
  id: string
  label: string
  className: string
  preview: string
}

export const TEXT_SIZE_CLASS_PREFIX = 'bn-text-size-'
export const TEXT_COLOR_CLASS_PREFIX = 'bn-text-color-'

export const TEXT_SIZE_OPTIONS: TextStyleOption[] = [
  { id: 'sm', label: 'Küçük', className: 'bn-text-size-sm', preview: '0.82em' },
  { id: 'md', label: 'Normal', className: '', preview: '1em' },
  { id: 'lg', label: 'Büyük', className: 'bn-text-size-lg', preview: '1.18em' },
  { id: 'xl', label: 'Çok büyük', className: 'bn-text-size-xl', preview: '1.42em' },
]

export interface TextColorOption {
  id: string
  label: string
  className: string
  swatch: string
}

export const TEXT_COLOR_OPTIONS: TextColorOption[] = [
  { id: 'default', label: 'Varsayılan', className: '', swatch: 'var(--text)' },
  { id: 'accent', label: 'Vurgu', className: 'bn-text-color-accent', swatch: 'var(--accent)' },
  { id: 'red', label: 'Kırmızı', className: 'bn-text-color-red', swatch: '#e5484d' },
  { id: 'orange', label: 'Turuncu', className: 'bn-text-color-orange', swatch: '#f76b15' },
  { id: 'green', label: 'Yeşil', className: 'bn-text-color-green', swatch: '#30a46c' },
  { id: 'blue', label: 'Mavi', className: 'bn-text-color-blue', swatch: '#0090ff' },
  { id: 'purple', label: 'Mor', className: 'bn-text-color-purple', swatch: '#8e4ec6' },
  { id: 'pink', label: 'Pembe', className: 'bn-text-color-pink', swatch: '#d6409f' },
  { id: 'gray', label: 'Gri', className: 'bn-text-color-gray', swatch: '#6b7280' },
]

export const ALLOWED_TEXT_STYLE_CLASSES = new Set(
  [...TEXT_SIZE_OPTIONS, ...TEXT_COLOR_OPTIONS]
    .map((option) => option.className)
    .filter(Boolean),
)

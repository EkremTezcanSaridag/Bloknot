const timeFormatter = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit',
})

const dayFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
})

const weekdayFormatter = new Intl.DateTimeFormat('tr-TR', {
  weekday: 'long',
})

const fullFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function relativeTime(timestamp: number, now = Date.now()): string {
  const diff = now - timestamp
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return 'az önce'
  if (diff < hour) return `${Math.floor(diff / minute)} dk önce`

  const date = new Date(timestamp)
  const today = new Date(now)
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()

  if (isToday) return timeFormatter.format(date)

  const yesterday = new Date(now - day)
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()

  if (isYesterday) return `Dün ${timeFormatter.format(date)}`
  if (diff < 7 * day) return weekdayFormatter.format(date)
  if (date.getFullYear() === today.getFullYear()) return dayFormatter.format(date)
  return date.getFullYear().toString()
}

export function dayGroup(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp)
  const today = new Date(now)

  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()

  const diffDays = Math.round((startOfDay(today) - startOfDay(date)) / 86_400_000)

  if (diffDays <= 0) return 'Bugün'
  if (diffDays === 1) return 'Dün'
  if (diffDays < 7) return 'Bu hafta'
  if (diffDays < 30) return 'Bu ay'
  return 'Daha eski'
}

export function fullDate(timestamp: number): string {
  return fullFormatter.format(new Date(timestamp))
}

export function greeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 6) return 'İyi geceler'
  if (hour < 12) return 'Günaydın'
  if (hour < 18) return 'İyi günler'
  return 'İyi akşamlar'
}

export function readingTime(wordCount: number): string {
  const minutes = Math.max(1, Math.ceil(wordCount / 200))
  return `${minutes} dk okuma`
}

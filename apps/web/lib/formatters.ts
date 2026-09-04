const longDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const numberFormatter = new Intl.NumberFormat('pt-BR')

function dateFromYmd(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, year, month, day] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12))
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatSessionDate(value: string) {
  const date = dateFromYmd(value)
  return date ? longDateFormatter.format(date) : 'Data não informada'
}

export function formatDuration(value: number | null) {
  if (value === null || !Number.isFinite(value) || value <= 0) return 'Duração não informada'
  const totalMinutes = Math.max(1, Math.round(value / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (!hours) return `${minutes} min`
  return minutes ? `${hours}h${String(minutes).padStart(2, '0')}` : `${hours}h`
}

export function formatCount(value: number) {
  return numberFormatter.format(Math.max(0, Math.trunc(value)))
}

export function displaySessionTitle(title: string, sessionDate: string) {
  const technicalTitle = /^sess[aã]o\s+craig\b/i.test(title) || /^\d{8}[-_ ]sess[aã]o\b/i.test(title)
  return technicalTitle && sessionDate ? `Sessão de ${formatSessionDate(sessionDate)}` : title
}

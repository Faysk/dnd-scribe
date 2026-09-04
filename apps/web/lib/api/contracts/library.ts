export type LibrarySession = Readonly<{
  sourceSessionId: string
  title: string
  sessionDate: string
  arc: string
  status: string
  durationMs: number | null
  summary: string
  hasSummary: boolean
  coverImageUrl: string
  heroImageUrl: string
  segments: number
  participants: number
  createdAt: string
  updatedAt: string
}>

export type LibrarySessionsPayload = Readonly<{
  ok: boolean
  campaignSlug: string
  sessions: readonly LibrarySession[]
}>

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function count(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function httpsUrl(value: unknown) {
  const raw = text(value)
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'https:' ? parsed.toString() : ''
  } catch {
    return ''
  }
}

function parseSession(value: unknown): LibrarySession {
  const item = record(value)
  if (!item) throw new Error('Sessão inválida na resposta da biblioteca.')

  const sourceSessionId = text(item.sourceSessionId)
  const title = text(item.title)
  if (!sourceSessionId || !title) {
    throw new Error('Sessão da biblioteca sem identificador ou título.')
  }

  return {
    sourceSessionId,
    title,
    sessionDate: text(item.sessionDate),
    arc: text(item.arc),
    status: text(item.status),
    durationMs: nullableNumber(item.durationMs),
    summary: text(item.summary),
    hasSummary: item.hasSummary === true,
    coverImageUrl: httpsUrl(item.coverImageUrl),
    heroImageUrl: httpsUrl(item.heroImageUrl),
    segments: count(item.segments),
    participants: count(item.participants),
    createdAt: text(item.createdAt),
    updatedAt: text(item.updatedAt),
  }
}

export function parseLibrarySessionsPayload(value: unknown): LibrarySessionsPayload {
  const payload = record(value)
  if (!payload || !Array.isArray(payload.sessions)) {
    throw new Error('Resposta inválida da biblioteca de sessões.')
  }

  return {
    ok: payload.ok !== false,
    campaignSlug: text(payload.campaignSlug),
    sessions: payload.sessions.map(parseSession),
  }
}

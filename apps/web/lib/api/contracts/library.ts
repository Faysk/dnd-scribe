import { normalizeArtworkUrl } from '../../artwork'

const LIBRARY_MAX_SESSIONS = 1_000

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
  ok: true
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

function bounded(value: unknown, maxLength: number, field: string) {
  const normalized = text(value)
  if (normalized.length > maxLength) throw new Error(`Resposta da biblioteca excede o limite de ${field}.`)
  return normalized
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

function parseSession(value: unknown): LibrarySession {
  const item = record(value)
  if (!item) throw new Error('Sessão inválida na resposta da biblioteca.')

  const sourceSessionId = bounded(item.sourceSessionId, 220, 'identificador')
  const title = bounded(item.title, 500, 'título')
  if (!sourceSessionId || !title) {
    throw new Error('Sessão da biblioteca sem identificador ou título.')
  }

  return {
    sourceSessionId,
    title,
    sessionDate: bounded(item.sessionDate, 80, 'data'),
    arc: bounded(item.arc, 300, 'arco'),
    status: bounded(item.status, 80, 'status'),
    durationMs: nullableNumber(item.durationMs),
    summary: bounded(item.summary, 20_000, 'resumo'),
    hasSummary: item.hasSummary === true,
    coverImageUrl: normalizeArtworkUrl(item.coverImageUrl),
    heroImageUrl: normalizeArtworkUrl(item.heroImageUrl),
    segments: count(item.segments),
    participants: count(item.participants),
    createdAt: bounded(item.createdAt, 80, 'createdAt'),
    updatedAt: bounded(item.updatedAt, 80, 'updatedAt'),
  }
}

export function parseLibrarySessionsPayload(value: unknown): LibrarySessionsPayload {
  const payload = record(value)
  if (payload?.ok !== true || !Array.isArray(payload.sessions)) {
    throw new Error('Resposta inválida da biblioteca de sessões.')
  }
  if (payload.sessions.length > LIBRARY_MAX_SESSIONS) {
    throw new Error('Resposta da biblioteca excede o limite de sessões.')
  }

  const campaignSlug = bounded(payload.campaignSlug, 120, 'campaignSlug')
  if (!campaignSlug) throw new Error('Resposta da biblioteca sem campanha.')

  return {
    ok: true,
    campaignSlug,
    sessions: payload.sessions.map(parseSession),
  }
}

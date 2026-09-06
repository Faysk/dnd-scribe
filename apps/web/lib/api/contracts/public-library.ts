import { normalizeArtworkUrl } from '../../artwork'

const PUBLIC_LIBRARY_MAX_SESSIONS = 500
const PUBLIC_SUMMARY_MAX_LENGTH = 4_000
const PUBLIC_SUMMARY_FULL_MAX_LENGTH = 200_000

export type PublicSession = Readonly<{
  sourceSessionId: string
  title: string
  sessionDate: string
  arc: string
  summary: string
  hasSummary: boolean
  coverImageUrl: string
  heroImageUrl: string
}>

export type PublicSessionDetail = PublicSession & Readonly<{
  summaryFull: string
}>

export type PublicSessionsPayload = Readonly<{
  ok: true
  campaignSlug: string
  sessions: readonly PublicSession[]
}>

export type PublicSessionPayload = Readonly<{
  ok: true
  campaignSlug: string
  session: PublicSessionDetail
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
  if (normalized.length > maxLength) throw new Error(`Resposta pública excede o limite de ${field}.`)
  return normalized
}

function parsePublicSession(value: unknown): PublicSession {
  const item = record(value)
  if (!item) throw new Error('Sessão inválida na memória pública.')

  const sourceSessionId = bounded(item.sourceSessionId, 220, 'identificador')
  const title = bounded(item.title, 500, 'título')
  if (!sourceSessionId || !title) throw new Error('Sessão pública sem identificador ou título.')

  return {
    sourceSessionId,
    title,
    sessionDate: bounded(item.sessionDate, 80, 'data'),
    arc: bounded(item.arc, 300, 'arco'),
    summary: bounded(item.summary, PUBLIC_SUMMARY_MAX_LENGTH, 'resumo'),
    hasSummary: item.hasSummary === true,
    coverImageUrl: normalizeArtworkUrl(item.coverImageUrl),
    heroImageUrl: normalizeArtworkUrl(item.heroImageUrl),
  }
}

function parseCampaignSlug(value: unknown) {
  const campaignSlug = bounded(value, 120, 'campaignSlug')
  if (!campaignSlug) throw new Error('Resposta pública sem campanha.')
  return campaignSlug
}

export function parsePublicSessionsPayload(value: unknown): PublicSessionsPayload {
  const payload = record(value)
  if (payload?.ok !== true || !Array.isArray(payload.sessions)) {
    throw new Error('Resposta inválida da memória pública.')
  }
  if (payload.sessions.length > PUBLIC_LIBRARY_MAX_SESSIONS) {
    throw new Error('Resposta pública excede o limite de sessões.')
  }

  return {
    ok: true,
    campaignSlug: parseCampaignSlug(payload.campaignSlug),
    sessions: payload.sessions.map(parsePublicSession),
  }
}

export function parsePublicSessionPayload(value: unknown): PublicSessionPayload {
  const payload = record(value)
  if (payload?.ok !== true) throw new Error('Resposta inválida da memória pública.')

  const base = parsePublicSession(payload.session)
  const sessionRecord = record(payload.session)
  if (!sessionRecord) throw new Error('Sessão pública inválida.')

  return {
    ok: true,
    campaignSlug: parseCampaignSlug(payload.campaignSlug),
    session: {
      ...base,
      summaryFull: bounded(sessionRecord.summaryFull, PUBLIC_SUMMARY_FULL_MAX_LENGTH, 'resumo completo'),
    },
  }
}

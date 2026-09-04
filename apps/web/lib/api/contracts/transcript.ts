import { normalizeArtworkUrl } from '../../artwork'

export const TRANSCRIPT_PAGE_SIZE = 120
export const TRANSCRIPT_SOURCE_SESSION_ID_MAX_LENGTH = 220
export const TRANSCRIPT_CURSOR_MAX_LENGTH = 1200
export const TRANSCRIPT_QUERY_MAX_LENGTH = 120
export const TRANSCRIPT_SPEAKER_MAX_LENGTH = 120

export type TranscriptSession = Readonly<{
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
  updatedAt: string
}>

export type TranscriptSegment = Readonly<{
  id: string
  startMs: number | null
  endMs: number | null
  speaker: string
  text: string
}>

export type TranscriptPayload = Readonly<{
  session: TranscriptSession
  segments: readonly TranscriptSegment[]
  speakers: readonly string[]
  total: number
  nextCursor: string | null
}>

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function count(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0
}

function parseSession(value: unknown): TranscriptSession {
  const item = record(value)
  if (!item) throw new Error('Transcrição sem dados da sessão.')
  const sourceSessionId = text(item.sourceSessionId)
  const title = text(item.title)
  if (!sourceSessionId || !title) throw new Error('Transcrição sem identificador ou título da sessão.')

  return {
    sourceSessionId,
    title,
    sessionDate: text(item.sessionDate),
    arc: text(item.arc),
    status: text(item.status),
    durationMs: nullableNumber(item.durationMs),
    summary: text(item.summary),
    hasSummary: item.hasSummary === true,
    coverImageUrl: normalizeArtworkUrl(item.coverImageUrl),
    heroImageUrl: normalizeArtworkUrl(item.heroImageUrl),
    updatedAt: text(item.updatedAt),
  }
}

function parseSegment(value: unknown): TranscriptSegment {
  const item = record(value)
  if (!item) throw new Error('Fala inválida na transcrição.')
  const id = text(item.id)
  const segmentText = text(item.text)
  if (!id || !segmentText) throw new Error('Fala sem identificador ou texto.')

  return {
    id,
    startMs: nullableNumber(item.startMs),
    endMs: nullableNumber(item.endMs),
    speaker: text(item.speaker) || 'Mesa',
    text: segmentText,
  }
}

export function parseTranscriptPayload(value: unknown): TranscriptPayload {
  const payload = record(value)
  if (!payload || !Array.isArray(payload.segments) || !Array.isArray(payload.speakers)) {
    throw new Error('Resposta inválida da transcrição.')
  }

  return {
    session: parseSession(payload.session),
    segments: payload.segments.map(parseSegment),
    speakers: payload.speakers.map(text).filter(Boolean),
    total: count(payload.total),
    nextCursor: text(payload.nextCursor) || null,
  }
}

import { normalizeArtworkUrl } from '../../artwork'

export const TRANSCRIPT_PAGE_SIZE = 120
export const TRANSCRIPT_SOURCE_SESSION_ID_MAX_LENGTH = 220
export const TRANSCRIPT_CURSOR_MAX_LENGTH = 1200
export const TRANSCRIPT_QUERY_MAX_LENGTH = 120
export const TRANSCRIPT_SPEAKER_MAX_LENGTH = 120
const TRANSCRIPT_SEGMENT_TEXT_MAX_LENGTH = 20_000
const TRANSCRIPT_SEGMENT_ID_MAX_LENGTH = 220
const TRANSCRIPT_SPEAKER_LIST_MAX_LENGTH = 300

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

function bounded(value: unknown, maxLength: number, field: string) {
  const normalized = text(value)
  if (normalized.length > maxLength) throw new Error(`Resposta da transcrição excede o limite de ${field}.`)
  return normalized
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
  const sourceSessionId = bounded(item.sourceSessionId, TRANSCRIPT_SOURCE_SESSION_ID_MAX_LENGTH, 'identificador')
  const title = bounded(item.title, 500, 'título')
  if (!sourceSessionId || !title) throw new Error('Transcrição sem identificador ou título da sessão.')

  return {
    sourceSessionId,
    title,
    sessionDate: bounded(item.sessionDate, 80, 'data'),
    arc: bounded(item.arc, 300, 'arco'),
    status: bounded(item.status, 80, 'status'),
    durationMs: nullableNumber(item.durationMs),
    summary: bounded(item.summary, 10_000, 'resumo'),
    hasSummary: item.hasSummary === true,
    coverImageUrl: normalizeArtworkUrl(item.coverImageUrl),
    heroImageUrl: normalizeArtworkUrl(item.heroImageUrl),
    updatedAt: bounded(item.updatedAt, 80, 'updatedAt'),
  }
}

function parseSegment(value: unknown): TranscriptSegment {
  const item = record(value)
  if (!item) throw new Error('Fala inválida na transcrição.')
  const id = bounded(item.id, TRANSCRIPT_SEGMENT_ID_MAX_LENGTH, 'id da fala')
  const segmentText = bounded(item.text, TRANSCRIPT_SEGMENT_TEXT_MAX_LENGTH, 'texto da fala')
  if (!id || !segmentText) throw new Error('Fala sem identificador ou texto.')

  return {
    id,
    startMs: nullableNumber(item.startMs),
    endMs: nullableNumber(item.endMs),
    speaker: bounded(item.speaker, TRANSCRIPT_SPEAKER_MAX_LENGTH, 'speaker') || 'Mesa',
    text: segmentText,
  }
}

export function parseTranscriptPayload(value: unknown): TranscriptPayload {
  const payload = record(value)
  if (payload?.ok !== true || !Array.isArray(payload.segments) || !Array.isArray(payload.speakers)) {
    throw new Error('Resposta inválida da transcrição.')
  }
  if (payload.segments.length > TRANSCRIPT_PAGE_SIZE) {
    throw new Error('Resposta da transcrição excede o tamanho máximo de página.')
  }
  if (payload.speakers.length > TRANSCRIPT_SPEAKER_LIST_MAX_LENGTH) {
    throw new Error('Resposta da transcrição excede o limite de speakers.')
  }

  const nextCursor = bounded(payload.nextCursor, TRANSCRIPT_CURSOR_MAX_LENGTH, 'cursor') || null

  return {
    session: parseSession(payload.session),
    segments: payload.segments.map(parseSegment),
    speakers: payload.speakers.map((value) => bounded(value, TRANSCRIPT_SPEAKER_MAX_LENGTH, 'speaker')).filter(Boolean),
    total: count(payload.total),
    nextCursor,
  }
}

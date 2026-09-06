import { normalizeArtworkUrl } from '../../artwork'

const SUMMARY_FULL_MAX_LENGTH = 125_000

export type SessionSummary = Readonly<{
  sourceSessionId: string
  title: string
  sessionDate: string
  arc: string
  summary: string
  summaryFull: string
  hasSummary: boolean
  coverImageUrl: string
  heroImageUrl: string
  updatedAt: string
}>

export type SessionSummaryPayload = Readonly<{
  ok: true
  session: SessionSummary
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
  if (normalized.length > maxLength) throw new Error(`Resposta do resumo excede o limite de ${field}.`)
  return normalized
}

export function parseSessionSummaryPayload(value: unknown): SessionSummaryPayload {
  const payload = record(value)
  const item = record(payload?.session)
  if (payload?.ok !== true || !item) throw new Error('Resposta inválida do resumo da sessão.')

  const sourceSessionId = bounded(item.sourceSessionId, 220, 'identificador')
  const title = bounded(item.title, 500, 'título')
  const summaryFull = bounded(item.summaryFull, SUMMARY_FULL_MAX_LENGTH, 'summaryFull')
  if (!sourceSessionId || !title) throw new Error('Resumo sem identificador ou título da sessão.')

  return {
    ok: true,
    session: {
      sourceSessionId,
      title,
      sessionDate: bounded(item.sessionDate, 80, 'data'),
      arc: bounded(item.arc, 300, 'arco'),
      summary: bounded(item.summary, 20_000, 'resumo'),
      summaryFull,
      hasSummary: item.hasSummary === true || Boolean(summaryFull),
      coverImageUrl: normalizeArtworkUrl(item.coverImageUrl),
      heroImageUrl: normalizeArtworkUrl(item.heroImageUrl),
      updatedAt: bounded(item.updatedAt, 80, 'updatedAt'),
    },
  }
}

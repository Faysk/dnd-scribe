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
  ok: boolean
  session: SessionSummary
}>

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
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

export function parseSessionSummaryPayload(value: unknown): SessionSummaryPayload {
  const payload = record(value)
  const item = record(payload?.session)
  if (!payload || !item) throw new Error('Resposta inválida do resumo da sessão.')

  const sourceSessionId = text(item.sourceSessionId)
  const title = text(item.title)
  const summaryFull = text(item.summaryFull)
  if (!sourceSessionId || !title) throw new Error('Resumo sem identificador ou título da sessão.')

  return {
    ok: payload.ok !== false,
    session: {
      sourceSessionId,
      title,
      sessionDate: text(item.sessionDate),
      arc: text(item.arc),
      summary: text(item.summary),
      summaryFull,
      hasSummary: item.hasSummary === true || Boolean(summaryFull),
      coverImageUrl: httpsUrl(item.coverImageUrl),
      heroImageUrl: httpsUrl(item.heroImageUrl),
      updatedAt: text(item.updatedAt),
    },
  }
}

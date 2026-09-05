import {
  parseLibrarySessionsPayload,
  type LibrarySessionsPayload,
} from '@/lib/api/contracts/library'
import {
  parseSessionSummaryPayload,
  type SessionSummaryPayload,
} from '@/lib/api/contracts/summary'
import {
  parseTranscriptPayload,
  TRANSCRIPT_PAGE_SIZE,
  type TranscriptPayload,
} from '@/lib/api/contracts/transcript'
import { fetchLegacyJson } from '@/lib/api/legacy'
import { CAMPAIGN_SLUG } from '@/lib/config'

export async function fetchLibrarySessions(accessToken: string): Promise<LibrarySessionsPayload> {
  const payload = await fetchLegacyJson('/api/library-sessions', accessToken, {
    campaignSlug: CAMPAIGN_SLUG,
  })
  const parsed = parseLibrarySessionsPayload(payload)
  if (parsed.campaignSlug !== CAMPAIGN_SLUG) {
    throw new Error('Resposta da biblioteca pertence a outra campanha.')
  }
  return parsed
}

export async function fetchSessionSummary(
  accessToken: string,
  sourceSessionId: string,
): Promise<SessionSummaryPayload> {
  const payload = await fetchLegacyJson('/api/library-summary', accessToken, {
    campaignSlug: CAMPAIGN_SLUG,
    sourceSessionId,
  })
  const parsed = parseSessionSummaryPayload(payload)
  if (parsed.session.sourceSessionId !== sourceSessionId) {
    throw new Error('Resposta do resumo pertence a outra sessão.')
  }
  return parsed
}

type TranscriptQuery = Readonly<{
  sourceSessionId: string
  cursor?: string | null
  query?: string
  speaker?: string
  limit?: number
}>

export async function fetchSessionTranscript(
  accessToken: string,
  input: TranscriptQuery,
): Promise<TranscriptPayload> {
  const requestedLimit = Number.isFinite(input.limit) ? Math.trunc(input.limit as number) : TRANSCRIPT_PAGE_SIZE
  const limit = Math.max(1, Math.min(TRANSCRIPT_PAGE_SIZE, requestedLimit || TRANSCRIPT_PAGE_SIZE))
  const payload = await fetchLegacyJson('/api/library-transcript', accessToken, {
    campaignSlug: CAMPAIGN_SLUG,
    sourceSessionId: input.sourceSessionId,
    limit,
    cursor: input.cursor || undefined,
    q: input.query || undefined,
    speaker: input.speaker || undefined,
  })
  const parsed = parseTranscriptPayload(payload)
  if (parsed.session.sourceSessionId !== input.sourceSessionId) {
    throw new Error('Resposta da transcrição pertence a outra sessão.')
  }
  return parsed
}

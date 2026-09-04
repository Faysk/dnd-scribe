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
  return parseLibrarySessionsPayload(payload)
}

export async function fetchSessionSummary(
  accessToken: string,
  sourceSessionId: string,
): Promise<SessionSummaryPayload> {
  const payload = await fetchLegacyJson('/api/library-summary', accessToken, {
    campaignSlug: CAMPAIGN_SLUG,
    sourceSessionId,
  })
  return parseSessionSummaryPayload(payload)
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
  const payload = await fetchLegacyJson('/api/library-transcript', accessToken, {
    campaignSlug: CAMPAIGN_SLUG,
    sourceSessionId: input.sourceSessionId,
    limit: input.limit || TRANSCRIPT_PAGE_SIZE,
    cursor: input.cursor || undefined,
    q: input.query || undefined,
    speaker: input.speaker || undefined,
  })
  return parseTranscriptPayload(payload)
}

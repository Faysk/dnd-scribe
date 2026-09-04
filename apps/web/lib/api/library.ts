import {
  parseLibrarySessionsPayload,
  type LibrarySessionsPayload,
} from '@/lib/api/contracts/library'
import {
  parseSessionSummaryPayload,
  type SessionSummaryPayload,
} from '@/lib/api/contracts/summary'
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

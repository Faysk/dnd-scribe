import { fetchLegacyJson } from '@/lib/api/legacy'
import {
  parseLibrarySessionsPayload,
  type LibrarySessionsPayload,
} from '@/lib/api/contracts/library'
import { CAMPAIGN_SLUG } from '@/lib/config'

export async function fetchLibrarySessions(accessToken: string): Promise<LibrarySessionsPayload> {
  const payload = await fetchLegacyJson('/api/library-sessions', accessToken, {
    campaignSlug: CAMPAIGN_SLUG,
  })
  return parseLibrarySessionsPayload(payload)
}

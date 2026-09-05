import {
  parsePublicSessionPayload,
  parsePublicSessionsPayload,
  type PublicSessionPayload,
  type PublicSessionsPayload,
} from '@/lib/api/contracts/public-library'
import { fetchPublicLegacyJson } from '@/lib/api/legacy'
import { CAMPAIGN_SLUG } from '@/lib/config'

export async function fetchPublicSessions(): Promise<PublicSessionsPayload> {
  const payload = await fetchPublicLegacyJson('/api/public-library', {
    campaignSlug: CAMPAIGN_SLUG,
  })
  const parsed = parsePublicSessionsPayload(payload)
  if (parsed.campaignSlug !== CAMPAIGN_SLUG) {
    throw new Error('Resposta pública pertence a outra campanha.')
  }
  return parsed
}

export async function fetchPublicSession(sourceSessionId: string): Promise<PublicSessionPayload> {
  const payload = await fetchPublicLegacyJson('/api/public-library', {
    campaignSlug: CAMPAIGN_SLUG,
    sourceSessionId,
  })
  const parsed = parsePublicSessionPayload(payload)
  if (parsed.campaignSlug !== CAMPAIGN_SLUG) {
    throw new Error('Resposta pública pertence a outra campanha.')
  }
  if (parsed.session.sourceSessionId !== sourceSessionId) {
    throw new Error('Resposta pública pertence a outra sessão.')
  }
  return parsed
}

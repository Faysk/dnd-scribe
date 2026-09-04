import { CAMPAIGN_SLUG, getLegacyOrigin } from '@/lib/config'
import {
  parseCampaignAccessPayload,
  type CampaignAccessPayload,
} from '@/lib/api/contracts/auth'

export class LegacyAuthError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'LegacyAuthError'
    this.status = status
  }
}

export async function fetchCampaignAccess(accessToken: string): Promise<CampaignAccessPayload> {
  if (!accessToken) throw new LegacyAuthError('Sessão sem access token.', 401)

  const origin = getLegacyOrigin()
  const url = new URL('/api/auth/me', origin)
  url.searchParams.set('campaignSlug', CAMPAIGN_SLUG)

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })
  } catch {
    throw new LegacyAuthError('A origem legada de autenticação está indisponível.', 503)
  }

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new LegacyAuthError(`API legada recusou o acesso (${response.status}).`, response.status)
  }

  return parseCampaignAccessPayload(payload)
}

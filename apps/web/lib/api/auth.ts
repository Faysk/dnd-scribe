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

const AUTH_TIMEOUT_MS = 12_000

function logAuthFailure(status: number, startedAt: number) {
  console.warn('[dnd-scribe:auth]', {
    category: 'legacy_auth',
    pathname: '/api/auth/me',
    status,
    durationMs: Date.now() - startedAt,
  })
}

export async function fetchCampaignAccess(accessToken: string): Promise<CampaignAccessPayload> {
  if (!accessToken) throw new LegacyAuthError('Sessão sem access token.', 401)

  const origin = getLegacyOrigin()
  const url = new URL('/api/auth/me', origin)
  url.searchParams.set('campaignSlug', CAMPAIGN_SLUG)
  const startedAt = Date.now()

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    logAuthFailure(timedOut ? 504 : 503, startedAt)
    throw new LegacyAuthError(
      timedOut ? 'A origem legada de autenticação excedeu o tempo limite.' : 'A origem legada de autenticação está indisponível.',
      timedOut ? 504 : 503,
    )
  }

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    logAuthFailure(response.status, startedAt)
    throw new LegacyAuthError(`API legada recusou o acesso (${response.status}).`, response.status)
  }

  return parseCampaignAccessPayload(payload)
}

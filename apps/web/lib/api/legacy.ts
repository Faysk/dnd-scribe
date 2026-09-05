import { getLegacyOrigin } from '@/lib/config'
import { readBoundedResponseJson } from '@/lib/http'

export class LegacyApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'LegacyApiError'
    this.status = status
  }
}

type QueryValue = string | number | boolean | null | undefined

type LegacyFetchOptions = Readonly<{
  accept?: string
}>

const LEGACY_TIMEOUT_MS = 12_000
const LEGACY_JSON_MAX_BYTES = 4 * 1024 * 1024
const ALLOWED_LEGACY_PATHS = new Set([
  '/api/library-sessions',
  '/api/library-summary',
  '/api/library-transcript',
  '/api/session-download',
])

function legacyUrl(pathname: string, query: Readonly<Record<string, QueryValue>>) {
  if (!ALLOWED_LEGACY_PATHS.has(pathname)) {
    throw new LegacyApiError('Caminho da API legada não autorizado.', 500)
  }

  const url = new URL(pathname, getLegacyOrigin())
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue
    url.searchParams.set(key, String(value))
  }
  return url
}

function logUpstreamFailure(pathname: string, status: number, startedAt: number) {
  console.warn('[dnd-scribe:bff]', {
    category: 'legacy_upstream',
    pathname,
    status,
    durationMs: Date.now() - startedAt,
  })
}

export async function fetchLegacyResponse(
  pathname: string,
  accessToken: string,
  query: Readonly<Record<string, QueryValue>> = {},
  options: LegacyFetchOptions = {},
): Promise<Response> {
  if (!accessToken) throw new LegacyApiError('Sessão sem access token.', 401)

  const startedAt = Date.now()
  let response: Response
  try {
    response = await fetch(legacyUrl(pathname, query), {
      method: 'GET',
      headers: {
        Accept: options.accept || 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(LEGACY_TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    logUpstreamFailure(pathname, timedOut ? 504 : 503, startedAt)
    throw new LegacyApiError(
      timedOut ? 'A origem legada excedeu o tempo limite.' : 'A origem legada de dados está indisponível.',
      timedOut ? 504 : 503,
    )
  }

  if (!response.ok) {
    logUpstreamFailure(pathname, response.status, startedAt)
    throw new LegacyApiError(`API legada recusou a consulta (${response.status}).`, response.status)
  }
  return response
}

export async function fetchLegacyJson(
  pathname: string,
  accessToken: string,
  query: Readonly<Record<string, QueryValue>> = {},
): Promise<unknown> {
  const response = await fetchLegacyResponse(pathname, accessToken, query)
  try {
    const payload = await readBoundedResponseJson(response, LEGACY_JSON_MAX_BYTES)
    if (payload === null) throw new LegacyApiError('API legada retornou uma resposta vazia.', 502)
    return payload
  } catch (error) {
    if (error instanceof LegacyApiError) throw error
    throw new LegacyApiError('API legada retornou JSON inválido ou excessivo.', 502)
  }
}

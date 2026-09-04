import { getLegacyOrigin } from '@/lib/config'

export class LegacyApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'LegacyApiError'
    this.status = status
  }
}

type QueryValue = string | number | boolean | null | undefined

export async function fetchLegacyJson(
  pathname: string,
  accessToken: string,
  query: Readonly<Record<string, QueryValue>> = {},
): Promise<unknown> {
  if (!accessToken) throw new LegacyApiError('Sessão sem access token.', 401)

  const url = new URL(pathname, getLegacyOrigin())
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue
    url.searchParams.set(key, String(value))
  }

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
    throw new LegacyApiError('A origem legada de dados está indisponível.', 503)
  }

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new LegacyApiError(`API legada recusou a consulta (${response.status}).`, response.status)
  }
  if (payload === null) throw new LegacyApiError('API legada retornou uma resposta vazia.', 502)

  return payload
}

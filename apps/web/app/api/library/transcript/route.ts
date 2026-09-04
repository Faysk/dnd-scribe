import { NextResponse, type NextRequest } from 'next/server'

import { TRANSCRIPT_PAGE_SIZE } from '@/lib/api/contracts/transcript'
import { LegacyApiError } from '@/lib/api/legacy'
import { fetchSessionTranscript } from '@/lib/api/library'
import { readAuthenticatedAccessToken } from '@/lib/auth/access-token'

function value(searchParams: URLSearchParams, name: string, maxLength: number) {
  return String(searchParams.get(name) || '').trim().slice(0, maxLength)
}

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
    },
  })
}

export async function GET(request: NextRequest) {
  const sourceSessionId = value(request.nextUrl.searchParams, 'sourceSessionId', 220)
  if (!sourceSessionId) return json({ ok: false, error: 'Sessão não informada.' }, 400)

  const cursor = value(request.nextUrl.searchParams, 'cursor', 1200)
  const query = value(request.nextUrl.searchParams, 'q', 240)
  const speaker = value(request.nextUrl.searchParams, 'speaker', 180)
  const accessToken = await readAuthenticatedAccessToken()
  if (!accessToken) return json({ ok: false, error: 'Sessão de login ausente.' }, 401)

  try {
    const payload = await fetchSessionTranscript(accessToken, {
      sourceSessionId,
      cursor: cursor || null,
      query,
      speaker,
      limit: TRANSCRIPT_PAGE_SIZE,
    })
    return json(payload)
  } catch (error) {
    const status = error instanceof LegacyApiError && error.status >= 400 && error.status < 600
      ? error.status
      : 502
    return json({ ok: false, error: 'Não foi possível carregar a transcrição.' }, status)
  }
}

import { NextResponse, type NextRequest } from 'next/server'

import {
  TRANSCRIPT_CURSOR_MAX_LENGTH,
  TRANSCRIPT_PAGE_SIZE,
  TRANSCRIPT_QUERY_MAX_LENGTH,
  TRANSCRIPT_SOURCE_SESSION_ID_MAX_LENGTH,
  TRANSCRIPT_SPEAKER_MAX_LENGTH,
} from '@/lib/api/contracts/transcript'
import { LegacyApiError } from '@/lib/api/legacy'
import { fetchSessionTranscript } from '@/lib/api/library'
import { readAuthenticatedAccessToken } from '@/lib/auth/access-token'
import { boundedText } from '@/lib/security'

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
    },
  })
}

export async function GET(request: NextRequest) {
  const sourceSessionId = boundedText(
    request.nextUrl.searchParams.get('sourceSessionId'),
    TRANSCRIPT_SOURCE_SESSION_ID_MAX_LENGTH,
  )
  if (sourceSessionId === null) return json({ ok: false, error: 'Identificador de sessão inválido.' }, 400)
  if (!sourceSessionId) return json({ ok: false, error: 'Sessão não informada.' }, 400)

  const cursor = boundedText(request.nextUrl.searchParams.get('cursor'), TRANSCRIPT_CURSOR_MAX_LENGTH)
  const query = boundedText(request.nextUrl.searchParams.get('q'), TRANSCRIPT_QUERY_MAX_LENGTH)
  const speaker = boundedText(request.nextUrl.searchParams.get('speaker'), TRANSCRIPT_SPEAKER_MAX_LENGTH)
  if (cursor === null || query === null || speaker === null) {
    return json({ ok: false, error: 'Filtro da transcrição inválido.' }, 400)
  }

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

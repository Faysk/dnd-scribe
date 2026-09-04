import type { NextRequest } from 'next/server'

import { TRANSCRIPT_SOURCE_SESSION_ID_MAX_LENGTH } from '@/lib/api/contracts/transcript'
import { fetchLegacyResponse, LegacyApiError } from '@/lib/api/legacy'
import { readAuthenticatedAccessToken } from '@/lib/auth/access-token'
import { CAMPAIGN_SLUG } from '@/lib/config'
import { boundedText } from '@/lib/security'

function fallbackFilename(sourceSessionId: string) {
  const slug = sourceSessionId
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'sessao'
  return `attachment; filename="transcricao-${slug}.md"`
}

export async function GET(request: NextRequest) {
  const sourceSessionId = boundedText(
    request.nextUrl.searchParams.get('sourceSessionId'),
    TRANSCRIPT_SOURCE_SESSION_ID_MAX_LENGTH,
  )
  if (sourceSessionId === null) return new Response('Identificador de sessão inválido.', { status: 400 })
  if (!sourceSessionId) return new Response('Sessão não informada.', { status: 400 })

  const accessToken = await readAuthenticatedAccessToken()
  if (!accessToken) return new Response('Sessão de login ausente.', { status: 401 })

  try {
    const upstream = await fetchLegacyResponse(
      '/api/session-download',
      accessToken,
      { campaignSlug: CAMPAIGN_SLUG, sourceSessionId },
      { accept: 'text/markdown,text/plain;q=0.9,*/*;q=0.1' },
    )
    const content = await upstream.text()
    const disposition = String(upstream.headers.get('content-disposition') || '')
      .replace(/[\r\n]/g, '')
      .slice(0, 500)

    return new Response(content, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': disposition || fallbackFilename(sourceSessionId),
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    const status = error instanceof LegacyApiError && error.status >= 400 && error.status < 600
      ? error.status
      : 502
    return new Response('Não foi possível baixar a transcrição.', { status })
  }
}

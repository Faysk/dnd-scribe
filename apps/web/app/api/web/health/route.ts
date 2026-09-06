import { NextResponse } from 'next/server'

import { CAMPAIGN_SLUG, DEFAULT_LEGACY_ORIGIN, readPublicSupabaseConfig } from '@/lib/config'
import { parseLegacyGatewayOrigin } from '@/lib/gateway'

export function GET() {
  const supabaseConfigured = Boolean(readPublicSupabaseConfig())
  const legacyOriginConfigured = Boolean(
    parseLegacyGatewayOrigin(process.env.DND_LEGACY_ORIGIN || DEFAULT_LEGACY_ORIGIN),
  )
  const ready = supabaseConfigured && legacyOriginConfigured

  return NextResponse.json(
    {
      ok: true,
      ready,
      readinessMode: 'configuration-only',
      surface: 'tda-web',
      // Compatibilidade com o antigo GET /api/health durante a Fase 2.
      // Esses campos podem ser removidos somente depois do cutover estrutural da #48.
      app: 'dnd-scribe-vercel',
      campaignSlug: CAMPAIGN_SLUG,
      deployment: {
        commitSha: process.env.APP_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || null,
        commitRef: process.env.APP_COMMIT_REF || process.env.RENDER_GIT_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || null,
        environment: process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || null,
      },
      runtime: {
        node: process.versions.node,
        supabaseConfigured,
        legacyOriginConfigured,
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}

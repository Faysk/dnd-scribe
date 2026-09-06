import { NextResponse } from 'next/server'

import { DEFAULT_LEGACY_ORIGIN, readPublicSupabaseConfig } from '@/lib/config'
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
      surface: 'tda-web',
      deployment: {
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
        commitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || null,
      },
      runtime: {
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

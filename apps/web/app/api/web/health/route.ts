import { NextResponse } from 'next/server'

import { readPublicSupabaseConfig } from '@/lib/config'
import { parseLegacyGatewayOrigin } from '@/lib/gateway'

export function GET() {
  const supabaseConfigured = Boolean(readPublicSupabaseConfig())
  const legacyOriginConfigured = Boolean(parseLegacyGatewayOrigin(process.env.DND_LEGACY_ORIGIN))
  const ready = supabaseConfigured && legacyOriginConfigured

  return NextResponse.json(
    {
      ok: true,
      ready,
      surface: 'dnd-scribe-web-next',
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

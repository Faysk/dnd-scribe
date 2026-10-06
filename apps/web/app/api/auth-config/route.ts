import { NextResponse } from 'next/server'

import { readPublicSupabaseConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function GET() {
  const config = readPublicSupabaseConfig()
  if (!config) {
    return NextResponse.json(
      { ok: false, error: 'supabase_public_config_unavailable' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      mode: 'auth_required',
      primaryProvider: 'discord',
      providers: ['discord', 'google'],
      supabaseUrl: config.url,
      publishableKey: config.publishableKey,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  )
}

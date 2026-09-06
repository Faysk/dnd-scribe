import { NextResponse } from 'next/server'

import { buildHealthPayload } from '@/lib/server/health'

export function GET() {
  return NextResponse.json(buildHealthPayload(), {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

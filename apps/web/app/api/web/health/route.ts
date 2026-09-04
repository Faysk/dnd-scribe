import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      surface: 'dnd-scribe-web-next',
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}

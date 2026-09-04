import { NextResponse } from 'next/server'

function notFound() {
  return NextResponse.json(
    { ok: false, error: 'Endpoint do Web Next não encontrado.' },
    {
      status: 404,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}

export const GET = notFound
export const POST = notFound
export const PUT = notFound
export const PATCH = notFound
export const DELETE = notFound

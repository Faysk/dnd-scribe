export function GET() {
  return Response.json({ ok: true, surface: 'tda-web' }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

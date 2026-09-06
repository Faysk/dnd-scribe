import { expect, test } from '@playwright/test'

test('expõe o health canônico e preserva o contrato legado', async ({ request }) => {
  for (const path of ['/api/web/health', '/api/health']) {
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control']).toContain('no-store')

    const payload = await response.json()
    expect(payload).toMatchObject({
      ok: true,
      surface: 'tda-web',
      app: 'dnd-scribe-vercel',
      campaignSlug: 'yuhara-main',
    })
    expect(typeof payload.ready).toBe('boolean')
  }
})

import { expect, test } from '@playwright/test'

test('expõe a configuração pública de autenticação no Next', async ({ request }) => {
  const response = await request.get('/api/auth-config')
  expect(response.status()).toBe(200)
  expect(response.headers()['cache-control']).toContain('no-store')
  expect(response.headers()['x-content-type-options']).toBe('nosniff')

  const payload = await response.json()
  expect(payload).toMatchObject({
    ok: true,
    mode: 'auth_required',
    primaryProvider: 'discord',
    providers: ['discord', 'google'],
  })
  expect(payload.supabaseUrl).toMatch(/^https:\/\//)
  expect(typeof payload.publishableKey).toBe('string')
  expect(payload.publishableKey.length).toBeGreaterThan(20)
})

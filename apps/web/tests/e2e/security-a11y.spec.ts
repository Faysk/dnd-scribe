import { expect, test } from '@playwright/test'

test('envia headers de segurança básicos em todas as páginas', async ({ request }) => {
  const response = await request.get('/')

  expect(response.headers()['x-content-type-options']).toBe('nosniff')
  expect(response.headers()['x-frame-options']).toBe('DENY')
  expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin')
  expect(response.headers()['permissions-policy']).toContain('microphone=()')
  expect(response.headers()['cross-origin-opener-policy']).toBe('same-origin-allow-popups')
})

test('preserva Permissions-Policy de rede local em Edit/Central Local', async ({ request }) => {
  const edit = await request.get('/edit', { maxRedirects: 0 })
  const central = await request.get('/central-local', { maxRedirects: 0 })

  expect(edit.headers()['permissions-policy']).toContain('local-network=(self)')
  expect(edit.headers()['permissions-policy']).toContain('loopback-network=(self)')
  expect(central.headers()['permissions-policy']).toContain('local-network=(self)')
  expect(central.headers()['permissions-policy']).toContain('loopback-network=(self)')
})

test('namespace /api/web permanece integralmente local no Next', async ({ request }) => {
  const health = await request.get('/api/web/health')
  const healthPayload = await health.json()
  const transcript = await request.get('/api/web/library/transcript')
  const download = await request.get('/api/web/library/download')
  const unknown = await request.get('/api/web/endpoint-que-nao-existe')

  expect(health.status()).toBe(200)
  expect(healthPayload).toMatchObject({
    ok: true,
    surface: 'dnd-scribe-web-next',
    ready: false,
    runtime: {
      supabaseConfigured: false,
      legacyOriginConfigured: false,
    },
  })
  expect(health.headers()['cache-control']).toContain('no-store')
  expect(transcript.status()).toBe(400)
  expect(download.status()).toBe(400)
  expect(unknown.status()).toBe(404)
  await expect(unknown.json()).resolves.toMatchObject({ ok: false })
})

test('logout rejeita POST cross-origin e aceita a própria origem', async ({ request }) => {
  const rejected = await request.post('/auth/logout', {
    headers: { Origin: 'https://evil.example' },
    maxRedirects: 0,
  })
  expect(rejected.status()).toBe(403)

  // O Next dev normaliza request.url para localhost mesmo quando o Playwright
  // alcança o servidor pelo loopback 127.0.0.1. O helper unitário cobre a
  // equivalência semântica; aqui validamos a integração real do Route Handler.
  const accepted = await request.post('/auth/logout', {
    headers: { Origin: 'http://localhost:3000' },
    maxRedirects: 0,
  })
  expect(accepted.status()).toBe(303)
  expect(accepted.headers().location).toContain('/login')
})

test('skip link aponta para o conteúdo e ativa o destino', async ({ page }) => {
  await page.goto('/')

  const skipLink = page.getByRole('link', { name: 'Pular para o conteúdo' })
  await expect(skipLink).toHaveAttribute('href', '#content')
  await expect(page.locator('#content')).toHaveAttribute('tabindex', '-1')

  // O link fica intencionalmente fora da viewport até receber foco. Usar a
  // ativação nativa do DOM testa o handler sem transformar a actionability de
  // ponteiro do Playwright em requisito de acessibilidade do componente.
  await skipLink.evaluate((element) => (element as HTMLAnchorElement).click())
  await expect(page.locator('#content')).toBeFocused()
  await expect(page).toHaveURL(/#content$/)
})

test('skip link é acionável por teclado e exibe foco visível', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('webkit'), 'Safari/WebKit condiciona foco de links à preferência de Full Keyboard Access do usuário.')

  await page.goto('/')

  const skipLink = page.getByRole('link', { name: 'Pular para o conteúdo' })
  await skipLink.focus()
  await expect(skipLink).toBeFocused()

  const outline = await skipLink.evaluate((element) => getComputedStyle(element).outlineWidth)
  expect(Number.parseFloat(outline)).toBeGreaterThan(0)

  await skipLink.press('Enter')
  await expect(page.locator('#content')).toBeFocused()
  await expect(page).toHaveURL(/#content$/)
})

test('skip link é a primeira parada de Tab quando a engine habilita navegação completa', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('webkit'), 'Safari/WebKit condiciona Tab em links à preferência de Full Keyboard Access do usuário.')

  await page.goto('/')
  await page.keyboard.press('Tab')

  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused()
})

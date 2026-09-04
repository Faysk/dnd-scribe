import { expect, test } from '@playwright/test'

test('envia headers de segurança básicos em todas as páginas', async ({ request }) => {
  const response = await request.get('/')

  expect(response.headers()['x-content-type-options']).toBe('nosniff')
  expect(response.headers()['x-frame-options']).toBe('DENY')
  expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin')
  expect(response.headers()['permissions-policy']).toContain('microphone=()')
  expect(response.headers()['cross-origin-opener-policy']).toBe('same-origin-allow-popups')
})

test('logout rejeita POST cross-origin e aceita a própria origem', async ({ request }) => {
  const rejected = await request.post('/auth/logout', {
    headers: { Origin: 'https://evil.example' },
    maxRedirects: 0,
  })
  expect(rejected.status()).toBe(403)

  const accepted = await request.post('/auth/logout', {
    headers: { Origin: 'http://127.0.0.1:3000' },
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

  await skipLink.click()
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

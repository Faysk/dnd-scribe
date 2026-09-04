import { expect, test } from '@playwright/test'

test('login tem landmarks, título lógico e controles nomeados', async ({ page }) => {
  await page.goto('/login')

  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
  await expect(page.locator('main#content')).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page.getByRole('button', { name: /Entrar com Discord/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Entrar com Google/i })).toBeVisible()
})

test('reduced motion remove animações e scroll suave', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto('/login')

  const behavior = await page.locator('html').evaluate((element) => getComputedStyle(element).scrollBehavior)
  expect(behavior).toBe('auto')

  const button = page.getByRole('button', { name: /Entrar com Discord/i })
  const transitionDuration = await button.evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(Number.parseFloat(transitionDuration) || 0).toBeLessThanOrEqual(0.001)

  await context.close()
})

test('login reflowa em viewport estreito sem scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.goto('/login')

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

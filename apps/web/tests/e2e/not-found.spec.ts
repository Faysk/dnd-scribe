import { expect, test } from '@playwright/test'

test('rota desconhecida usa uma saída editorial e acessível', async ({ page }) => {
  const response = await page.goto('/rota-que-nao-existe')

  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Essa lembrança não está por aqui.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Voltar ao DnD Scribe' })).toHaveAttribute('href', '/')
})

import { expect, test } from '@playwright/test'

test('renders the configured login surface while keeping public memories independent', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entre para acessar o material interno.')
  await expect(page.getByRole('button', { name: 'Entrar com Discord' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Entrar com Google' })).toBeEnabled()
  await expect(
    page.getByText('Os resumos da campanha são públicos. O login libera transcrições, downloads e ferramentas reservadas aos membros aprovados da mesa.'),
  ).toBeVisible()
  await expect(page.getByText('Auth ainda não está configurado neste Preview.')).toHaveCount(0)
})

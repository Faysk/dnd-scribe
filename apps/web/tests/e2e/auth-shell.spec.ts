import { expect, test } from '@playwright/test'

test('renders the login surface safely when auth env is absent in CI', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('As histórias da mesa vivem aqui.')
  await expect(page.getByRole('button', { name: 'Entrar com Discord' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Entrar com Google' })).toBeDisabled()
  await expect(page.getByText('Auth ainda não está configurado neste Preview.')).toBeVisible()
})

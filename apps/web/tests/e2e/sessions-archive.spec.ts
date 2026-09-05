import { expect, test } from '@playwright/test'

test('arquivo público mantém estado seguro sem origem de dados no CI', async ({ page }) => {
  await page.goto('/sessoes')

  await expect(page.getByRole('heading', { name: 'O arquivo público aguarda a origem de dados do Preview.' })).toBeVisible()
  await expect(page.getByText('Produção continua intocada.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
})

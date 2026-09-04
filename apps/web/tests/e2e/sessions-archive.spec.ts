import { expect, test } from '@playwright/test'

test('arquivo de sessões mantém estado seguro sem envs de auth no CI', async ({ page }) => {
  await page.goto('/sessoes')

  await expect(page.getByRole('heading', { name: 'O arquivo real depende do ambiente autenticado.' })).toBeVisible()
  await expect(page.getByText('Produção legada continua intocada.')).toBeVisible()
})

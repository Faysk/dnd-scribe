import { expect, test } from '@playwright/test'

test('detalhe público mantém estado seguro sem origem de dados no CI', async ({ page }) => {
  await page.goto('/sessoes/sessao-de-teste')

  await expect(page.getByRole('heading', { name: 'A memória pública aguarda a origem de dados do Preview.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Voltar às sessões' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
})

import { expect, test } from '@playwright/test'

test('detalhe da sessão mantém estado seguro sem envs de auth no CI', async ({ page }) => {
  await page.goto('/sessoes/sessao-de-teste')

  await expect(page.getByRole('heading', { name: 'O detalhe real depende do ambiente autenticado.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Voltar às sessões' })).toBeVisible()
})

import { expect, test } from '@playwright/test'

test('hash legado de resumo abre a rota semântica da sessão', async ({ page }) => {
  await page.goto('/#/sessao/sessao-42/resumo')

  await expect(page).toHaveURL(/\/sessoes\/sessao-42$/)
  await expect(
    page.getByRole('heading', { name: 'A memória pública aguarda a origem de dados do Preview.' }),
  ).toBeVisible()
})

test('hash legado da sessão abre a transcrição secundária', async ({ page }) => {
  await page.goto('/#/sessao/sessao-42')

  await expect(page).toHaveURL(/\/sessoes\/sessao-42\/transcricao$/)
  await expect(
    page.getByRole('heading', { name: 'O acesso às transcrições ainda não está configurado neste ambiente.' }),
  ).toBeVisible()
})

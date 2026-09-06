import { expect, test } from '@playwright/test'

test('hash legado de resumo abre a rota semântica da sessão', async ({ page }) => {
  await page.goto('/#/sessao/sessao-42/resumo')

  await expect(page).toHaveURL(/\/sessoes\/sessao-42$/)
  await expect(
    page.getByRole('heading', { name: 'A memória pública aguarda a origem de dados do Preview.' }),
  ).toBeVisible()
})

test('hash legado da sessão preserva o destino privado no login', async ({ page }) => {
  await page.goto('/#/sessao/sessao-42')

  await expect(page).toHaveURL(/\/login\?next=%2Fsessoes%2Fsessao-42%2Ftranscricao$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entre para acessar o material interno.')
})

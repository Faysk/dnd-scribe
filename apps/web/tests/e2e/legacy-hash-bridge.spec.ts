import { expect, test } from '@playwright/test'

test('hash legado de resumo abre a rota semântica da sessão', async ({ page }) => {
  await page.goto('/#/sessao/sessao-42/resumo')

  await expect(page).toHaveURL(/\/sessoes\/sessao-42$/)
  await expect(page.getByText('O detalhe real depende do ambiente autenticado.')).toBeVisible()
})

test('hash legado da sessão abre a transcrição secundária', async ({ page }) => {
  await page.goto('/#/sessao/sessao-42')

  await expect(page).toHaveURL(/\/sessoes\/sessao-42\/transcricao$/)
  await expect(page.getByText('A transcrição real depende do ambiente autenticado.')).toBeVisible()
})

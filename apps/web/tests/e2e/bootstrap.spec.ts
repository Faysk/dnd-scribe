import { expect, test } from '@playwright/test'

test('renders the technical preview shell', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Modernização — Preview técnico',
  )
  await expect(page.getByText('Fase 3 · bootstrap em validação')).toBeVisible()
})

import { expect, test } from '@playwright/test'

test('renders the design system catalog in dark and light specimens', async ({ page }) => {
  await page.goto('/design-system')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Design system')
  await expect(page.locator('[data-theme="dark"]')).toContainText('Grimório noturno')
  await expect(page.locator('[data-theme="light"]')).toContainText('Arquivo em papel quente')
  await expect(page.getByText('Ação primária').first()).toBeVisible()
})

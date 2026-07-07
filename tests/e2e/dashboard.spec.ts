import { expect, test } from '@playwright/test'

test('production dashboard shell exposes real-world operator controls', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/?v=e2e-smoke', { waitUntil: 'networkidle' })

  await expect(page).toHaveTitle(/Loop Engineering Dashboard/i)
  await expect(page.getByRole('heading', { name: /Agent quality control, not just charts/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Understand, approve, and monitor loop-engineering improvements/i })).toBeVisible()
  await expect(page.getByText(/Agent operations cockpit/i)).toBeVisible()
  await expect(page.getByRole('heading', { name: /Production & data-source status/i })).toBeVisible()
  await expect(page.getByText(/Production (Live|Partial|Demo Fallback|Data Error)/i)).toBeVisible()
  await expect(page.getByPlaceholder('Search proposals...')).toBeVisible()
  await expect(page.getByPlaceholder('Search iterations by task or id...')).toBeVisible()
  await expect(page.getByRole('link', { name: /Production dashboard opens in a new tab/i })).toHaveAttribute('href', 'https://loop-engineering-dashboard.vercel.app')
  await expect(page.getByRole('link', { name: /GitHub repository opens in a new tab/i })).toHaveAttribute('href', 'https://github.com/maximoseo/loop-engineering-dashboard')
  await expect(page.getByRole('link', { name: /Vercel project opens in a new tab/i })).toHaveAttribute('href', 'https://vercel.com/maximo-seo/loop-engineering-dashboard')
  await expect(page.getByText('python scripts/loopctl.py approve <proposal-id>')).toBeVisible()

  expect(consoleErrors).toEqual([])
})

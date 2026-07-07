import { expect, test } from '@playwright/test'

test('production dashboard shell exposes real-world operator controls', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/?v=e2e-smoke', { waitUntil: 'networkidle' })

  await expect(page).toHaveTitle(/Loop Engineering Dashboard/i)
  await expect(page.getByRole('heading', { name: /Production & data-source status/i })).toBeVisible()
  await expect(page.getByText(/Production (Live|Partial|Demo Fallback|Data Error)/i)).toBeVisible()
  await expect(page.getByPlaceholder('Search proposals...')).toBeVisible()
  await expect(page.getByPlaceholder('Search iterations by task or id...')).toBeVisible()
  await expect(page.getByRole('link', { name: /Production/i })).toHaveAttribute('href', 'https://loop-engineering-dashboard.vercel.app')
  await expect(page.getByRole('link', { name: /GitHub repo/i })).toHaveAttribute('href', 'https://github.com/maximoseo/loop-engineering-dashboard')

  expect(consoleErrors).toEqual([])
})

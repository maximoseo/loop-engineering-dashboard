import { expect, test } from '@playwright/test'

test('dashboard has a clear operational overview and connected sources', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/?v=e2e-clarity', { waitUntil: 'domcontentloaded' })

  await expect(page).toHaveTitle(/Loop Engineering Dashboard/i)
  await expect(page.getByRole('heading', { name: /A control room for improving agents safely/i })).toBeVisible()
  await expect(page.getByText(/watches real loop telemetry/i)).toBeVisible()
  await expect(page.getByText(/Observe/i).first()).toBeVisible()
  await expect(page.getByText(/Score/i).first()).toBeVisible()
  await expect(page.getByText(/Learn/i).first()).toBeVisible()
  await expect(page.getByText(/Propose/i).first()).toBeVisible()
  await expect(page.getByText(/Approve/i).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: /Where to operate next/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Production dashboard opens in a new tab/i })).toHaveAttribute('href', 'https://loop-engineering-dashboard.vercel.app')
  await expect(page.getByRole('link', { name: /GitHub repository opens in a new tab/i })).toHaveAttribute('href', 'https://github.com/maximoseo/loop-engineering-dashboard')
  await expect(page.getByRole('link', { name: /Vercel project opens in a new tab/i })).toHaveAttribute('href', 'https://vercel.com/maximo-seo/loop-engineering-dashboard')
  await expect(page.getByRole('link', { name: /Dashboards panel opens in a new tab/i })).toHaveAttribute('href', 'https://dashboards-panel.maximo-seo.ai')
  await expect(page.getByText('python scripts/loopctl.py approve <proposal-id>')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Live data proof/i })).toBeVisible()
  await expect(page.getByPlaceholder('Search proposals...')).toBeVisible()
  await expect(page.getByPlaceholder('Search iterations by task or id...')).toBeVisible()

  expect(consoleErrors).toEqual([])
})

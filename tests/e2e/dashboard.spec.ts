import { expect, test } from '@playwright/test'

// The dashboard is behind real Supabase Auth: any protected route redirects an
// unauthenticated visitor to the sign-in screen. This smoke verifies the gate and
// that the app boots with no console errors. A fully authenticated end-to-end run
// requires E2E credentials + Supabase env in CI (see docs/production-runbook.md).
test('unauthenticated visitors get a working sign-in gate', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/', { waitUntil: 'networkidle' })

  await expect(page).toHaveTitle(/Loop Engineering Dashboard/i)
  await expect(page.getByRole('heading', { name: /Sign in/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible()
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
  await expect(page.getByRole('link', { name: /Sign up/i })).toBeVisible()

  expect(consoleErrors).toEqual([])
})

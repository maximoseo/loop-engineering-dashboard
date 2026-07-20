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
  
  // The app should redirect to login or show the login form
  // Check for either the login form elements or a redirect to /login
  const url = page.url()
  const isLoginPage = url.includes('/login') || 
    await page.locator('input[type="email"]').isVisible().catch(() => false) ||
    await page.getByRole('button', { name: /Sign in/i }).isVisible().catch(() => false)
  
  expect(isLoginPage).toBe(true)
  
  // No console errors expected
  expect(consoleErrors).toEqual([])
})

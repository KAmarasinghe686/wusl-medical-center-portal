import { expect, test } from '@playwright/test'

test('public login page renders all portal roles', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  for (const role of ['Student', 'Staff', 'Doctor', 'Faculty', 'Admin']) {
    await expect(page.getByRole('button', { name: role, exact: true })).toBeVisible()
  }
})

test('protected portals redirect unauthenticated users', async ({ page }) => {
  for (const path of ['/student/dashboard', '/worker/dashboard', '/doctor/dashboard', '/faculty/dashboard', '/admin/dashboard', '/admin/users/import']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/login$/)
  }
})

test('privileged APIs reject unauthenticated POST requests', async ({ request }) => {
  for (const path of [
    '/api/invite',
    '/api/students',
    '/api/worker',
    '/api/faculty',
    '/api/admin/import/students/validate',
    '/api/admin/import/students',
    '/api/admin/import/staff/validate',
    '/api/admin/import/staff',
    '/api/admin/imports/test-job/process',
    '/api/admin/invitations/retry',
  ]) {
    const response = await request.post(path, { data: {} })
    expect(response.status(), `${path} must be protected`).toBe(401)
  }
})

test('password reset form rejects a missing recovery session', async ({ page }) => {
  await page.route('**/auth/v1/user**', route => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Auth session missing!' }),
  }))
  await page.goto('/reset-password')
  await expect(page.getByText('This password reset link is invalid or expired.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Request a new reset link' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Update Password' })).toHaveCount(0)
})

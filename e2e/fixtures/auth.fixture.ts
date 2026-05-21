import { test as base, Page } from '@playwright/test'

export type UserRole = 'superadmin' | 'clinic_admin'

export const TEST_USERS: Record<UserRole, { username: string; password: string }> = {
  superadmin: {
    username: process.env.E2E_SUPERADMIN_EMAIL || 'admin',
    password: process.env.E2E_SUPERADMIN_PASSWORD || 'test-password',
  },
  clinic_admin: {
    username: process.env.E2E_CLINIC_EMAIL || 'clinic',
    password: process.env.E2E_CLINIC_PASSWORD || 'test-password',
  },
}

export async function loginAs(page: Page, role: UserRole): Promise<void> {
  const user = TEST_USERS[role]

  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  await page.fill('input[name="username"]', user.username)
  await page.fill('input[name="password"]', user.password)
  await page.click('button[type="submit"]')

  await page.waitForURL('/', { timeout: 15000 })
}

interface AuthFixtures {
  authenticatedPage: Page
  userRole: UserRole
}

export const test = base.extend<AuthFixtures>({
  userRole: ['superadmin', { option: true }],

  authenticatedPage: async ({ page, userRole }, use) => {
    await loginAs(page, userRole)
    await use(page)
  },
})

export { expect } from '@playwright/test'

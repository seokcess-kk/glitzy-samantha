import { Page, Locator, expect } from '@playwright/test'

export class LoginPage {
  readonly page: Page
  readonly usernameInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator
  readonly pageTitle: Locator

  constructor(page: Page) {
    this.page = page
    this.usernameInput = page.locator('input[name="username"]')
    this.passwordInput = page.locator('input[name="password"]')
    this.submitButton = page.locator('button[type="submit"]')
    this.errorMessage = page.locator('[data-testid="error-message"], [role="alert"], .text-red-500, .text-red-400')
    this.pageTitle = page.locator('h1, h2').first()
  }

  async goto() {
    await this.page.goto('/login')
    await this.page.waitForLoadState('networkidle')
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }

  async expectLoginSuccess() {
    await expect(this.page).toHaveURL('/')
  }

  async expectLoginFailure() {
    await expect(this.page).toHaveURL(/\/login/)
    await expect(this.errorMessage).toBeVisible()
  }

  async expectFormVisible() {
    await expect(this.usernameInput).toBeVisible()
    await expect(this.passwordInput).toBeVisible()
    await expect(this.submitButton).toBeVisible()
  }
}

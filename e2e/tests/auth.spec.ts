import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages/login.page'
import { TEST_USERS } from '../fixtures/auth.fixture'

test.describe('인증', () => {
  let loginPage: LoginPage

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page)
    await loginPage.goto()
  })

  test('로그인 페이지가 올바르게 표시됨', async () => {
    await loginPage.expectFormVisible()
  })

  // 실제 로그인 성공/로그아웃 검증은 자격 증명(E2E_SUPERADMIN_*)이 필요하므로
  // auth-login.spec.ts(chromium 프로젝트)로 분리. 이 파일은 자격 증명 없이도
  // 돌 수 있는 인증 실패·리다이렉트 케이스만 다룬다(chromium-no-auth 프로젝트).

  test('잘못된 비밀번호로 로그인 실패', async () => {
    await loginPage.login(TEST_USERS.superadmin.username, 'wrong-password')
    await loginPage.expectLoginFailure()
  })

  test('빈 아이디로 로그인 시도 실패', async ({ page }) => {
    await loginPage.login('', 'any-password')

    // HTML5 유효성 검사 또는 커스텀 에러
    const isInvalid = await page.locator('input[name="username"]:invalid').count() > 0
    const hasError = await loginPage.errorMessage.isVisible().catch(() => false)

    expect(isInvalid || hasError).toBeTruthy()
  })

  test('빈 비밀번호로 로그인 시도 실패', async ({ page }) => {
    await loginPage.login(TEST_USERS.superadmin.username, '')

    const isInvalid = await page.locator('input[name="password"]:invalid').count() > 0
    const hasError = await loginPage.errorMessage.isVisible().catch(() => false)

    expect(isInvalid || hasError).toBeTruthy()
  })

  test('미인증 사용자가 보호된 페이지 접근 시 로그인 페이지로 리다이렉트', async ({ page }) => {
    // 직접 보호된 페이지로 이동 시도
    await page.goto('/leads')

    // 로그인 페이지로 리다이렉트 확인
    await expect(page).toHaveURL(/\/login/)
  })

  test('미인증 사용자가 대시보드 접근 시 로그인 페이지로 리다이렉트', async ({ page }) => {
    await page.goto('/')

    // 로그인 페이지로 리다이렉트 확인
    await expect(page).toHaveURL(/\/login/)
  })
})

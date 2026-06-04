import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages/login.page'
import { TEST_USERS } from '../fixtures/auth.fixture'

// 실제 자격 증명으로 "로그인 성공"을 검증하는 테스트 모음.
// chromium 프로젝트(= dependencies: ['setup'])에 속해, E2E_SUPERADMIN_* secrets가
// 채워졌을 때만 도는 워크플로우 "authenticated" step에서 실행된다.
// 단, 이 파일은 로그인 플로우 자체를 검증하므로 chromium 프로젝트가 주입하는
// storageState(미리 로그인된 쿠키)를 무력화하고 미인증 상태로 시작한다.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('인증 - 로그인 플로우', () => {
  test('유효한 자격 증명으로 로그인 성공', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    const user = TEST_USERS.superadmin
    await loginPage.login(user.username, user.password)
    await loginPage.expectLoginSuccess()

    // 대시보드에 도착했는지 확인
    await expect(page.locator('main')).toBeVisible()
  })
})

test.describe('로그아웃', () => {
  test('로그인 후 로그아웃 성공', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login(TEST_USERS.superadmin.username, TEST_USERS.superadmin.password)
    await loginPage.expectLoginSuccess()

    // 로그아웃 버튼 클릭
    const logoutButton = page.locator('button:has-text("로그아웃"), a:has-text("로그아웃")')

    if (await logoutButton.isVisible()) {
      await logoutButton.click()
    } else {
      // 드롭다운 메뉴에서 찾기
      await page.locator('[data-testid="user-menu"]').click().catch(() => {})
      await page.click('text=로그아웃').catch(() => {})
    }

    // 로그인 페이지로 리다이렉트 확인
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })
})

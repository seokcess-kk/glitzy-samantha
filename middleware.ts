export { default } from 'next-auth/middleware'

export const config = {
  // api/auth, api/webhook, api/qstash, login, lp(랜딩페이지), privacy, terms 페이지는 인증 불필요
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login|lp|privacy|terms).*)'],
}

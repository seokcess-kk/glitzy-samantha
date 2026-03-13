/**
 * API 라우트 공통 미들웨어
 * - 인증 검증
 * - clinic_id 필터링
 * - superadmin 권한 검증
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { getClinicId } from './session'

// 사용자 타입
export interface AuthUser {
  id: string
  username: string
  role: 'superadmin' | 'clinic_admin'
  clinic_id: number | null
}

// 컨텍스트 타입
export interface AuthContext {
  user: AuthUser
}

export interface ClinicContext extends AuthContext {
  clinicId: number | null
}

// 핸들러 타입
type AuthHandler = (req: Request, context: AuthContext) => Promise<NextResponse>
type ClinicHandler = (req: Request, context: ClinicContext) => Promise<NextResponse>
type SuperAdminHandler = (req: Request, context: AuthContext) => Promise<NextResponse>

// 동적 라우트 파라미터 타입
export interface RouteParams {
  params: Record<string, string>
}

type AuthHandlerWithParams = (req: Request, context: AuthContext & RouteParams) => Promise<NextResponse>
type ClinicHandlerWithParams = (req: Request, context: ClinicContext & RouteParams) => Promise<NextResponse>

// 인증 실패 응답
const UNAUTHORIZED = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const FORBIDDEN_SUPERADMIN = NextResponse.json({ error: 'Forbidden: superadmin only' }, { status: 403 })

/**
 * 세션에서 인증된 사용자 추출
 * @returns AuthUser 또는 null (미인증 시)
 */
async function getAuthUser(): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  return session.user as AuthUser
}

/**
 * 인증 필수 래퍼
 * - 로그인한 사용자만 접근 가능
 */
export function withAuth(handler: AuthHandler) {
  return async (req: Request): Promise<NextResponse> => {
    const user = await getAuthUser()
    if (!user) return UNAUTHORIZED
    return handler(req, { user })
  }
}

/**
 * 인증 + 동적 라우트 파라미터 래퍼
 */
export function withAuthParams(handler: AuthHandlerWithParams) {
  return async (req: Request, routeParams: RouteParams): Promise<NextResponse> => {
    const user = await getAuthUser()
    if (!user) return UNAUTHORIZED
    return handler(req, { user, params: routeParams.params })
  }
}

/**
 * 인증 + clinic_id 필터 래퍼
 * - clinicId가 자동으로 추출됨
 * - superadmin은 ?clinic_id=X 파라미터로 특정 병원 조회 가능
 * - clinic_admin은 자신의 병원만 조회
 */
export function withClinicFilter(handler: ClinicHandler) {
  return async (req: Request): Promise<NextResponse> => {
    const user = await getAuthUser()
    if (!user) return UNAUTHORIZED

    const clinicId = await getClinicId(req.url)
    return handler(req, { user, clinicId })
  }
}

/**
 * 인증 + clinic_id 필터 + 동적 라우트 파라미터 래퍼
 */
export function withClinicFilterParams(handler: ClinicHandlerWithParams) {
  return async (req: Request, routeParams: RouteParams): Promise<NextResponse> => {
    const user = await getAuthUser()
    if (!user) return UNAUTHORIZED

    const clinicId = await getClinicId(req.url)
    return handler(req, { user, clinicId, params: routeParams.params })
  }
}

/**
 * superadmin 전용 래퍼
 * - superadmin 역할만 접근 가능
 */
export function withSuperAdmin(handler: SuperAdminHandler) {
  return async (req: Request): Promise<NextResponse> => {
    const user = await getAuthUser()
    if (!user) return UNAUTHORIZED
    if (user.role !== 'superadmin') return FORBIDDEN_SUPERADMIN
    return handler(req, { user })
  }
}

/**
 * API 에러 응답 헬퍼
 */
export function apiError(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

/**
 * API 성공 응답 헬퍼
 */
export function apiSuccess<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status })
}

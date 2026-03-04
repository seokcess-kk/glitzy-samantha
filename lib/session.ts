import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

/**
 * 현재 세션의 clinic_id 반환
 * - superadmin: URL 쿼리 ?clinic_id=X 가 있으면 그 값, 없으면 null (전체 보기)
 * - clinic_admin: 세션의 clinic_id 고정
 */
export async function getClinicId(url?: string): Promise<number | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null

  const user = session.user as any

  if (user.role === 'superadmin') {
    if (url) {
      const clinicId = new URL(url).searchParams.get('clinic_id')
      if (clinicId) return parseInt(clinicId)
    }
    return null // null = 전체 조회
  }

  return user.clinic_id ?? null
}

export async function getSession() {
  return getServerSession(authOptions)
}

export async function requireSuperAdmin() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  return user?.role === 'superadmin'
}

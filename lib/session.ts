import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { serverSupabase } from './supabase'
import { createLogger } from './logger'

const logger = createLogger('Session')

/**
 * 현재 세션의 clinic_id 반환
 * - superadmin: URL 쿼리 ?clinic_id=X 가 있으면 그 값 (검증 후), 없으면 null (전체 보기)
 * - clinic_admin: 세션의 clinic_id 고정
 */
export async function getClinicId(url?: string): Promise<number | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null

  const user = session.user as { role: string; clinic_id: number | null }

  if (user.role === 'superadmin') {
    if (url) {
      try {
        const clinicIdParam = new URL(url).searchParams.get('clinic_id')
        if (clinicIdParam) {
          const clinicId = parseInt(clinicIdParam, 10)

          // 숫자 검증
          if (isNaN(clinicId) || clinicId < 1) {
            logger.warn('Invalid clinic_id parameter', { clinicIdParam })
            return null
          }

          // 실제 존재하는 clinic인지 확인
          const supabase = serverSupabase()
          const { data: clinic } = await supabase
            .from('clinics')
            .select('id')
            .eq('id', clinicId)
            .eq('is_active', true)
            .single()

          if (!clinic) {
            logger.warn('Clinic not found or inactive', { clinicId })
            return null
          }

          return clinicId
        }
      } catch (e) {
        logger.warn('Failed to parse clinic_id from URL', { error: String(e) })
        return null
      }
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
  const user = session?.user as { role: string } | undefined
  return user?.role === 'superadmin'
}

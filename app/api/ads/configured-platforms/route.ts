/**
 * 병원별 활성 매체 목록 조회
 * - GET ?clinic_id=X — clinic_api_configs.is_active=true 인 매체 distinct 반환
 * - 백필 다이얼로그의 매체 체크박스 목록에 사용
 */

import { withClinicFilter, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { serverSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { SYNC_ENABLED_PLATFORMS, type ApiPlatform } from '@/lib/platform'

const logger = createLogger('ConfiguredPlatforms')

export const GET = withClinicFilter(async (_req: Request, { user, clinicId, assignedClinicIds }) => {
  // 미들웨어가 ?clinic_id=X 를 파싱해서 clinicId 로 전달.
  // 백필은 단일 병원 대상이므로 clinic_id 필수.
  if (!clinicId) {
    return apiError('clinic_id 쿼리 파라미터가 필요합니다.')
  }

  const supabase = serverSupabase()

  // agency_staff: clinic_id 명시한 경우에도 배정 외 차단.
  // (withClinicFilter 는 clinic_id 미지정 시에만 assignedClinicIds 를 채우므로 보강 필요)
  if (user.role === 'agency_staff') {
    const { data: assignments } = await supabase
      .from('user_clinic_assignments')
      .select('clinic_id')
      .eq('user_id', parseInt(user.id, 10))
    const assigned = (assignments || []).map(a => a.clinic_id as number)
    if (!assigned.includes(clinicId)) {
      return apiError('접근 권한이 없는 병원입니다.', 403)
    }
  }

  try {
    const baseQuery = supabase
      .from('clinic_api_configs')
      .select('platform')
      .eq('is_active', true)
      .in('platform', SYNC_ENABLED_PLATFORMS as unknown as string[])

    const filtered = applyClinicFilter(baseQuery, { clinicId, assignedClinicIds })
    if (!filtered) return apiSuccess({ platforms: [] })

    const { data, error } = await filtered

    if (error) {
      logger.error('clinic_api_configs 조회 실패', error, { clinicId })
      return apiError('서버 오류가 발생했습니다.', 500)
    }

    const platforms = Array.from(
      new Set((data || []).map(r => r.platform as ApiPlatform))
    )

    return apiSuccess({ platforms })
  } catch (error) {
    logger.error('configured-platforms 조회 중 예외', error, { clinicId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})

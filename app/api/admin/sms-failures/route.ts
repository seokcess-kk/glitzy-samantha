import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { createLogger } from '@/lib/logger'

const logger = createLogger('SmsFailures')

const WINDOW_DAYS = 7
const MAX_ROWS = 10000

/**
 * 최근 N일 문자 발송 실패 집계 (superadmin)
 * GET /api/admin/sms-failures → { total, byClinic, sinceDays }
 * sms_send_logs.status='failed' 기준(재시도 최종 실패 포함).
 */
export const GET = withSuperAdmin(async () => {
  const supabase = serverSupabase()
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString()

  // 정확한 총계 (상한 없음). 테스트 발송은 lead_id 없이 기록되므로 제외 → 실제 리드 알림 실패만 집계.
  const { count, error } = await supabase
    .from('sms_send_logs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed')
    .not('lead_id', 'is', null)
    .gte('created_at', since)

  if (error) {
    logger.error('문자 실패 집계 조회 실패', error)
    return apiError('문자 발송 실패 집계를 불러오지 못했습니다.', 500)
  }

  // 병원별 분포 (참고용, 최대 MAX_ROWS 표본 — total은 위 정확 count 사용)
  const { data } = await supabase
    .from('sms_send_logs')
    .select('clinic_id')
    .eq('status', 'failed')
    .not('lead_id', 'is', null)
    .gte('created_at', since)
    .limit(MAX_ROWS)

  const byClinic: Record<string, number> = {}
  for (const row of data || []) {
    const key = String((row as { clinic_id: number | null }).clinic_id ?? 'null')
    byClinic[key] = (byClinic[key] || 0) + 1
  }

  return apiSuccess({ total: count || 0, byClinic, sinceDays: WINDOW_DAYS })
})

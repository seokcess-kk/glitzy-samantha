import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { getKstDayStartISO } from '@/lib/date'
import { createLogger } from '@/lib/logger'

const logger = createLogger('TaskQueues')

// "미연락" 판정 기준 시간(신규 리드 유입 후 경과). 쿼리 파라미터 staleHours로 조정 가능.
const DEFAULT_STALE_HOURS = 24

/**
 * 실무자 업무 큐 집계 API
 * 오늘 처리해야 할 업무를 카운트로 반환한다. 각 큐는 프론트에서 필터 목록으로 드릴다운.
 * 모두 현재 데이터(신규 컬럼 없이)로 계산:
 * - newLeads:            신규 미처리 리드 (lead_status='new')
 * - staleNewLeads:       N시간 이상 미연락 (lead_status='new' AND created_at < now-Xh) — newLeads의 부분집합
 * - holdLeads:           보류 리드 (lead_status='hold')
 * - consultedNotBooked:  상담 연결됐으나 예약 전 (lead_status IN ('consulting','consulted'))
 * - todayBookings:       오늘 예약 (booking_datetime=오늘, 취소·노쇼 제외)
 * - todayCancelledNoshow: 오늘 취소·노쇼 (booking_datetime=오늘, status IN ('cancelled','noshow'))
 */
export const GET = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  if (user.role === 'demo_viewer') {
    return apiSuccess({
      newLeads: 5, staleNewLeads: 2, holdLeads: 3, consultedNotBooked: 4,
      todayBookings: 6, todayCancelledNoshow: 1, dueCallbacks: 3, staleHours: DEFAULT_STALE_HOURS,
    })
  }

  // agency_staff 배정 병원 0개 → 모두 0
  if (assignedClinicIds !== null && assignedClinicIds.length === 0) {
    return apiSuccess({
      newLeads: 0, staleNewLeads: 0, holdLeads: 0, consultedNotBooked: 0,
      todayBookings: 0, todayCancelledNoshow: 0, dueCallbacks: 0, staleHours: DEFAULT_STALE_HOURS,
    })
  }

  try {
    const supabase = serverSupabase()
    const url = new URL(req.url)
    const staleHours = Math.min(Math.max(Number(url.searchParams.get('staleHours')) || DEFAULT_STALE_HOURS, 1), 720)
    const ctx = { clinicId, assignedClinicIds }

    const now = new Date()
    const todayStart = getKstDayStartISO(now) // KST 오늘 00:00 (UTC ISO)
    const todayEnd = getKstDayStartISO(new Date(now.getTime() + 86400000)) // 내일 00:00
    const staleThreshold = new Date(now.getTime() - staleHours * 3600000).toISOString()

    const [newLeads, staleNewLeads, holdLeads, consultedNotBooked, todayBookings, todayCancelledNoshow] = await Promise.all([
      applyClinicFilter(supabase.from('leads').select('*', { count: 'exact', head: true })
        .eq('lead_status', 'new'), ctx)!,
      applyClinicFilter(supabase.from('leads').select('*', { count: 'exact', head: true })
        .eq('lead_status', 'new').lt('created_at', staleThreshold), ctx)!,
      applyClinicFilter(supabase.from('leads').select('*', { count: 'exact', head: true })
        .eq('lead_status', 'hold'), ctx)!,
      applyClinicFilter(supabase.from('leads').select('*', { count: 'exact', head: true })
        .in('lead_status', ['consulting', 'consulted']), ctx)!,
      applyClinicFilter(supabase.from('bookings').select('*', { count: 'exact', head: true })
        .gte('booking_datetime', todayStart).lt('booking_datetime', todayEnd)
        .neq('status', 'cancelled').neq('status', 'noshow'), ctx)!,
      applyClinicFilter(supabase.from('bookings').select('*', { count: 'exact', head: true })
        .gte('booking_datetime', todayStart).lt('booking_datetime', todayEnd)
        .in('status', ['cancelled', 'noshow']), ctx)!,
    ])

    const results = [newLeads, staleNewLeads, holdLeads, consultedNotBooked, todayBookings, todayCancelledNoshow]
    const failed = results.find(r => r.error)
    if (failed) {
      logger.error('업무 큐 조회 실패', failed.error, { clinicId })
      return apiError('업무 큐 조회에 실패했습니다.', 500)
    }

    // 오늘 재연락 대상 — best-effort(재연락 마이그레이션 20260724 미적용 시 0, 나머지 인박스는 유지)
    let dueCallbacks = 0
    const dueRes = await applyClinicFilter(
      supabase.from('leads').select('*', { count: 'exact', head: true })
        .lte('next_contact_at', now.toISOString())
        .not('lead_status', 'in', '("booked","rejected")'),
      ctx,
    )!
    if (dueRes.error) logger.warn('재연락 대상 집계 건너뜀(마이그레이션 미적용 가능)', { clinicId })
    else dueCallbacks = dueRes.count || 0

    return apiSuccess({
      newLeads: newLeads.count || 0,
      staleNewLeads: staleNewLeads.count || 0,
      holdLeads: holdLeads.count || 0,
      consultedNotBooked: consultedNotBooked.count || 0,
      todayBookings: todayBookings.count || 0,
      todayCancelledNoshow: todayCancelledNoshow.count || 0,
      dueCallbacks,
      staleHours,
    })
  } catch (err) {
    logger.error('업무 큐 조회 실패', err, { clinicId })
    return apiError('업무 큐 조회에 실패했습니다.', 500)
  }
})

import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { SupabaseClient } from '@supabase/supabase-js'
import { getKstDateString, getKstDayStartISO, getKstDayEndISO } from '@/lib/date'
import { fetchAdMarkups, markupTotal, type AdMarkup } from '@/lib/ad-markup'
import { createLogger } from '@/lib/logger'

const logger = createLogger('DashboardKpi')

// 메트릭 계산 함수 추출
// start: KST 시작일 00:00:00 (ISO 또는 +09:00), end: KST 종료일 다음날 00:00:00 (exclusive)
async function fetchMetrics(
  supabase: SupabaseClient,
  clinicId: number | null,
  assignedClinicIds: number[] | null,
  start: string,
  end: string,
  markups: AdMarkup[]
) {
  const ctx = { clinicId, assignedClinicIds }

  // stat_date(YYYY-MM-DD, DATE 컬럼)용 KST 날짜 추출
  const statStart = getKstDateString(new Date(start))
  // end는 다음날 자정이므로 하루 빼서 종료일 추출
  const statEnd = getKstDateString(new Date(new Date(end).getTime() - 86400000))

  // 범위 패턴: [start, end) — fetchTodaySummary와 동일한 gte/lt 패턴
  const [adStatsRes, leadsRes, paymentsRes, bookingsRes, consultRes, contentBudgetRes] = await Promise.all([
    applyClinicFilter(supabase.from('ad_campaign_stats').select('spend_amount, clicks, impressions').gte('stat_date', statStart).lte('stat_date', statEnd), ctx)!,
    applyClinicFilter(supabase.from('leads').select('customer_id').gte('created_at', start).lt('created_at', end).limit(5000), ctx)!,
    applyClinicFilter(supabase.from('payments').select('customer_id, payment_amount').gte('payment_date', statStart).lte('payment_date', statEnd), ctx)!,
    applyClinicFilter(supabase.from('bookings').select('*', { count: 'exact', head: true })
      .neq('status', 'cancelled').gte('created_at', start).lt('created_at', end), ctx)!,
    applyClinicFilter(supabase.from('consultations').select('*', { count: 'exact', head: true })
      .in('status', ['예약완료', '방문완료']).gte('created_at', start).lt('created_at', end), ctx)!,
    applyClinicFilter(supabase.from('content_posts').select('budget').gte('created_at', start).lt('created_at', end), ctx)!,
  ])

  // 광고비 마크업(관리 수수료 등) 가산 — DB 원본은 그대로 두고 조회 시점에만 합산.
  // spend에서 파생되는 ROAS·CPL·CPC·CAC가 모두 자동 반영됨.
  const markupAmount = markupTotal(markups, statStart, statEnd)
  const totalSpend = (adStatsRes.data?.reduce((s, r) => s + Number(r.spend_amount), 0) || 0) + markupAmount
  const totalClicks = adStatsRes.data?.reduce((s, r) => s + Number(r.clicks || 0), 0) || 0
  const totalImpressions = adStatsRes.data?.reduce((s, r) => s + Number(r.impressions || 0), 0) || 0
  const totalLeads = leadsRes.data?.length || 0
  const totalRevenue = paymentsRes.data?.reduce((s, r) => s + Number(r.payment_amount), 0) || 0
  const bookedCount = bookingsRes.count || 0
  const consultCount = consultRes.count || 0
  const contentBudget = contentBudgetRes.data?.reduce((s, p) => s + (p.budget || 0), 0) || 0

  // 결제 완료 고객 수 (distinct customer_id)
  const payingCustomerCount = new Set(paymentsRes.data?.map(p => p.customer_id) || []).size

  // CAC: (광고비 + 콘텐츠 예산) / 결제 완료 고객 수
  const totalMarketingCost = totalSpend + contentBudget
  const cac = payingCustomerCount > 0 ? Math.round(totalMarketingCost / payingCustomerCount) : 0

  // ARPC: 총 결제 금액 / 결제 완료 고객 수
  const arpc = payingCustomerCount > 0 ? Math.round(totalRevenue / payingCustomerCount) : 0

  return {
    cpl: totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0,
    // ROAS: 기간 내 광고비 대비 전체 매출 (리드 귀속 제한 없음)
    roas: totalSpend > 0 ? Number((totalRevenue / totalSpend).toFixed(2)) : 0,
    bookingRate: totalLeads > 0 ? Number(((bookedCount / totalLeads) * 100).toFixed(1)) : 0,
    totalRevenue,
    totalLeads,
    totalSpend,
    totalConsultations: consultCount,
    cac,
    arpc,
    payingCustomerCount,
    totalClicks,
    totalImpressions,
    cpc: totalClicks > 0 ? Math.round(totalSpend / totalClicks) : 0,
    ctr: totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0,
    // 광고비에 마크업이 포함되었는지 — UI 고지(ⓘ "관리비 포함") 표시 여부
    spendIncludesMarkup: markupAmount > 0,
  }
}

// 변화율 계산 함수
function calcChange(prev: number, curr: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0
  return Number((((curr - prev) / prev) * 100).toFixed(1))
}

// 오늘 요약 데이터 (리드, 예약, 매출 + 전일 대비)
async function fetchTodaySummary(
  supabase: SupabaseClient,
  clinicId: number | null,
  assignedClinicIds: number[] | null,
) {
  const ctx = { clinicId, assignedClinicIds }

  // KST 기준 오늘 00:00 ~ 내일 00:00 (lt 쿼리용)
  const now = new Date()
  const todayStart = getKstDayStartISO(now)
  const tomorrow = new Date(now.getTime() + 86400000)
  const todayEnd = getKstDayStartISO(tomorrow)
  const yesterday = new Date(now.getTime() - 86400000)
  const yesterdayStart = getKstDayStartISO(yesterday)

  const [todayLeads, todayBookings, todayPayments, yesterdayLeads, yesterdayBookings, yesterdayPayments] = await Promise.all([
    applyClinicFilter(supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', todayStart).lt('created_at', todayEnd), ctx)!,
    applyClinicFilter(supabase.from('bookings').select('*', { count: 'exact', head: true }).neq('status', 'cancelled').gte('created_at', todayStart).lt('created_at', todayEnd), ctx)!,
    applyClinicFilter(supabase.from('payments').select('payment_amount').gte('payment_date', todayStart).lt('payment_date', todayEnd), ctx)!,
    applyClinicFilter(supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', yesterdayStart).lt('created_at', todayStart), ctx)!,
    applyClinicFilter(supabase.from('bookings').select('*', { count: 'exact', head: true }).neq('status', 'cancelled').gte('created_at', yesterdayStart).lt('created_at', todayStart), ctx)!,
    applyClinicFilter(supabase.from('payments').select('payment_amount').gte('payment_date', yesterdayStart).lt('payment_date', todayStart), ctx)!,
  ])

  const leads = todayLeads.count || 0
  const bookings = todayBookings.count || 0
  const revenue = todayPayments.data?.reduce((s, r) => s + Number(r.payment_amount), 0) || 0
  const yLeads = yesterdayLeads.count || 0
  const yBookings = yesterdayBookings.count || 0
  const yRevenue = yesterdayPayments.data?.reduce((s, r) => s + Number(r.payment_amount), 0) || 0

  return {
    leads,
    bookings,
    revenue,
    leadsDiff: leads - yLeads,
    bookingsDiff: bookings - yBookings,
    revenueDiff: revenue - yRevenue,
  }
}

export const GET = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  try {
    if (user.role === 'demo_viewer') {
      const { demoKpi } = await import('@/lib/demo/fixtures/aggregates')
      const url = new URL(req.url)
      return apiSuccess(demoKpi(
        clinicId,
        url.searchParams.get('startDate'),
        url.searchParams.get('endDate'),
        url.searchParams.get('compare') === 'true'
      ))
    }

    // agency_staff 배정 병원 0개 → 빈 결과
    if (assignedClinicIds !== null && assignedClinicIds.length === 0) {
      return apiSuccess({
        cpl: 0, roas: 0, bookingRate: 0, totalRevenue: 0, totalLeads: 0, totalSpend: 0, totalConsultations: 0, cac: 0, arpc: 0, payingCustomerCount: 0,
        totalClicks: 0, totalImpressions: 0, cpc: 0, ctr: 0, spendIncludesMarkup: false,
        today: { leads: 0, bookings: 0, revenue: 0, leadsDiff: 0, bookingsDiff: 0, revenueDiff: 0 },
      })
    }

    const supabase = serverSupabase()
    const url = new URL(req.url)
    const startParam = url.searchParams.get('startDate') || getKstDateString(new Date(Date.now() - 30 * 86400000))
    const endParam = url.searchParams.get('endDate') || getKstDateString()
    // ISO/YYYY-MM-DD → KST 기준 [start, end) 범위로 변환
    // end는 종료일 다음날 자정 (exclusive) — fetchTodaySummary와 동일 패턴
    const startKst = getKstDateString(new Date(startParam))
    const endKst = getKstDateString(new Date(endParam))
    const start = `${startKst}T00:00:00+09:00`
    const endDate = new Date(endKst + 'T00:00:00+09:00')
    endDate.setDate(endDate.getDate() + 1)
    const end = endDate.toISOString()
    const compare = url.searchParams.get('compare') === 'true'

    // 광고비 마크업 설정 (clinic_id 스코프) — 현재/전기 기간에 동일 적용
    const markups = await fetchAdMarkups(supabase, { clinicId, assignedClinicIds })

    // 기간 KPI + 오늘 요약 병렬 조회
    const [current, today] = await Promise.all([
      fetchMetrics(supabase, clinicId, assignedClinicIds, start, end, markups),
      fetchTodaySummary(supabase, clinicId, assignedClinicIds),
    ])

    // 비교 모드: 전기 데이터와 변화율 계산
    if (compare) {
      const duration = new Date(end).getTime() - new Date(start).getTime()
      const prevStart = new Date(new Date(start).getTime() - duration).toISOString()
      const prevEnd = new Date(new Date(end).getTime() - duration).toISOString()

      const previous = await fetchMetrics(supabase, clinicId, assignedClinicIds, prevStart, prevEnd, markups)

      return apiSuccess({
        ...current,
        today,
        comparison: {
          cpl: calcChange(previous.cpl, current.cpl),
          roas: calcChange(previous.roas, current.roas),
          bookingRate: calcChange(previous.bookingRate, current.bookingRate),
          totalRevenue: calcChange(previous.totalRevenue, current.totalRevenue),
          totalLeads: calcChange(previous.totalLeads, current.totalLeads),
          totalConsultations: calcChange(previous.totalConsultations, current.totalConsultations),
          totalSpend: calcChange(previous.totalSpend, current.totalSpend),
          cac: calcChange(previous.cac, current.cac),
          arpc: calcChange(previous.arpc, current.arpc),
          cpc: calcChange(previous.cpc, current.cpc),
          ctr: calcChange(previous.ctr, current.ctr),
        },
      })
    }

    return apiSuccess({ ...current, today })
  } catch (err) {
    logger.error('KPI 조회 실패', err, { clinicId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})

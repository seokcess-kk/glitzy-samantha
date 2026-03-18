import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, apiError, apiSuccess } from '@/lib/api-middleware'

/**
 * 랜딩 페이지별 성과 통계 API
 * - 리드 수 (lead_raw_logs 기준, 삭제된 리드 포함)
 * - 예약 전환율, 결제 전환율, 매출 (leads 기준, 현재 존재하는 데이터)
 */
export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')

  // agency_staff 배정 병원 0개 → 빈 결과
  if (assignedClinicIds !== null && assignedClinicIds.length === 0) {
    return apiSuccess([])
  }

  const applyClinic = <T>(q: T): T => {
    if (clinicId) return (q as any).eq('clinic_id', clinicId)
    if (assignedClinicIds !== null && assignedClinicIds.length > 0) return (q as any).in('clinic_id', assignedClinicIds)
    return q
  }
  const applyDate = <T>(q: T, field: string): T => {
    let query = q
    if (startDate) query = (query as any).gte(field, startDate)
    if (endDate) query = (query as any).lte(field, endDate)
    return query
  }

  // 1. lead_raw_logs에서 실제 유입 리드 건수 집계 (삭제 무관)
  let rawLogsQuery = supabase
    .from('lead_raw_logs')
    .select('payload')
    .eq('status', 'processed')
  rawLogsQuery = applyClinic(rawLogsQuery)
  rawLogsQuery = applyDate(rawLogsQuery, 'created_at')

  // 2. leads 테이블에서 현재 존재하는 리드 (예약/결제 귀속 집계용)
  let leadsQuery = supabase
    .from('leads')
    .select('id, customer_id, landing_page_id, utm_source, utm_campaign, created_at')
    .not('landing_page_id', 'is', null)
  leadsQuery = applyClinic(leadsQuery)
  leadsQuery = applyDate(leadsQuery, 'created_at')

  // 3. 결제 데이터
  let paymentsQuery = supabase
    .from('payments')
    .select('customer_id, payment_amount')
  paymentsQuery = applyClinic(paymentsQuery)
  if (startDate || endDate) paymentsQuery = applyDate(paymentsQuery, 'payment_date')

  // 4. 예약 데이터
  let bookingsQuery = supabase
    .from('bookings')
    .select('customer_id, status')
  bookingsQuery = applyClinic(bookingsQuery)
  if (startDate || endDate) bookingsQuery = applyDate(bookingsQuery, 'created_at')

  const [rawLogsRes, leadsRes, paymentsRes, bookingsRes] = await Promise.all([
    rawLogsQuery,
    leadsQuery,
    paymentsQuery,
    bookingsQuery,
  ])

  if (leadsRes.error) return apiError(leadsRes.error.message, 500)

  // lead_raw_logs에서 랜딩페이지별 리드 건수 집계
  const rawLeadCountByLp: Record<number, number> = {}
  for (const log of rawLogsRes.data || []) {
    const lpId = Number(log.payload?.landing_page_id)
    if (!lpId || isNaN(lpId)) continue
    rawLeadCountByLp[lpId] = (rawLeadCountByLp[lpId] || 0) + 1
  }

  // leads 테이블에서 랜딩페이지별 리드 건수 + 고객 매핑
  const leadsCountByLp: Record<number, number> = {}
  const customerToLp = new Map<number, number>()
  const lpIds = new Set<number>()

  for (const lead of leadsRes.data || []) {
    const lpId = lead.landing_page_id
    if (!lpId) continue
    lpIds.add(lpId)
    leadsCountByLp[lpId] = (leadsCountByLp[lpId] || 0) + 1
    if (!customerToLp.has(lead.customer_id)) {
      customerToLp.set(lead.customer_id, lpId)
    }
  }

  // raw_logs에만 있는 landing_page_id도 포함
  for (const lpId of Object.keys(rawLeadCountByLp)) {
    lpIds.add(Number(lpId))
  }

  // 예약 집계
  const bookingsByLp: Record<number, number> = {}
  for (const b of bookingsRes.data || []) {
    if (b.status === 'cancelled') continue
    const lpId = customerToLp.get(b.customer_id)
    if (lpId) bookingsByLp[lpId] = (bookingsByLp[lpId] || 0) + 1
  }

  // 매출 집계
  const revenueByLp: Record<number, number> = {}
  const payingByLp: Record<number, Set<number>> = {}
  for (const p of paymentsRes.data || []) {
    const lpId = customerToLp.get(p.customer_id)
    if (lpId) {
      revenueByLp[lpId] = (revenueByLp[lpId] || 0) + Number(p.payment_amount)
      if (!payingByLp[lpId]) payingByLp[lpId] = new Set()
      payingByLp[lpId].add(p.customer_id)
    }
  }

  // 결과 생성
  const result = Array.from(lpIds).map(lpId => {
    // raw_logs 건수와 leads 테이블 건수 중 큰 값 사용 (raw_logs 도입 전 데이터 호환)
    const leads = Math.max(rawLeadCountByLp[lpId] || 0, leadsCountByLp[lpId] || 0)
    const bookings = bookingsByLp[lpId] || 0
    const revenue = revenueByLp[lpId] || 0
    const payingCustomers = payingByLp[lpId]?.size || 0

    return {
      landing_page_id: lpId,
      lead_count: leads,
      booking_count: bookings,
      paying_customers: payingCustomers,
      revenue,
      booking_rate: leads > 0 ? Number(((bookings / leads) * 100).toFixed(1)) : 0,
      conversion_rate: leads > 0 ? Number(((payingCustomers / leads) * 100).toFixed(1)) : 0,
    }
  })

  return apiSuccess(result)
})

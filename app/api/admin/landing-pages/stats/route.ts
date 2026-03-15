import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, apiError, apiSuccess } from '@/lib/api-middleware'

/**
 * 랜딩 페이지별 성과 통계 API
 * - 리드 수, 예약 전환율, 결제 전환율, 매출
 */
export const GET = withClinicFilter(async (req: Request, { clinicId }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')

  const applyClinic = <T>(q: T): T => clinicId ? (q as any).eq('clinic_id', clinicId) : q
  const applyDate = <T>(q: T, field: string): T => {
    let query = q
    if (startDate) query = (query as any).gte(field, startDate)
    if (endDate) query = (query as any).lte(field, endDate)
    return query
  }

  // 1. 리드 조회 (landing_page_id 있는 것만)
  let leadsQuery = supabase
    .from('leads')
    .select('id, customer_id, landing_page_id, utm_source, utm_campaign, created_at')
    .not('landing_page_id', 'is', null)
  leadsQuery = applyClinic(leadsQuery)
  leadsQuery = applyDate(leadsQuery, 'created_at')

  // 2. 결제 데이터
  let paymentsQuery = supabase
    .from('payments')
    .select('customer_id, payment_amount')
  paymentsQuery = applyClinic(paymentsQuery)
  if (startDate || endDate) paymentsQuery = applyDate(paymentsQuery, 'payment_date')

  // 3. 예약 데이터
  let bookingsQuery = supabase
    .from('bookings')
    .select('customer_id, status')
  bookingsQuery = applyClinic(bookingsQuery)
  if (startDate || endDate) bookingsQuery = applyDate(bookingsQuery, 'created_at')

  const [leadsRes, paymentsRes, bookingsRes] = await Promise.all([
    leadsQuery,
    paymentsQuery,
    bookingsQuery,
  ])

  if (leadsRes.error) return apiError(leadsRes.error.message, 500)

  // 랜딩페이지별 리드 집계
  const lpStats: Record<number, {
    landing_page_id: number
    lead_count: number
    customers: Set<number>
  }> = {}

  const customerToLp = new Map<number, number>()

  for (const lead of leadsRes.data || []) {
    const lpId = lead.landing_page_id
    if (!lpId) continue

    if (!lpStats[lpId]) {
      lpStats[lpId] = { landing_page_id: lpId, lead_count: 0, customers: new Set() }
    }
    lpStats[lpId].lead_count++
    lpStats[lpId].customers.add(lead.customer_id)

    if (!customerToLp.has(lead.customer_id)) {
      customerToLp.set(lead.customer_id, lpId)
    }
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
  const result = Object.values(lpStats).map(stat => {
    const leads = stat.lead_count
    const bookings = bookingsByLp[stat.landing_page_id] || 0
    const revenue = revenueByLp[stat.landing_page_id] || 0
    const payingCustomers = payingByLp[stat.landing_page_id]?.size || 0

    return {
      landing_page_id: stat.landing_page_id,
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

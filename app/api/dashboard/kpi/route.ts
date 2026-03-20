import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext } from '@/lib/api-middleware'
import { SupabaseClient } from '@supabase/supabase-js'
import { getKstDayStartISO, getKstDayEndISO } from '@/lib/date'

// 메트릭 계산 함수 추출
async function fetchMetrics(
  supabase: SupabaseClient,
  clinicId: number | null,
  assignedClinicIds: number[] | null,
  start: string,
  end: string
) {
  const applyFilter = <T>(q: T): T => {
    if (clinicId) return (q as any).eq('clinic_id', clinicId)
    if (assignedClinicIds !== null && assignedClinicIds.length > 0) return (q as any).in('clinic_id', assignedClinicIds)
    return q
  }

  const [adStatsRes, leadsRes, paymentsRes, bookingsRes, consultRes, contentBudgetRes] = await Promise.all([
    applyFilter(supabase.from('ad_campaign_stats').select('spend_amount, clicks, impressions').gte('stat_date', start).lte('stat_date', end)),
    applyFilter(supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', start).lte('created_at', end)),
    applyFilter(supabase.from('payments').select('customer_id, payment_amount').gte('payment_date', start).lte('payment_date', end)),
    applyFilter(supabase.from('bookings').select('*', { count: 'exact', head: true })
      .neq('status', 'cancelled').gte('created_at', start).lte('created_at', end)),
    applyFilter(supabase.from('consultations').select('*', { count: 'exact', head: true })
      .in('status', ['예약완료', '방문완료']).gte('created_at', start).lte('created_at', end)),
    applyFilter(supabase.from('content_posts').select('budget').gte('created_at', start).lte('created_at', end)),
  ])

  const totalSpend = adStatsRes.data?.reduce((s, r) => s + Number(r.spend_amount), 0) || 0
  const totalClicks = adStatsRes.data?.reduce((s, r) => s + Number(r.clicks || 0), 0) || 0
  const totalImpressions = adStatsRes.data?.reduce((s, r) => s + Number(r.impressions || 0), 0) || 0
  const totalLeads = leadsRes.count || 0
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
  const applyFilter = <T>(q: T): T => {
    if (clinicId) return (q as any).eq('clinic_id', clinicId)
    if (assignedClinicIds !== null && assignedClinicIds.length > 0) return (q as any).in('clinic_id', assignedClinicIds)
    return q
  }

  // KST 기준 오늘 00:00 ~ 내일 00:00 (lt 쿼리용)
  const now = new Date()
  const todayStart = getKstDayStartISO(now)
  const tomorrow = new Date(now.getTime() + 86400000)
  const todayEnd = getKstDayStartISO(tomorrow)
  const yesterday = new Date(now.getTime() - 86400000)
  const yesterdayStart = getKstDayStartISO(yesterday)

  const [todayLeads, todayBookings, todayPayments, yesterdayLeads, yesterdayBookings, yesterdayPayments] = await Promise.all([
    applyFilter(supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', todayStart).lt('created_at', todayEnd)),
    applyFilter(supabase.from('bookings').select('*', { count: 'exact', head: true }).neq('status', 'cancelled').gte('created_at', todayStart).lt('created_at', todayEnd)),
    applyFilter(supabase.from('payments').select('payment_amount').gte('payment_date', todayStart).lt('payment_date', todayEnd)),
    applyFilter(supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', yesterdayStart).lt('created_at', todayStart)),
    applyFilter(supabase.from('bookings').select('*', { count: 'exact', head: true }).neq('status', 'cancelled').gte('created_at', yesterdayStart).lt('created_at', todayStart)),
    applyFilter(supabase.from('payments').select('payment_amount').gte('payment_date', yesterdayStart).lt('payment_date', todayStart)),
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

export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
  // agency_staff 배정 병원 0개 → 빈 결과
  if (assignedClinicIds !== null && assignedClinicIds.length === 0) {
    return NextResponse.json({
      cpl: 0, roas: 0, bookingRate: 0, totalRevenue: 0, totalLeads: 0, totalSpend: 0, totalConsultations: 0, cac: 0, arpc: 0, payingCustomerCount: 0,
      totalClicks: 0, totalImpressions: 0, cpc: 0, ctr: 0,
      today: { leads: 0, bookings: 0, revenue: 0, leadsDiff: 0, bookingsDiff: 0, revenueDiff: 0 },
    })
  }

  const supabase = serverSupabase()
  const url = new URL(req.url)
  const start = url.searchParams.get('startDate') || getKstDayStartISO(new Date(Date.now() - 30 * 86400000))
  const end = url.searchParams.get('endDate') || getKstDayEndISO()
  const compare = url.searchParams.get('compare') === 'true'

  // 기간 KPI + 오늘 요약 병렬 조회
  const [current, today] = await Promise.all([
    fetchMetrics(supabase, clinicId, assignedClinicIds, start, end),
    fetchTodaySummary(supabase, clinicId, assignedClinicIds),
  ])

  // 비교 모드: 전기 데이터와 변화율 계산
  if (compare) {
    const duration = new Date(end).getTime() - new Date(start).getTime()
    const prevStart = new Date(new Date(start).getTime() - duration).toISOString()
    const prevEnd = new Date(new Date(end).getTime() - duration).toISOString()

    const previous = await fetchMetrics(supabase, clinicId, assignedClinicIds, prevStart, prevEnd)

    return NextResponse.json({
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

  return NextResponse.json({ ...current, today })
})

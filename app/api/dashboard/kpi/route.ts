import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext } from '@/lib/api-middleware'

export const GET = withClinicFilter(async (req: Request, { clinicId }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const start = url.searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const end = url.searchParams.get('endDate') || new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFilter = <T>(q: T): T => clinicId ? (q as any).eq('clinic_id', clinicId) : q

  const [adStatsRes, leadsRes, paymentsRes, consultRes, contentBudgetRes] = await Promise.all([
    applyFilter(supabase.from('ad_campaign_stats').select('spend_amount').gte('stat_date', start).lte('stat_date', end)),
    applyFilter(supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', start).lte('created_at', end)),
    applyFilter(supabase.from('payments').select('customer_id, payment_amount').gte('payment_date', start).lte('payment_date', end)),
    applyFilter(supabase.from('consultations').select('*', { count: 'exact', head: true })
      .in('status', ['예약완료', '방문완료']).gte('created_at', start).lte('created_at', end)),
    applyFilter(supabase.from('content_posts').select('budget')),
  ])

  const totalSpend = adStatsRes.data?.reduce((s, r) => s + Number(r.spend_amount), 0) || 0
  const totalLeads = leadsRes.count || 0
  const totalRevenue = paymentsRes.data?.reduce((s, r) => s + Number(r.payment_amount), 0) || 0
  const bookedCount = consultRes.count || 0
  const contentBudget = contentBudgetRes.data?.reduce((s, p) => s + (p.budget || 0), 0) || 0

  // 결제 완료 고객 수 (distinct customer_id)
  const payingCustomerCount = new Set(paymentsRes.data?.map(p => p.customer_id) || []).size

  // CAC: (광고비 + 콘텐츠 예산) / 결제 완료 고객 수
  const totalMarketingCost = totalSpend + contentBudget
  const cac = payingCustomerCount > 0 ? Math.round(totalMarketingCost / payingCustomerCount) : 0

  // ARPC: 총 결제 금액 / 결제 완료 고객 수
  const arpc = payingCustomerCount > 0 ? Math.round(totalRevenue / payingCustomerCount) : 0

  return NextResponse.json({
    cpl: totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0,
    roas: totalSpend > 0 ? Number((totalRevenue / totalSpend).toFixed(2)) : 0,
    bookingRate: totalLeads > 0 ? Number(((bookedCount / totalLeads) * 100).toFixed(1)) : 0,
    totalRevenue,
    totalLeads,
    totalSpend,
    cac,
    arpc,
    payingCustomerCount,
  })
})

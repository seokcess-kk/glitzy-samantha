import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, applyDateRange, apiSuccess } from '@/lib/api-middleware'
import { normalizeChannel } from '@/lib/channel'
import { getKstDateString } from '@/lib/date'

/**
 * 캠페인별 KPI 분석 API
 * Phase 2: leads.utm_campaign 기반 캠페인 성과 분석
 */
export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')
  const channel = url.searchParams.get('channel') // 특정 채널 필터 (선택)

  // agency_staff 배정 병원 0개 → 빈 결과
  if (assignedClinicIds !== null && assignedClinicIds.length === 0) {
    return apiSuccess([])
  }

  const ctx = { clinicId, assignedClinicIds }

  // DATE 컬럼(stat_date, payment_date)용 KST 날짜 문자열 변환
  const statStart = startDate ? getKstDateString(new Date(startDate)) : null
  const statEnd = endDate ? getKstDateString(new Date(endDate)) : null

  // 1. 리드 데이터 조회 (utm_source, utm_campaign 포함)
  let leadsQuery = supabase
    .from('leads')
    .select('id, customer_id, utm_source, utm_campaign, utm_content, created_at')
    .not('utm_campaign', 'is', null) // 캠페인이 있는 리드만
    .limit(5000)
  leadsQuery = applyClinicFilter(leadsQuery, ctx)!
  leadsQuery = applyDateRange(leadsQuery, 'created_at', startDate, endDate)
  if (channel) {
    leadsQuery = leadsQuery.ilike('utm_source', channel)
  }

  // 2. 광고 지출 데이터 (캠페인별) — stat_date(DATE 컬럼)는 KST 날짜 문자열로 비교
  let adStatsQuery = supabase
    .from('ad_campaign_stats')
    .select('campaign_name, campaign_id, platform, spend_amount, clicks, impressions, stat_date')
  adStatsQuery = applyClinicFilter(adStatsQuery, ctx)!
  if (statStart) adStatsQuery = adStatsQuery.gte('stat_date', statStart)
  if (statEnd) adStatsQuery = adStatsQuery.lte('stat_date', statEnd)

  // 3. 결제 데이터 — payment_date(DATE 컬럼)는 KST 날짜 문자열로 비교
  let paymentsQuery = supabase
    .from('payments')
    .select('payment_amount, customer_id, payment_date')
    .limit(5000)
  paymentsQuery = applyClinicFilter(paymentsQuery, ctx)!
  if (statStart) paymentsQuery = paymentsQuery.gte('payment_date', statStart)
  if (statEnd) paymentsQuery = paymentsQuery.lte('payment_date', statEnd)

  // 4. 예약 데이터 (전환율 계산용)
  let bookingsQuery = supabase
    .from('bookings')
    .select('id, customer_id, status, created_at')
    .limit(5000)
  bookingsQuery = applyClinicFilter(bookingsQuery, ctx)!
  bookingsQuery = applyDateRange(bookingsQuery, 'created_at', startDate, endDate)

  const [leadsRes, adStatsRes, paymentsRes, bookingsRes] = await Promise.all([
    leadsQuery,
    adStatsQuery,
    paymentsQuery,
    bookingsQuery,
  ])

  // 캠페인별 리드 집계
  const campaignStats: Record<string, {
    campaign: string
    channel: string
    leads: Set<number>
    customers: Set<number>
  }> = {}

  const customerToCampaign: Map<number, string> = new Map()

  for (const lead of leadsRes.data || []) {
    const campaign = lead.utm_campaign || 'Unknown'
    const channel = normalizeChannel(lead.utm_source)

    if (!campaignStats[campaign]) {
      campaignStats[campaign] = {
        campaign,
        channel,
        leads: new Set(),
        customers: new Set(),
      }
    }

    campaignStats[campaign].leads.add(lead.id)
    campaignStats[campaign].customers.add(lead.customer_id)

    // 고객의 첫 번째 캠페인 기록
    if (!customerToCampaign.has(lead.customer_id)) {
      customerToCampaign.set(lead.customer_id, campaign)
    }
  }

  // 광고 지출 집계 (campaign_name 또는 campaign_id 기준)
  const spendByCampaign: Record<string, { spend: number; clicks: number; impressions: number }> = {}
  for (const row of adStatsRes.data || []) {
    const campaignKey = row.campaign_name || row.campaign_id || 'Unknown'
    if (!spendByCampaign[campaignKey]) {
      spendByCampaign[campaignKey] = { spend: 0, clicks: 0, impressions: 0 }
    }
    spendByCampaign[campaignKey].spend += Number(row.spend_amount) || 0
    spendByCampaign[campaignKey].clicks += Number(row.clicks) || 0
    spendByCampaign[campaignKey].impressions += Number(row.impressions) || 0
  }

  // 캠페인별 매출 집계
  const revenueByCampaign: Record<string, number> = {}
  const payingCustomersByCampaign: Record<string, Set<number>> = {}

  for (const payment of paymentsRes.data || []) {
    const campaign = customerToCampaign.get(payment.customer_id)
    if (campaign) {
      revenueByCampaign[campaign] = (revenueByCampaign[campaign] || 0) + Number(payment.payment_amount)

      if (!payingCustomersByCampaign[campaign]) {
        payingCustomersByCampaign[campaign] = new Set()
      }
      payingCustomersByCampaign[campaign].add(payment.customer_id)
    }
  }

  // 캠페인별 예약 집계
  const bookingsByCampaign: Record<string, number> = {}
  for (const booking of bookingsRes.data || []) {
    const campaign = customerToCampaign.get(booking.customer_id)
    if (campaign && booking.status !== 'cancelled') {
      bookingsByCampaign[campaign] = (bookingsByCampaign[campaign] || 0) + 1
    }
  }

  // 결과 생성
  const result = Object.values(campaignStats)
    .map(stat => {
      const leads = stat.leads.size
      const adData = spendByCampaign[stat.campaign] || { spend: 0, clicks: 0, impressions: 0 }
      const spend = adData.spend
      const revenue = revenueByCampaign[stat.campaign] || 0
      const payingCustomers = payingCustomersByCampaign[stat.campaign]?.size || 0
      const bookings = bookingsByCampaign[stat.campaign] || 0

      return {
        campaign: stat.campaign,
        channel: stat.channel,
        leads,
        bookings,
        payingCustomers,
        spend,
        revenue,
        clicks: adData.clicks,
        impressions: adData.impressions,
        cpl: leads > 0 ? Math.round(spend / leads) : 0,
        roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : 0,
        roasPercent: spend > 0 ? Math.round((revenue / spend) * 100) : 0,
        bookingRate: leads > 0 ? Number(((bookings / leads) * 100).toFixed(1)) : 0,
        conversionRate: leads > 0 ? Number(((payingCustomers / leads) * 100).toFixed(1)) : 0,
        ctr: adData.impressions > 0 ? Number(((adData.clicks / adData.impressions) * 100).toFixed(2)) : 0,
      }
    })
    .sort((a, b) => b.leads - a.leads) // 리드 많은 순
    .slice(0, 20) // 상위 20개

  return apiSuccess(result)
})


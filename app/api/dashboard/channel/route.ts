import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, applyDateRange, apiSuccess } from '@/lib/api-middleware'
import { normalizeChannel } from '@/lib/channel'
import { sourceToChannel, getSourceLabel } from '@/lib/platform'
import { getKstDateString } from '@/lib/date'

/**
 * 채널별 KPI 분석 API
 * utm_source 원본 기준 세분화 집계 (google_search, meta_feed 등)
 * 광고 지출은 platform(meta_ads) 기준 → sourceToChannel로 채널 매칭
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

  const ctx = { clinicId, assignedClinicIds }

  // DATE 컬럼(stat_date, payment_date)용 KST 날짜 문자열 변환
  const statStart = startDate ? getKstDateString(new Date(startDate)) : null
  const statEnd = endDate ? getKstDateString(new Date(endDate)) : null

  // 1. 리드 데이터 조회 (utm_source 포함)
  let leadsQuery = supabase
    .from('leads')
    .select('id, customer_id, utm_source, created_at')
    .limit(5000)
  leadsQuery = applyClinicFilter(leadsQuery, ctx)!
  leadsQuery = applyDateRange(leadsQuery, 'created_at', startDate, endDate)

  // 2. 광고 지출 데이터 — stat_date(DATE 컬럼)는 KST 날짜 문자열로 비교
  let adStatsQuery = supabase
    .from('ad_campaign_stats')
    .select('platform, spend_amount, clicks, impressions, stat_date')
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

  const [leadsRes, adStatsRes, paymentsRes] = await Promise.all([
    leadsQuery,
    adStatsQuery,
    paymentsQuery,
  ])

  // 채널별 리드 집계 — source 원본 기준 세분화
  const leadsBySource: Record<string, Set<number>> = {}
  const customerToSource: Map<number, string> = new Map()

  for (const lead of leadsRes.data || []) {
    const rawSource = lead.utm_source || 'Unknown'
    // getSourceLabel로 매칭되면 세분화 source, 아니면 normalizeChannel로 폴백
    const source = getSourceLabel(rawSource) !== rawSource ? rawSource : normalizeChannel(rawSource)

    if (!leadsBySource[source]) {
      leadsBySource[source] = new Set()
    }
    leadsBySource[source].add(lead.id)

    if (!customerToSource.has(lead.customer_id)) {
      customerToSource.set(lead.customer_id, source)
    }
  }

  // 광고 지출/클릭/노출 — 플랫폼 레벨 집계 (ad_campaign_stats.platform 기준)
  const spendByPlatform: Record<string, number> = {}
  const clicksByPlatform: Record<string, number> = {}
  const impressionsByPlatform: Record<string, number> = {}
  for (const row of adStatsRes.data || []) {
    const platform = sourceToChannel(row.platform) // meta_ads → Meta
    spendByPlatform[platform] = (spendByPlatform[platform] || 0) + Number(row.spend_amount)
    clicksByPlatform[platform] = (clicksByPlatform[platform] || 0) + Number(row.clicks || 0)
    impressionsByPlatform[platform] = (impressionsByPlatform[platform] || 0) + Number(row.impressions || 0)
  }

  // 채널별 매출 집계
  const revenueBySource: Record<string, number> = {}
  const payingCustomersBySource: Record<string, Set<number>> = {}

  for (const payment of paymentsRes.data || []) {
    const source = customerToSource.get(payment.customer_id) || 'Unknown'
    revenueBySource[source] = (revenueBySource[source] || 0) + Number(payment.payment_amount)

    if (!payingCustomersBySource[source]) {
      payingCustomersBySource[source] = new Set()
    }
    payingCustomersBySource[source].add(payment.customer_id)
  }

  // 리드 기준 source 목록만 사용 (광고비만 있고 리드 0건인 플랫폼 행은 제외)
  const allSources = Object.keys(leadsBySource)

  // 세분화 source별 광고비 배분: 같은 플랫폼 내 리드 비율로 안분
  // 예: Google 광고비 100만, google_search 리드 8건, google_gdn 리드 2건 → 80만 / 20만
  const spendBySource: Record<string, number> = {}
  const clicksBySource: Record<string, number> = {}
  const impressionsBySource: Record<string, number> = {}

  // 플랫폼별 세분화 source 그룹핑
  const sourcesByPlatform: Record<string, string[]> = {}
  for (const source of allSources) {
    const platform = sourceToChannel(source)
    if (!sourcesByPlatform[platform]) sourcesByPlatform[platform] = []
    sourcesByPlatform[platform].push(source)
  }

  for (const [platform, sources] of Object.entries(sourcesByPlatform)) {
    const totalPlatformSpend = spendByPlatform[platform] || 0
    const totalPlatformClicks = clicksByPlatform[platform] || 0
    const totalPlatformImpressions = impressionsByPlatform[platform] || 0
    const totalLeads = sources.reduce((sum, s) => sum + (leadsBySource[s]?.size || 0), 0)

    for (const source of sources) {
      const sourceLeads = leadsBySource[source]?.size || 0
      const ratio = totalLeads > 0 ? sourceLeads / totalLeads : 0
      spendBySource[source] = Math.round(totalPlatformSpend * ratio)
      clicksBySource[source] = Math.round(totalPlatformClicks * ratio)
      impressionsBySource[source] = Math.round(totalPlatformImpressions * ratio)
    }
  }

  // 결과 생성
  const result = allSources
    .filter(source => source !== 'Unknown' || leadsBySource[source]?.size > 0)
    .map(source => {
      const leads = leadsBySource[source]?.size || 0
      const spend = spendBySource[source] || 0
      const revenue = revenueBySource[source] || 0
      const payingCustomers = payingCustomersBySource[source]?.size || 0
      const clicks = clicksBySource[source] || 0
      const impressions = impressionsBySource[source] || 0

      return {
        channel: source,
        leads,
        spend,
        revenue,
        payingCustomers,
        clicks,
        impressions,
        cpl: leads > 0 ? Math.round(spend / leads) : 0,
        roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : 0,
        ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
        conversionRate: leads > 0 ? Number(((payingCustomers / leads) * 100).toFixed(1)) : 0,
      }
    })
    .sort((a, b) => b.leads - a.leads)

  return apiSuccess(result)
})


import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { normalizeChannel } from '@/lib/channel'
import { sourceToChannel } from '@/lib/platform'
import { getKstDateString } from '@/lib/date'
import { createLogger } from '@/lib/logger'
import { fetchAdMarkups, buildMarkupStatRows } from '@/lib/ad-markup'
import { fetchAllRowsResult } from '@/lib/supabase-paginate'

const logger = createLogger('DashboardChannel')

/**
 * 채널별 KPI 분석 API
 * utm_source 원본 기준 세분화 집계 (google_search, meta_feed 등)
 * 광고 지출은 platform(meta_ads) 기준 → sourceToChannel로 채널 매칭
 */
export const GET = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  if (user.role === 'demo_viewer') {
    const { demoChannel } = await import('@/lib/demo/fixtures/aggregates')
    const url = new URL(req.url)
    return apiSuccess(demoChannel(clinicId, url.searchParams.get('startDate'), url.searchParams.get('endDate')))
  }

  const supabase = serverSupabase()
  const url = new URL(req.url)
  const startParam = url.searchParams.get('startDate')
  const endParam = url.searchParams.get('endDate')
  // agency_staff 배정 병원 0개 → 빈 결과
  if (assignedClinicIds !== null && assignedClinicIds.length === 0) {
    return apiSuccess([])
  }

  const ctx = { clinicId, assignedClinicIds }

  // KPI와 동일한 날짜 범위 변환: ISO → KST 기준 [start, end) 패턴
  const startKst = startParam ? getKstDateString(new Date(startParam)) : null
  const endKst = endParam ? getKstDateString(new Date(endParam)) : null
  // timestamp 컬럼(created_at)용: KST 자정 기준 [start, end)
  const tsStart = startKst ? `${startKst}T00:00:00+09:00` : null
  let tsEnd: string | null = null
  if (endKst) {
    const endDate = new Date(endKst + 'T00:00:00+09:00')
    endDate.setDate(endDate.getDate() + 1)
    tsEnd = endDate.toISOString()
  }

  // 1~3. 리드·광고지출·결제 — 합계/집합 집계이므로 PostgREST 1,000행 상한을 id 페이지네이션으로 우회
  //       (기존 .limit(5000)/무제한은 고volume 병원·기간에서 과소집계). {data,error} 형태 유지 → 아래 에러 표면화 패턴 그대로.
  const [leadsRes, adStatsRes, paymentsRes] = await Promise.all([
    fetchAllRowsResult<{ id: number; customer_id: number; utm_source: string | null; created_at: string }>((from, to) => {
      let q = applyClinicFilter(supabase.from('leads').select('id, customer_id, utm_source, created_at'), ctx)!
      if (tsStart) q = q.gte('created_at', tsStart)
      if (tsEnd) q = q.lt('created_at', tsEnd)
      return q.order('id').range(from, to)
    }),
    fetchAllRowsResult<{ platform: string; spend_amount: number; clicks: number; impressions: number; stat_date: string }>((from, to) => {
      let q = applyClinicFilter(supabase.from('ad_campaign_stats').select('platform, spend_amount, clicks, impressions, stat_date'), ctx)!
      if (startKst) q = q.gte('stat_date', startKst)
      if (endKst) q = q.lte('stat_date', endKst)
      return q.order('id').range(from, to)
    }),
    fetchAllRowsResult<{ payment_amount: number; customer_id: number; payment_date: string }>((from, to) => {
      let q = applyClinicFilter(supabase.from('payments').select('payment_amount, customer_id, payment_date'), ctx)!
      if (startKst) q = q.gte('payment_date', startKst)
      if (endKst) q = q.lte('payment_date', endKst)
      return q.order('id').range(from, to)
    }),
  ])

  // 조회 실패를 빈 성공(0)으로 위장하지 않고 에러로 표면화
  if (leadsRes.error || adStatsRes.error || paymentsRes.error) {
    logger.error('채널 성과 조회 실패', leadsRes.error || adStatsRes.error || paymentsRes.error, { clinicId })
    return apiError('채널 성과 조회에 실패했습니다.', 500)
  }

  // 채널별 리드 집계 — 플랫폼 단위 통합 (Meta, Google 등)
  const leadsByChannel: Record<string, Set<number>> = {}
  const customerToChannel: Map<number, string> = new Map()

  for (const lead of leadsRes.data || []) {
    const channel = normalizeChannel(lead.utm_source)

    if (!leadsByChannel[channel]) {
      leadsByChannel[channel] = new Set()
    }
    leadsByChannel[channel].add(lead.id)

    if (!customerToChannel.has(lead.customer_id)) {
      customerToChannel.set(lead.customer_id, channel)
    }
  }

  // 광고 지출/클릭/노출 — 플랫폼 레벨 집계 (ad_campaign_stats.platform 기준)
  const spendByChannel: Record<string, number> = {}
  const clicksByChannel: Record<string, number> = {}
  const impressionsByChannel: Record<string, number> = {}
  for (const row of adStatsRes.data || []) {
    const channel = sourceToChannel(row.platform) // meta_ads → Meta
    spendByChannel[channel] = (spendByChannel[channel] || 0) + Number(row.spend_amount)
    clicksByChannel[channel] = (clicksByChannel[channel] || 0) + Number(row.clicks || 0)
    impressionsByChannel[channel] = (impressionsByChannel[channel] || 0) + Number(row.impressions || 0)
  }

  // 광고비 마크업(관리 수수료 등) 채널 가산 — DB 원본은 그대로, 조회 시점에만 합산
  const markups = await fetchAdMarkups(supabase, ctx)
  for (const row of buildMarkupStatRows(markups, startKst, endKst)) {
    if (!row.platform) continue // 채널 귀속 불가(클리닉 총액 마크업)는 채널 분해에서 제외
    const channel = sourceToChannel(row.platform)
    spendByChannel[channel] = (spendByChannel[channel] || 0) + row.spend_amount
  }

  // 채널별 매출 집계
  const revenueByChannel: Record<string, number> = {}
  const payingCustomersByChannel: Record<string, Set<number>> = {}

  for (const payment of paymentsRes.data || []) {
    const channel = customerToChannel.get(payment.customer_id) || 'Unknown'
    revenueByChannel[channel] = (revenueByChannel[channel] || 0) + Number(payment.payment_amount)

    if (!payingCustomersByChannel[channel]) {
      payingCustomersByChannel[channel] = new Set()
    }
    payingCustomersByChannel[channel].add(payment.customer_id)
  }

  // 결과 생성 — 플랫폼 단위로 광고비 직접 매칭 (안분 불필요)
  const allChannels = Object.keys(leadsByChannel)

  const result = allChannels
    .filter(ch => ch !== 'Unknown' || leadsByChannel[ch]?.size > 0)
    .map(ch => {
      const leads = leadsByChannel[ch]?.size || 0
      const spend = spendByChannel[ch] || 0
      const revenue = revenueByChannel[ch] || 0
      const payingCustomers = payingCustomersByChannel[ch]?.size || 0
      const clicks = clicksByChannel[ch] || 0
      const impressions = impressionsByChannel[ch] || 0

      return {
        channel: ch,
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


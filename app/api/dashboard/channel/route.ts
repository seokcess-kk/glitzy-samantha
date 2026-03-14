import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext } from '@/lib/api-middleware'

/**
 * 채널별 KPI 분석 API
 * Phase 2: leads.utm_source 기반 정확한 채널 집계
 */
export const GET = withClinicFilter(async (req: Request, { clinicId }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')

  const applyFilter = <T>(q: T): T => clinicId ? (q as any).eq('clinic_id', clinicId) : q
  const applyDateFilter = <T>(q: T, dateField: string): T => {
    let query = q
    if (startDate) query = (query as any).gte(dateField, startDate)
    if (endDate) query = (query as any).lte(dateField, endDate)
    return query
  }

  // 1. 리드 데이터 조회 (utm_source 포함)
  let leadsQuery = supabase
    .from('leads')
    .select('id, customer_id, utm_source, created_at')
  leadsQuery = applyFilter(leadsQuery)
  leadsQuery = applyDateFilter(leadsQuery, 'created_at')

  // 2. 광고 지출 데이터
  let adStatsQuery = supabase
    .from('ad_campaign_stats')
    .select('platform, spend_amount, stat_date')
  adStatsQuery = applyFilter(adStatsQuery)
  adStatsQuery = applyDateFilter(adStatsQuery, 'stat_date')

  // 3. 결제 데이터 (customer_id로 리드와 연결)
  let paymentsQuery = supabase
    .from('payments')
    .select('payment_amount, customer_id, payment_date')
  paymentsQuery = applyFilter(paymentsQuery)
  paymentsQuery = applyDateFilter(paymentsQuery, 'payment_date')

  const [leadsRes, adStatsRes, paymentsRes] = await Promise.all([
    leadsQuery,
    adStatsQuery,
    paymentsQuery,
  ])

  // 채널별 리드 집계
  const leadsByChannel: Record<string, Set<number>> = {}
  const customerToChannel: Map<number, string> = new Map()

  for (const lead of leadsRes.data || []) {
    // utm_source 정규화
    let channel = normalizeChannel(lead.utm_source)

    if (!leadsByChannel[channel]) {
      leadsByChannel[channel] = new Set()
    }
    leadsByChannel[channel].add(lead.id)

    // 고객의 첫 번째 채널만 기록 (이미 있으면 덮어쓰지 않음)
    if (!customerToChannel.has(lead.customer_id)) {
      customerToChannel.set(lead.customer_id, channel)
    }
  }

  // 광고 지출 집계 (platform 기준)
  const spendByChannel: Record<string, number> = {}
  for (const row of adStatsRes.data || []) {
    const channel = normalizeChannel(row.platform)
    spendByChannel[channel] = (spendByChannel[channel] || 0) + Number(row.spend_amount)
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

  // 모든 채널 목록 (광고 채널 + 리드 채널)
  const allChannels = new Set([
    ...Object.keys(leadsByChannel),
    ...Object.keys(spendByChannel),
  ])

  // 결과 생성
  const result = Array.from(allChannels)
    .filter(channel => channel !== 'Unknown' || leadsByChannel[channel]?.size > 0)
    .map(channel => {
      const leads = leadsByChannel[channel]?.size || 0
      const spend = spendByChannel[channel] || 0
      const revenue = revenueByChannel[channel] || 0
      const payingCustomers = payingCustomersByChannel[channel]?.size || 0

      return {
        channel,
        leads,
        spend,
        revenue,
        payingCustomers,
        cpl: leads > 0 ? Math.round(spend / leads) : 0,
        roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : 0,
        conversionRate: leads > 0 ? Number(((payingCustomers / leads) * 100).toFixed(1)) : 0,
      }
    })
    .sort((a, b) => b.leads - a.leads) // 리드 많은 순 정렬

  return NextResponse.json(result)
})

/**
 * 채널명 정규화
 */
function normalizeChannel(source: string | null | undefined): string {
  if (!source) return 'Unknown'

  const normalized = source.toLowerCase().trim()

  const channelMap: Record<string, string> = {
    'meta': 'Meta',
    'facebook': 'Meta',
    'fb': 'Meta',
    'instagram': 'Instagram',
    'ig': 'Instagram',
    'google': 'Google',
    'gdn': 'Google',
    'youtube': 'YouTube',
    'yt': 'YouTube',
    'tiktok': 'TikTok',
    'naver': 'Naver',
    'kakao': 'Kakao',
    'phone': 'Phone',
    'direct': 'Direct',
    'organic': 'Organic',
  }

  return channelMap[normalized] || source
}

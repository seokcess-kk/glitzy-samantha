import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, apiError, apiSuccess } from '@/lib/api-middleware'
import { normalizeChannel } from '@/lib/channel'
import { applyAttributionModel, AttributionModel, TouchPoint } from '@/lib/attribution-models'
import { getKstDateString } from '@/lib/date'
import { fetchAdMarkups, buildMarkupStatRows } from '@/lib/ad-markup'
import { createLogger } from '@/lib/logger'
import { fetchAllRowsResult } from '@/lib/supabase-paginate'

const logger = createLogger('AttributionSummary')

/**
 * 매출 귀속 요약 API
 * model=first: 퍼스트터치 (customers.first_source 기반, 기존 로직)
 * model=linear: 균등 배분 (모든 터치포인트에 동일 가중치)
 * model=time-decay: 시간 가중 (최근 터치에 높은 가중치)
 */
export const GET = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  if (user.role === 'demo_viewer') {
    const { demoAttributionSummary } = await import('@/lib/demo/fixtures/extras')
    const url = new URL(req.url)
    return apiSuccess(demoAttributionSummary(clinicId, url.searchParams.get('startDate'), url.searchParams.get('endDate')))
  }

  const supabase = serverSupabase()
  const url = new URL(req.url)
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')
  const model = (url.searchParams.get('model') || 'first') as AttributionModel

  if (assignedClinicIds !== null && assignedClinicIds.length === 0) {
    return apiSuccess({ byChannel: [], byCampaign: [], totals: { totalSpend: 0, totalRevenue: 0, totalCustomers: 0 } })
  }

  const applyFilter = <T>(q: T): T => {
    if (clinicId) return (q as unknown as { eq: (col: string, val: number) => T }).eq('clinic_id', clinicId)
    if (assignedClinicIds !== null && assignedClinicIds.length > 0) return (q as unknown as { in: (col: string, val: number[]) => T }).in('clinic_id', assignedClinicIds)
    return q
  }
  const applyDateFilter = <T>(q: T, dateField: string): T => {
    let query = q
    if (startDate) query = (query as unknown as { gte: (col: string, val: string) => T }).gte(dateField, startDate)
    if (endDate) query = (query as unknown as { lte: (col: string, val: string) => T }).lte(dateField, endDate)
    return query
  }

  // 병렬 쿼리: 결제(+고객), 리드, 광고비 — 합계/집합 집계이므로 1,000행 상한을 id 페이지네이션으로 우회
  const [paymentsRes, leadsRes, adStatsRes] = await Promise.all([
    fetchAllRowsResult<{ payment_amount: number; customer_id: number; payment_date: string; treatment_name: string | null; customers: { id: number; first_source: string | null; first_campaign_id: string | null; name: string | null; phone_number: string | null }[] }>((from, to) => {
      let q = supabase.from('payments').select('payment_amount, customer_id, payment_date, treatment_name, customers(id, first_source, first_campaign_id, name, phone_number)')
      q = applyFilter(q)
      q = applyDateFilter(q, 'payment_date')
      return q.order('id').range(from, to)
    }),
    fetchAllRowsResult<{ id: number; customer_id: number; utm_source: string | null; utm_campaign: string | null; created_at: string }>((from, to) => {
      let q = supabase.from('leads').select('id, customer_id, utm_source, utm_campaign, created_at')
      q = applyFilter(q)
      q = applyDateFilter(q, 'created_at')
      return q.order('id').range(from, to)
    }),
    fetchAllRowsResult<{ platform: string | null; campaign_id: string | null; campaign_name: string | null; spend_amount: number; stat_date: string }>((from, to) => {
      let q = supabase.from('ad_campaign_stats').select('platform, campaign_id, campaign_name, spend_amount, stat_date')
      q = applyFilter(q)
      q = applyDateFilter(q, 'stat_date')
      return q.order('id').range(from, to)
    }),
  ])

  if (paymentsRes.error || leadsRes.error || adStatsRes.error) {
    logger.error('귀속 요약 조회 실패', paymentsRes.error || leadsRes.error || adStatsRes.error, { clinicId })
    return apiError('귀속 요약 조회에 실패했습니다.', 500)
  }

  // --- 채널별 귀속 ---
  const channelMap: Record<string, { leads: Set<number>; revenue: number; customers: Set<number> }> = {}
  const campaignMap: Record<string, { channel: string; leads: Set<number>; revenue: number; customers: Set<number> }> = {}

  // 리드 카운트 (채널별, 캠페인별) — 모든 모델 공통
  for (const lead of leadsRes.data || []) {
    const ch = normalizeChannel(lead.utm_source)
    if (!channelMap[ch]) channelMap[ch] = { leads: new Set(), revenue: 0, customers: new Set() }
    channelMap[ch].leads.add(lead.id)

    const camp = lead.utm_campaign
    if (camp) {
      if (!campaignMap[camp]) campaignMap[camp] = { channel: ch, leads: new Set(), revenue: 0, customers: new Set() }
      campaignMap[camp].leads.add(lead.id)
    }
  }

  let totalRevenue = 0
  const allPayingCustomers = new Set<number>()

  if (model === 'first') {
    // --- 퍼스트터치 (기존 로직 유지) ---
    for (const p of paymentsRes.data || []) {
      const customer = p.customers as unknown as Record<string, unknown> | null
      if (!customer) continue

      const ch = normalizeChannel(customer.first_source as string | null)
      const camp = (customer.first_campaign_id as string | null) || null
      const amount = Number(p.payment_amount) || 0
      totalRevenue += amount
      allPayingCustomers.add(customer.id as number)

      if (!channelMap[ch]) channelMap[ch] = { leads: new Set(), revenue: 0, customers: new Set() }
      channelMap[ch].revenue += amount
      channelMap[ch].customers.add(customer.id as number)

      if (camp) {
        if (!campaignMap[camp]) campaignMap[camp] = { channel: ch, leads: new Set(), revenue: 0, customers: new Set() }
        campaignMap[camp].revenue += amount
        campaignMap[camp].customers.add(customer.id as number)
      }
    }
  } else {
    // --- 멀티터치 어트리뷰션 (linear / time-decay) ---
    // 1. 결제 고객별 매출 합산
    const customerRevenue = new Map<number, number>()
    const customerIdSet = new Set<number>()
    for (const p of paymentsRes.data || []) {
      const customer = p.customers as unknown as Record<string, unknown> | null
      if (!customer) continue
      const cid = customer.id as number
      const amount = Number(p.payment_amount) || 0
      totalRevenue += amount
      allPayingCustomers.add(cid)
      customerRevenue.set(cid, (customerRevenue.get(cid) || 0) + amount)
      customerIdSet.add(cid)
    }

    if (customerIdSet.size > 0) {
      // 2. 결제 고객의 모든 leads 조회 (한 번에, N+1 방지)
      const customerIds = Array.from(customerIdSet)
      const { data: allLeads, error: leadsError } = await fetchAllRowsResult<{ customer_id: number; utm_source: string | null; utm_campaign: string | null; created_at: string }>((from, to) => {
        let q = supabase.from('leads').select('customer_id, utm_source, utm_campaign, created_at').in('customer_id', customerIds)
        q = applyFilter(q)
        return q.order('id').range(from, to)
      })
      if (leadsError) {
        logger.error('멀티터치 리드 조회 실패', leadsError, { clinicId })
      }

      // 3. customer_id별 터치포인트 그룹핑
      const touchpointsByCustomer = new Map<number, TouchPoint[]>()
      for (const lead of allLeads || []) {
        const cid = lead.customer_id as number
        if (!touchpointsByCustomer.has(cid)) touchpointsByCustomer.set(cid, [])
        touchpointsByCustomer.get(cid)!.push({
          channel: normalizeChannel(lead.utm_source),
          campaign: lead.utm_campaign || null,
          date: lead.created_at,
        })
      }

      // 4. 각 고객의 매출을 가중치에 따라 분배
      for (const cid of customerIds) {
        const revenue = customerRevenue.get(cid) || 0
        const touchpoints = touchpointsByCustomer.get(cid) || []

        if (touchpoints.length === 0) {
          // 터치포인트가 없으면 Unknown에 귀속
          const ch = 'Unknown'
          if (!channelMap[ch]) channelMap[ch] = { leads: new Set(), revenue: 0, customers: new Set() }
          channelMap[ch].revenue += revenue
          channelMap[ch].customers.add(cid)
          continue
        }

        const weights = applyAttributionModel(model, touchpoints)

        for (const w of weights) {
          // 채널 귀속
          if (!channelMap[w.channel]) channelMap[w.channel] = { leads: new Set(), revenue: 0, customers: new Set() }
          channelMap[w.channel].revenue += revenue * w.weight
          channelMap[w.channel].customers.add(cid)

          // 캠페인 귀속
          if (w.campaign) {
            if (!campaignMap[w.campaign]) campaignMap[w.campaign] = { channel: w.channel, leads: new Set(), revenue: 0, customers: new Set() }
            campaignMap[w.campaign].revenue += revenue * w.weight
            campaignMap[w.campaign].customers.add(cid)
          }
        }
      }
    }
  }

  // 광고비 집계
  const spendByChannel: Record<string, number> = {}
  const spendByCampaign: Record<string, number> = {}
  let totalSpend = 0

  const realCampaignName = new Map<string, string>()
  for (const row of adStatsRes.data || []) {
    const ch = normalizeChannel(row.platform)
    const amount = Number(row.spend_amount) || 0
    spendByChannel[ch] = (spendByChannel[ch] || 0) + amount
    totalSpend += amount

    const campName = row.campaign_name
    if (campName) {
      spendByCampaign[campName] = (spendByCampaign[campName] || 0) + amount
    }
    if (row.campaign_id && row.campaign_name && !realCampaignName.has(row.campaign_id)) {
      realCampaignName.set(row.campaign_id, row.campaign_name)
    }
  }

  // 광고비 마크업(관리 수수료 등) 가산 — DB 원본은 그대로, 조회 시점에만 합산.
  // 매출 귀속 ROAS(메인 KPI와 동일 기준)·채널/캠페인 spend에 반영.
  const markups = await fetchAdMarkups(supabase, { clinicId, assignedClinicIds })
  const markupStart = startDate ? getKstDateString(new Date(startDate)) : null
  const markupEnd = endDate ? getKstDateString(new Date(endDate)) : null
  const markupRows = buildMarkupStatRows(markups, markupStart, markupEnd)
  for (const row of markupRows) {
    const ch = normalizeChannel(row.platform)
    spendByChannel[ch] = (spendByChannel[ch] || 0) + row.spend_amount
    totalSpend += row.spend_amount
    const campName = (row.campaign_id && realCampaignName.get(row.campaign_id)) || row.campaign_name
    if (campName) spendByCampaign[campName] = (spendByCampaign[campName] || 0) + row.spend_amount
  }

  // 채널 결과 조립
  const allChannels = new Set([...Object.keys(channelMap), ...Object.keys(spendByChannel)])
  const byChannel = Array.from(allChannels)
    .map(ch => {
      const data = channelMap[ch] || { leads: new Set(), revenue: 0, customers: new Set() }
      const spend = spendByChannel[ch] || 0
      const revenue = Math.round(data.revenue)
      const leads = data.leads.size
      const customers = data.customers.size
      return {
        channel: ch,
        leads,
        spend,
        revenue,
        customers,
        roi: spend > 0 ? Math.round(((revenue - spend) / spend) * 100) : revenue > 0 ? 100 : 0,
        roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : 0,
        cpl: leads > 0 ? Math.round(spend / leads) : 0,
      }
    })
    .filter(c => c.leads > 0 || c.revenue > 0 || c.spend > 0)
    .sort((a, b) => b.revenue - a.revenue)

  // 캠페인 결과 조립
  const byCampaign = Object.entries(campaignMap)
    .map(([campaign, data]) => {
      const spend = spendByCampaign[campaign] || 0
      const leads = data.leads.size
      const customers = data.customers.size
      const revenue = Math.round(data.revenue)
      return {
        campaign,
        channel: data.channel,
        leads,
        spend,
        revenue,
        customers,
        roi: spend > 0 ? Math.round(((revenue - spend) / spend) * 100) : revenue > 0 ? 100 : 0,
        roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : 0,
      }
    })
    .filter(c => c.leads > 0 || c.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)

  return apiSuccess({
    byChannel,
    byCampaign,
    totals: { totalSpend, totalRevenue: Math.round(totalRevenue), totalCustomers: allPayingCustomers.size },
    // 광고비에 마크업이 포함됐는지 — UI 고지(ⓘ "관리비 포함") 표시 여부
    spendIncludesMarkup: markupRows.length > 0,
  })
})

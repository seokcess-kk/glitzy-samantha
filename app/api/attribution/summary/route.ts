import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext } from '@/lib/api-middleware'
import { normalizeChannel } from '@/lib/channel'

/**
 * 매출 귀속 요약 API
 * 퍼스트터치 기준: customers.first_source / first_campaign_id로 매출 귀속
 */
export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')

  if (assignedClinicIds !== null && assignedClinicIds.length === 0) {
    return NextResponse.json({ byChannel: [], byCampaign: [], totals: { totalSpend: 0, totalRevenue: 0, totalCustomers: 0 } })
  }

  const applyFilter = <T>(q: T): T => {
    if (clinicId) return (q as any).eq('clinic_id', clinicId)
    if (assignedClinicIds !== null && assignedClinicIds.length > 0) return (q as any).in('clinic_id', assignedClinicIds)
    return q
  }
  const applyDateFilter = <T>(q: T, dateField: string): T => {
    let query = q
    if (startDate) query = (query as any).gte(dateField, startDate)
    if (endDate) query = (query as any).lte(dateField, endDate)
    return query
  }

  // 병렬 쿼리: 결제(+고객), 리드, 광고비
  let paymentsQ = supabase.from('payments').select('payment_amount, customer_id, payment_date, treatment_name, customers(id, first_source, first_campaign_id, name, phone_number)')
  paymentsQ = applyFilter(paymentsQ)
  paymentsQ = applyDateFilter(paymentsQ, 'payment_date')

  let leadsQ = supabase.from('leads').select('id, customer_id, utm_source, utm_campaign, created_at')
  leadsQ = applyFilter(leadsQ)
  leadsQ = applyDateFilter(leadsQ, 'created_at')

  let adStatsQ = supabase.from('ad_campaign_stats').select('platform, campaign_name, spend_amount, stat_date')
  adStatsQ = applyFilter(adStatsQ)
  adStatsQ = applyDateFilter(adStatsQ, 'stat_date')

  const [paymentsRes, leadsRes, adStatsRes] = await Promise.all([paymentsQ, leadsQ, adStatsQ])

  // --- 채널별 귀속 ---
  const channelMap: Record<string, { leads: Set<number>; revenue: number; customers: Set<number> }> = {}
  const campaignMap: Record<string, { channel: string; leads: Set<number>; revenue: number; customers: Set<number> }> = {}

  // 리드 카운트 (채널별, 캠페인별)
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

  // 결제 귀속 (퍼스트터치: customers.first_source)
  let totalRevenue = 0
  const allPayingCustomers = new Set<number>()

  for (const p of paymentsRes.data || []) {
    const customer = p.customers as any
    if (!customer) continue

    const ch = normalizeChannel(customer.first_source)
    const camp = customer.first_campaign_id || null
    const amount = Number(p.payment_amount) || 0
    totalRevenue += amount
    allPayingCustomers.add(customer.id)

    // 채널 귀속
    if (!channelMap[ch]) channelMap[ch] = { leads: new Set(), revenue: 0, customers: new Set() }
    channelMap[ch].revenue += amount
    channelMap[ch].customers.add(customer.id)

    // 캠페인 귀속
    if (camp) {
      if (!campaignMap[camp]) campaignMap[camp] = { channel: ch, leads: new Set(), revenue: 0, customers: new Set() }
      campaignMap[camp].revenue += amount
      campaignMap[camp].customers.add(customer.id)
    }
  }

  // 광고비 집계
  const spendByChannel: Record<string, number> = {}
  const spendByCampaign: Record<string, number> = {}
  let totalSpend = 0

  for (const row of adStatsRes.data || []) {
    const ch = normalizeChannel(row.platform)
    const amount = Number(row.spend_amount) || 0
    spendByChannel[ch] = (spendByChannel[ch] || 0) + amount
    totalSpend += amount

    const campName = row.campaign_name
    if (campName) {
      spendByCampaign[campName] = (spendByCampaign[campName] || 0) + amount
    }
  }

  // 채널 결과 조립
  const allChannels = new Set([...Object.keys(channelMap), ...Object.keys(spendByChannel)])
  const byChannel = Array.from(allChannels)
    .map(ch => {
      const data = channelMap[ch] || { leads: new Set(), revenue: 0, customers: new Set() }
      const spend = spendByChannel[ch] || 0
      const revenue = data.revenue
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
      return {
        campaign,
        channel: data.channel,
        leads,
        spend,
        revenue: data.revenue,
        customers,
        roi: spend > 0 ? Math.round(((data.revenue - spend) / spend) * 100) : data.revenue > 0 ? 100 : 0,
        roas: spend > 0 ? Number((data.revenue / spend).toFixed(2)) : 0,
      }
    })
    .filter(c => c.leads > 0 || c.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)

  return NextResponse.json({
    byChannel,
    byCampaign,
    totals: { totalSpend, totalRevenue, totalCustomers: allPayingCustomers.size },
  })
})


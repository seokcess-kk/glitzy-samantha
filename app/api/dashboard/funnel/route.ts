import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext } from '@/lib/api-middleware'


/**
 * 퍼널 분석 API
 * Phase 2: Lead → Booking → Visit → Payment 전환율 분석
 */
export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')
  const groupBy = url.searchParams.get('groupBy') || 'total' // total | channel | campaign

  // agency_staff 배정 병원 0개 → 빈 결과
  if (assignedClinicIds !== null && assignedClinicIds.length === 0) {
    return NextResponse.json({ type: 'total', funnel: { stages: [], totalConversionRate: 0, summary: { leads: 0, payments: 0 } } })
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

  // 데이터 조회
  let leadsQuery = supabase
    .from('leads')
    .select('id, customer_id, utm_source, utm_campaign, created_at')
  leadsQuery = applyFilter(leadsQuery)
  leadsQuery = applyDateFilter(leadsQuery, 'created_at')

  let bookingsQuery = supabase
    .from('bookings')
    .select('id, customer_id, status, created_at')
  bookingsQuery = applyFilter(bookingsQuery)
  bookingsQuery = applyDateFilter(bookingsQuery, 'created_at')

  let consultationsQuery = supabase
    .from('consultations')
    .select('id, customer_id, status, created_at')
  consultationsQuery = applyFilter(consultationsQuery)
  consultationsQuery = applyDateFilter(consultationsQuery, 'created_at')

  let paymentsQuery = supabase
    .from('payments')
    .select('id, customer_id, payment_amount, payment_date')
  paymentsQuery = applyFilter(paymentsQuery)
  paymentsQuery = applyDateFilter(paymentsQuery, 'payment_date')

  const [leadsRes, bookingsRes, consultationsRes, paymentsRes] = await Promise.all([
    leadsQuery,
    bookingsQuery,
    consultationsQuery,
    paymentsQuery,
  ])

  // 고객별 채널/캠페인 매핑
  const customerChannel: Map<number, string> = new Map()
  const customerCampaign: Map<number, string> = new Map()

  for (const lead of leadsRes.data || []) {
    if (!customerChannel.has(lead.customer_id)) {
      customerChannel.set(lead.customer_id, normalizeChannel(lead.utm_source))
    }
    if (!customerCampaign.has(lead.customer_id) && lead.utm_campaign) {
      customerCampaign.set(lead.customer_id, lead.utm_campaign)
    }
  }

  // 단계별 고객 집합
  const leadCustomers = new Set((leadsRes.data || []).map(l => l.customer_id))
  const bookedCustomers = new Set(
    (bookingsRes.data || [])
      .filter(b => b.status !== 'cancelled')
      .map(b => b.customer_id)
  )
  const visitedCustomers = new Set(
    (bookingsRes.data || [])
      .filter(b => ['visited', 'treatment_confirmed'].includes(b.status))
      .map(b => b.customer_id)
  )
  const consultedCustomers = new Set(
    (consultationsRes.data || [])
      .filter(c => ['방문완료', '상담중', '시술확정'].includes(c.status))
      .map(c => c.customer_id)
  )
  const paidCustomers = new Set((paymentsRes.data || []).map(p => p.customer_id))

  // 전체 퍼널 또는 그룹별 퍼널
  if (groupBy === 'total') {
    const funnel = buildFunnel(
      leadCustomers,
      bookedCustomers,
      visitedCustomers,
      consultedCustomers,
      paidCustomers
    )
    return NextResponse.json({ type: 'total', funnel })
  }

  // 채널별 또는 캠페인별 그룹
  const groups: Record<string, {
    leads: Set<number>
    booked: Set<number>
    visited: Set<number>
    consulted: Set<number>
    paid: Set<number>
  }> = {}

  const getGroupKey = (customerId: number): string => {
    if (groupBy === 'channel') {
      return customerChannel.get(customerId) || 'Unknown'
    } else if (groupBy === 'campaign') {
      return customerCampaign.get(customerId) || 'Unknown'
    }
    return 'Unknown'
  }

  // 리드 기준으로 그룹 초기화
  for (const lead of leadsRes.data || []) {
    const key = getGroupKey(lead.customer_id)
    if (!groups[key]) {
      groups[key] = {
        leads: new Set(),
        booked: new Set(),
        visited: new Set(),
        consulted: new Set(),
        paid: new Set(),
      }
    }
    groups[key].leads.add(lead.customer_id)
  }

  // 각 단계 고객을 그룹에 배분
  for (const customerId of bookedCustomers) {
    const key = getGroupKey(customerId)
    if (groups[key]) groups[key].booked.add(customerId)
  }
  for (const customerId of visitedCustomers) {
    const key = getGroupKey(customerId)
    if (groups[key]) groups[key].visited.add(customerId)
  }
  for (const customerId of consultedCustomers) {
    const key = getGroupKey(customerId)
    if (groups[key]) groups[key].consulted.add(customerId)
  }
  for (const customerId of paidCustomers) {
    const key = getGroupKey(customerId)
    if (groups[key]) groups[key].paid.add(customerId)
  }

  // 결과 생성
  const result = Object.entries(groups)
    .filter(([key]) => key !== 'Unknown' || groups[key].leads.size > 0)
    .map(([key, g]) => ({
      group: key,
      funnel: buildFunnel(g.leads, g.booked, g.visited, g.consulted, g.paid),
    }))
    .sort((a, b) => b.funnel.stages[0].count - a.funnel.stages[0].count)

  return NextResponse.json({ type: groupBy, funnels: result })
})

/**
 * 퍼널 데이터 생성
 */
function buildFunnel(
  leads: Set<number>,
  booked: Set<number>,
  visited: Set<number>,
  consulted: Set<number>,
  paid: Set<number>
) {
  const leadCount = leads.size
  const bookedCount = booked.size
  const visitedCount = visited.size
  const consultedCount = consulted.size
  const paidCount = paid.size

  const stages = [
    {
      stage: 'Lead',
      label: '리드',
      count: leadCount,
      rate: 100,
      dropoff: 0,
    },
    {
      stage: 'Booking',
      label: '예약',
      count: bookedCount,
      rate: leadCount > 0 ? Number(((bookedCount / leadCount) * 100).toFixed(1)) : 0,
      dropoff: leadCount > 0 ? Number((((leadCount - bookedCount) / leadCount) * 100).toFixed(1)) : 0,
    },
    {
      stage: 'Visit',
      label: '방문',
      count: visitedCount,
      rate: leadCount > 0 ? Number(((visitedCount / leadCount) * 100).toFixed(1)) : 0,
      dropoff: bookedCount > 0 ? Number((((bookedCount - visitedCount) / bookedCount) * 100).toFixed(1)) : 0,
    },
    {
      stage: 'Consultation',
      label: '상담',
      count: consultedCount,
      rate: leadCount > 0 ? Number(((consultedCount / leadCount) * 100).toFixed(1)) : 0,
      dropoff: visitedCount > 0 ? Number((((visitedCount - consultedCount) / visitedCount) * 100).toFixed(1)) : 0,
    },
    {
      stage: 'Payment',
      label: '결제',
      count: paidCount,
      rate: leadCount > 0 ? Number(((paidCount / leadCount) * 100).toFixed(1)) : 0,
      dropoff: consultedCount > 0 ? Number((((consultedCount - paidCount) / consultedCount) * 100).toFixed(1)) : 0,
    },
  ]

  return {
    stages,
    totalConversionRate: leadCount > 0 ? Number(((paidCount / leadCount) * 100).toFixed(1)) : 0,
    summary: {
      leads: leadCount,
      payments: paidCount,
    },
  }
}

function normalizeChannel(source: string | null | undefined): string {
  if (!source) return 'Unknown'
  const normalized = source.toLowerCase().trim()
  const channelMap: Record<string, string> = {
    'meta': 'Meta', 'facebook': 'Meta', 'google': 'Google',
    'youtube': 'YouTube', 'tiktok': 'TikTok', 'naver': 'Naver',
    'kakao': 'Kakao', 'instagram': 'Instagram', 'phone': 'Phone',
  }
  return channelMap[normalized] || source
}

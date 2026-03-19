import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { createLogger } from '@/lib/logger'
import { normalizeChannel } from '@/lib/channel'

const logger = createLogger('CreativesPerformance')

/**
 * 소재별 성과 분석 API
 * utm_content 기반으로 리드/결제/매출을 소재별로 집계
 */
export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')

  if (assignedClinicIds !== null && assignedClinicIds.length === 0) {
    return apiSuccess({ creatives: [], unmatched: { leads: 0, note: 'utm_content 미매칭 리드' } })
  }

  try {
    // 1) leads 테이블에서 utm_content가 있는 리드 조회
    let leadsQuery = supabase
      .from('leads')
      .select('id, customer_id, utm_content, created_at')
      .not('utm_content', 'is', null)

    const filteredLeads = applyClinicFilter(leadsQuery, { clinicId, assignedClinicIds })
    if (!filteredLeads) return apiSuccess({ creatives: [], unmatched: { leads: 0, note: 'utm_content 미매칭 리드' } })
    leadsQuery = filteredLeads

    if (startDate) leadsQuery = leadsQuery.gte('created_at', startDate)
    if (endDate) leadsQuery = leadsQuery.lte('created_at', endDate)

    // 2) ad_creatives 테이블에서 소재 메타데이터 조회
    let creativesQuery = supabase
      .from('ad_creatives')
      .select('id, name, utm_content, platform, landing_page_id')

    const filteredCreatives = applyClinicFilter(creativesQuery, { clinicId, assignedClinicIds })
    if (filteredCreatives) creativesQuery = filteredCreatives

    // 3) payments — 기간 필터 없이 전체 조회
    // 리드 기간 내 유입된 고객의 결제는 기간 이후에 발생할 수 있으므로
    // 결제에는 별도 기간 필터를 적용하지 않음 (리드 기준 귀속)
    let paymentsQuery = supabase
      .from('payments')
      .select('id, payment_amount, customer_id')

    const filteredPayments = applyClinicFilter(paymentsQuery, { clinicId, assignedClinicIds })
    if (filteredPayments) paymentsQuery = filteredPayments

    // 병렬 쿼리 실행
    const [leadsRes, creativesRes, paymentsRes] = await Promise.all([
      leadsQuery,
      creativesQuery,
      paymentsQuery,
    ])

    if (leadsRes.error) {
      logger.error('리드 조회 실패', leadsRes.error, { clinicId })
      return apiError('리드 데이터 조회 실패', 500)
    }
    if (creativesRes.error) {
      logger.warn('소재 메타데이터 조회 실패 — 미매칭으로 처리', { clinicId, error: creativesRes.error.message })
    }
    if (paymentsRes.error) {
      logger.warn('결제 데이터 조회 실패 — 매출 0으로 처리', { clinicId, error: paymentsRes.error.message })
    }

    const leads = leadsRes.data || []
    const creatives = creativesRes.data || []
    const payments = paymentsRes.data || []

    // utm_content로만 매칭 (대소문자 무시)
    const creativeMap = new Map<string, { name: string; platform: string | null; landing_page_id: number | null }>()
    for (const c of creatives) {
      creativeMap.set(c.utm_content.toLowerCase(), {
        name: c.name,
        platform: c.platform,
        landing_page_id: c.landing_page_id,
      })
    }

    // utm_content별 리드 집계 (대소문자 정규화)
    const contentLeadMap = new Map<string, { leadIds: Set<number>; customerIds: Set<number> }>()
    let unmatchedLeads = 0

    for (const lead of leads) {
      const raw = lead.utm_content as string
      if (!raw) continue
      const content = raw.toLowerCase()

      if (!contentLeadMap.has(content)) {
        contentLeadMap.set(content, { leadIds: new Set(), customerIds: new Set() })
      }
      const entry = contentLeadMap.get(content)!
      entry.leadIds.add(lead.id)
      if (lead.customer_id) entry.customerIds.add(lead.customer_id)
    }

    // customer_id별 utm_content 매핑 (리드 기반, 대소문자 정규화)
    const customerUtmContentMap = new Map<number, string>()
    for (const lead of leads) {
      if (lead.customer_id && lead.utm_content) {
        if (!customerUtmContentMap.has(lead.customer_id)) {
          customerUtmContentMap.set(lead.customer_id, (lead.utm_content as string).toLowerCase())
        }
      }
    }

    // 결제 데이터를 utm_content별로 집계
    const contentPaymentMap = new Map<string, { payingCustomers: Set<number>; revenue: number }>()

    for (const payment of payments) {
      const customerId = payment.customer_id
      if (!customerId) continue

      const utmContent = customerUtmContentMap.get(customerId)
      if (!utmContent) continue

      if (!contentPaymentMap.has(utmContent)) {
        contentPaymentMap.set(utmContent, { payingCustomers: new Set(), revenue: 0 })
      }
      const entry = contentPaymentMap.get(utmContent)!
      entry.payingCustomers.add(customerId)
      entry.revenue += Number(payment.payment_amount) || 0
    }

    // 최종 결과 조립: 매칭/미매칭 모두 포함, registered 플래그로 구분
    const allUtmContents = new Set([...contentLeadMap.keys()])
    const allCreatives: {
      utm_content: string; name: string; platform: string | null
      leads: number; customers: number; revenue: number; conversionRate: number
      registered: boolean
    }[] = []

    for (const utmContent of allUtmContents) {
      const creative = creativeMap.get(utmContent)
      const leadData = contentLeadMap.get(utmContent)
      const paymentData = contentPaymentMap.get(utmContent)

      const leadCount = leadData?.leadIds.size || 0
      const customerCount = paymentData?.payingCustomers.size || 0
      const revenue = paymentData?.revenue || 0
      const conversionRate = leadCount > 0 ? Math.round((customerCount / leadCount) * 1000) / 10 : 0

      allCreatives.push({
        utm_content: utmContent,
        name: creative?.name || utmContent,
        platform: creative ? normalizeChannel(creative.platform) : null,
        leads: leadCount,
        customers: customerCount,
        revenue,
        conversionRate,
        registered: !!creative,
      })
    }

    // 전환율 높은순 정렬, 동률 시 리드수 높은순
    allCreatives.sort((a, b) => b.conversionRate - a.conversionRate || b.leads - a.leads)

    return apiSuccess({
      creatives: allCreatives,
    })
  } catch (error) {
    logger.error('소재별 성과 조회 실패', error, { clinicId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})

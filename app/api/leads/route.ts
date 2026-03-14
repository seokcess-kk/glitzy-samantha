import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, apiError, apiSuccess } from '@/lib/api-middleware'

/**
 * 고객 기준 리드 조회 API (하이브리드 방식)
 * - 고객당 1행
 * - 각 고객의 모든 유입(leads) 이력 포함
 */
export const GET = withClinicFilter(async (req: Request, { clinicId }: ClinicContext) => {
  const supabase = serverSupabase()

  // 고객 기준으로 조회, leads를 포함
  let query = supabase
    .from('customers')
    .select(`
      *,
      leads(*),
      consultations(*),
      payments(*),
      bookings(*)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (clinicId) query = query.eq('clinic_id', clinicId)

  const { data: customers, error } = await query

  if (error) return apiError(error.message, 500)

  // leads가 있는 고객만 필터링 + 정렬 (최근 리드 기준)
  const customersWithLeads = (customers || [])
    .filter(c => c.leads && c.leads.length > 0)
    .map(c => {
      // leads를 최신순 정렬
      const sortedLeads = [...c.leads].sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      const latestLead = sortedLeads[0]

      return {
        // 고객 정보
        id: c.id,
        customer_id: c.id,
        phone_number: c.phone_number,
        name: c.name,
        first_source: c.first_source,
        first_campaign_id: c.first_campaign_id,
        clinic_id: c.clinic_id,
        created_at: c.created_at,

        // 최신 리드 정보 (목록 표시용)
        latest_lead: latestLead,
        utm_source: latestLead?.utm_source,
        utm_medium: latestLead?.utm_medium,
        utm_campaign: latestLead?.utm_campaign,
        utm_content: latestLead?.utm_content,
        chatbot_sent: latestLead?.chatbot_sent,
        chatbot_sent_at: latestLead?.chatbot_sent_at,

        // 전체 유입 이력
        leads: sortedLeads,
        lead_count: sortedLeads.length,

        // 고객 정보 (기존 구조 호환)
        customer: {
          id: c.id,
          phone_number: c.phone_number,
          name: c.name,
          first_source: c.first_source,
          first_campaign_id: c.first_campaign_id,
          consultations: c.consultations || [],
          payments: c.payments || [],
          bookings: c.bookings || [],
        },
      }
    })
    .sort((a, b) => {
      // 최신 리드 기준 정렬
      const aTime = new Date(a.latest_lead?.created_at || a.created_at).getTime()
      const bTime = new Date(b.latest_lead?.created_at || b.created_at).getTime()
      return bTime - aTime
    })

  return apiSuccess(customersWithLeads)
})

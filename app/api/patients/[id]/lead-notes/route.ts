import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { parseId } from '@/lib/security'

/**
 * 고객(customer)에 속한 모든 leads의 lead_notes 타임라인 통합 조회
 * - 예약/결제 화면에서 리드 단계의 상담 메모 컨텍스트를 보여주기 위함
 * - 시간순(ASC) 정렬 → 1차/2차/3차... 순서 그대로 표시
 */
export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const customerId = parseId(segments[segments.indexOf('patients') + 1])
  if (!customerId) return apiError('유효한 고객 ID가 필요합니다.', 400)

  const supabase = serverSupabase()

  // 1) 고객 조회 (clinic 권한 검증)
  let customerQuery = supabase.from('customers').select('id, clinic_id').eq('id', customerId)
  const filtered = applyClinicFilter(customerQuery, { clinicId, assignedClinicIds })
  if (filtered === null) return apiError('접근 권한이 없습니다.', 403)
  customerQuery = filtered

  const { data: customer, error: customerError } = await customerQuery.maybeSingle()
  if (customerError) return apiError(customerError.message, 500)
  if (!customer) return apiSuccess({ notes: [] })

  // 2) 해당 고객의 lead_id 목록 조회
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id')
    .eq('customer_id', customerId)
    .eq('clinic_id', customer.clinic_id)

  if (leadsError) return apiError(leadsError.message, 500)

  const leadIds = (leads || []).map(l => l.id)
  if (leadIds.length === 0) return apiSuccess({ notes: [] })

  // 3) 해당 leads의 모든 lead_notes (시간순)
  const { data: notes, error: notesError } = await supabase
    .from('lead_notes')
    .select('id, lead_id, content, created_by, created_at, updated_at, author:users!lead_notes_created_by_fkey(id, username)')
    .in('lead_id', leadIds)
    .order('created_at', { ascending: true })

  if (notesError) return apiError(notesError.message, 500)

  return apiSuccess({ notes: notes || [] })
})

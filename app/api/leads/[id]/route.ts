import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, apiError, apiSuccess } from '@/lib/api-middleware'
import { parseId } from '@/lib/security'

const VALID_LEAD_STATUSES = ['new', 'no_answer', 'consulted', 'booked', 'hold', 'rejected'] as const

/**
 * 리드 상태 변경 API
 * - lead_status 변경
 * - "booked" 상태로 변경 시 bookings 테이블에 자동 생성
 */
export const PATCH = withClinicFilter(async (req: Request, { clinicId }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const id = url.pathname.split('/').pop()
  const leadId = parseId(id)
  if (!leadId) return apiError('유효한 ID가 필요합니다.', 400)

  const body = await req.json()
  const { lead_status } = body

  if (!lead_status || !VALID_LEAD_STATUSES.includes(lead_status)) {
    return apiError(`유효하지 않은 상태입니다. (${VALID_LEAD_STATUSES.join(', ')})`, 400)
  }

  // 리드 조회 (clinic_id 권한 확인 포함)
  let query = supabase.from('leads').select('id, customer_id, clinic_id, lead_status').eq('id', leadId)
  if (clinicId) query = query.eq('clinic_id', clinicId)

  const { data: lead, error: fetchError } = await query.single()
  if (fetchError || !lead) return apiError('리드를 찾을 수 없습니다.', 404)

  // 상태 변경
  const { error: updateError } = await supabase
    .from('leads')
    .update({ lead_status })
    .eq('id', leadId)
  if (updateError) return apiError(updateError.message, 500)

  // "booked" 상태로 변경 시 bookings 자동 생성
  if (lead_status === 'booked' && lead.lead_status !== 'booked') {
    // 이미 이 고객의 예약이 있는지 확인
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('customer_id', lead.customer_id)
      .eq('clinic_id', lead.clinic_id)
      .in('status', ['confirmed', 'visited', 'treatment_confirmed'])
      .limit(1)
      .maybeSingle()

    if (!existingBooking) {
      await supabase.from('bookings').insert({
        customer_id: lead.customer_id,
        clinic_id: lead.clinic_id,
        status: 'confirmed',
        booking_date: new Date().toISOString(),
        notes: `캠페인 리드에서 예약 전환 (lead_id: ${leadId})`,
      })
    }
  }

  return apiSuccess({ success: true, lead_status })
})

import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, withSuperAdmin, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { parseId } from '@/lib/security'
import { logActivity } from '@/lib/activity-log'
import { archiveBeforeDelete } from '@/lib/archive'

const VALID_LEAD_STATUSES = ['new', 'no_answer', 'consulted', 'booked', 'hold', 'rejected'] as const

/**
 * 리드 상태 변경 API
 * - lead_status 변경
 * - "booked" 상태로 변경 시 bookings 테이블에 자동 생성
 *   (lead_notes의 최신 메모 내용을 bookings.notes로 이관)
 *
 * 메모(notes)는 별도 엔드포인트(/api/leads/[id]/notes)에서 다건 관리.
 */
export const PATCH = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const id = url.pathname.split('/').pop()
  const leadId = parseId(id)
  if (!leadId) return apiError('유효한 ID가 필요합니다.', 400)

  const body = await req.json()
  const { lead_status } = body

  if (!lead_status) {
    return apiError('변경할 항목이 없습니다.', 400)
  }

  if (!VALID_LEAD_STATUSES.includes(lead_status)) {
    return apiError(`유효하지 않은 상태입니다. (${VALID_LEAD_STATUSES.join(', ')})`, 400)
  }

  // 리드 조회 (clinic_id 권한 확인 포함)
  let query = supabase.from('leads').select('id, customer_id, clinic_id, lead_status').eq('id', leadId)
  const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
  if (filtered === null) return apiError('접근 권한이 없습니다.', 403)
  query = filtered

  const { data: lead, error: fetchError } = await query.single()
  if (fetchError || !lead) return apiError('리드를 찾을 수 없습니다.', 404)

  const { error: updateError } = await supabase
    .from('leads')
    .update({ lead_status, updated_by: Number(user.id) })
    .eq('id', leadId)
  if (updateError) return apiError(updateError.message, 500)

  // "booked" 상태로 변경 시 bookings 자동 생성 (최신 lead_notes를 booking 메모로 이관)
  if (lead_status === 'booked' && lead.lead_status !== 'booked') {
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('customer_id', lead.customer_id)
      .eq('clinic_id', lead.clinic_id)
      .in('status', ['confirmed', 'visited', 'treatment_confirmed'])
      .limit(1)
      .maybeSingle()

    if (!existingBooking) {
      const { data: latestNote } = await supabase
        .from('lead_notes')
        .select('content')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const { data: newBooking } = await supabase.from('bookings').insert({
        customer_id: lead.customer_id,
        clinic_id: lead.clinic_id,
        status: 'confirmed',
        booking_datetime: new Date().toISOString(),
        notes: latestNote?.content || '',
        created_by: Number(user.id),
      }).select('id').single()

      if (newBooking) {
        await logActivity(supabase, {
          userId: user.id, clinicId: lead.clinic_id,
          action: 'booking_create', targetTable: 'bookings', targetId: newBooking.id,
          detail: { customer_id: lead.customer_id, source: 'lead_status_booked', lead_id: leadId },
        })
      }
    }
  }

  await logActivity(supabase, {
    userId: user.id, clinicId: lead.clinic_id,
    action: 'lead_status_change',
    targetTable: 'leads', targetId: leadId,
    detail: { before: lead.lead_status, after: lead_status },
  })

  return apiSuccess({ success: true, lead_status })
})

/**
 * 리드 삭제 (superadmin 전용)
 */
export const DELETE = withSuperAdmin(async (req: Request, { user }) => {
  const url = new URL(req.url)
  const id = url.pathname.split('/').pop()
  const leadId = parseId(id)
  if (!leadId) return apiError('유효한 ID가 필요합니다.', 400)

  const supabase = serverSupabase()

  const { data: lead } = await supabase
    .from('leads')
    .select('id, clinic_id, customer_id')
    .eq('id', leadId)
    .single()
  if (!lead) return apiError('리드를 찾을 수 없습니다.', 404)

  await archiveBeforeDelete(supabase, 'leads', leadId, user.id, lead.clinic_id)
  const { error } = await supabase.from('leads').delete().eq('id', leadId)
  if (error) return apiError(error.message, 500)

  await logActivity(supabase, {
    userId: user.id, clinicId: lead.clinic_id,
    action: 'lead_delete', targetTable: 'leads', targetId: leadId,
    detail: { customer_id: lead.customer_id },
  })

  return apiSuccess({ deleted: true })
})

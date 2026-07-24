import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, withSuperAdmin, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { parseId } from '@/lib/security'
import { logActivity } from '@/lib/activity-log'
import { archiveBeforeDelete } from '@/lib/archive'
import { createLogger } from '@/lib/logger'

const logger = createLogger('LeadPatch')

const VALID_LEAD_STATUSES = ['new', 'no_answer', 'consulting', 'consulted', 'booked', 'hold', 'rejected'] as const

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
  const { lead_status, next_contact_at } = body

  const hasStatus = lead_status !== undefined && lead_status !== null
  const hasNextContact = next_contact_at !== undefined
  if (!hasStatus && !hasNextContact) {
    return apiError('변경할 항목이 없습니다.', 400)
  }
  if (hasStatus && !VALID_LEAD_STATUSES.includes(lead_status)) {
    return apiError(`유효하지 않은 상태입니다. (${VALID_LEAD_STATUSES.join(', ')})`, 400)
  }
  // 재연락 예정일 검증 (null/빈값 = 해제)
  let nextContactValue: string | null | undefined = undefined
  if (hasNextContact) {
    if (next_contact_at === null || next_contact_at === '') {
      nextContactValue = null
    } else {
      const d = new Date(next_contact_at)
      if (Number.isNaN(d.getTime())) return apiError('유효하지 않은 재연락일입니다.', 400)
      nextContactValue = d.toISOString()
    }
  }

  // 리드 조회 (clinic_id 권한 확인 포함)
  let query = supabase.from('leads').select('id, customer_id, clinic_id, lead_status').eq('id', leadId)
  const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
  if (filtered === null) return apiError('접근 권한이 없습니다.', 403)
  query = filtered

  const { data: lead, error: fetchError } = await query.single()
  if (fetchError || !lead) return apiError('리드를 찾을 수 없습니다.', 404)

  // 1) 상태 변경(+updated_by) — 신규 컬럼을 건드리지 않아 마이그레이션 여부와 무관하게 항상 안전.
  const statusUpdate: Record<string, unknown> = { updated_by: Number(user.id) }
  if (hasStatus) statusUpdate.lead_status = lead_status
  const { error: updateError } = await supabase.from('leads').update(statusUpdate).eq('id', leadId)
  if (updateError) {
    logger.error('리드 수정 실패', updateError, { clinicId })
    return apiError('리드 수정에 실패했습니다.', 500)
  }

  // 2) 재연락 예정일(명시 설정 시) — 상태 변경과 별도 업데이트로 원자성 분리.
  //    재연락 컬럼(마이그레이션 20260724) 미적용 시 이 단계만 실패하고 상태 변경은 이미 반영됨.
  if (nextContactValue !== undefined) {
    const { error: ncErr } = await supabase.from('leads').update({ next_contact_at: nextContactValue }).eq('id', leadId)
    if (ncErr) {
      logger.error('재연락일 저장 실패', ncErr, { clinicId })
      return apiError('재연락일 저장에 실패했습니다. (재연락 마이그레이션 필요)', 500)
    }
  }

  // 3) 상태 변경(=리드 처리) 시 연락 추적 — best-effort(마이그레이션 미적용 시 무시).
  //    · last_contacted_at 스탬프
  //    · 이번 요청에서 재연락일을 명시 설정하지 않았다면 처리 완료로 보고 기존 예정 해제(재연락 큐에서 제외)
  //    · contact_attempt_count 증분(읽고 +1)
  if (hasStatus && lead.lead_status !== lead_status) {
    const trackUpdate: Record<string, unknown> = { last_contacted_at: new Date().toISOString() }
    if (nextContactValue === undefined) trackUpdate.next_contact_at = null
    await supabase.from('leads').update(trackUpdate).eq('id', leadId)
    const { data: cnt } = await supabase.from('leads').select('contact_attempt_count').eq('id', leadId).maybeSingle()
    if (cnt && typeof cnt.contact_attempt_count === 'number') {
      await supabase.from('leads').update({ contact_attempt_count: cnt.contact_attempt_count + 1 }).eq('id', leadId)
    }
  }

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
    action: hasStatus ? 'lead_status_change' : 'lead_next_contact_set',
    targetTable: 'leads', targetId: leadId,
    detail: hasStatus
      ? { before: lead.lead_status, after: lead_status, next_contact_at: nextContactValue }
      : { next_contact_at: nextContactValue },
  })

  return apiSuccess({ success: true, lead_status: hasStatus ? lead_status : lead.lead_status, next_contact_at: nextContactValue })
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

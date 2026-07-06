import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { parseId } from '@/lib/security'
import { logActivity } from '@/lib/activity-log'
import { archiveManyBeforeDelete } from '@/lib/archive'

const MAX_BULK_DELETE = 200

/**
 * 리드 일괄 삭제 (superadmin 전용)
 * - Body: { ids: number[] }
 * - deleted_records 스냅샷 보관 후 삭제. lead_notes/capi_events는 FK ON DELETE CASCADE로 자동 정리
 * - 캠페인 리드 화면의 "선택 삭제" 기능에서 호출
 */
export const DELETE = withSuperAdmin(async (req: Request, { user }) => {
  const supabase = serverSupabase()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('요청 본문이 올바르지 않습니다.', 400)
  }

  const rawIds = (body as { ids?: unknown })?.ids
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return apiError('삭제할 리드 ID 목록이 필요합니다.', 400)
  }
  if (rawIds.length > MAX_BULK_DELETE) {
    return apiError(`한 번에 최대 ${MAX_BULK_DELETE}건까지 삭제할 수 있습니다.`, 400)
  }

  // 유효한 숫자 ID만 추출 (중복 제거)
  const ids = Array.from(new Set(
    rawIds.map(v => parseId(v)).filter((v): v is number => v !== null)
  ))
  if (ids.length === 0) return apiError('유효한 리드 ID가 없습니다.', 400)

  // 대상 리드 조회 (감사 로그용 clinic_id/customer_id 확보 + 존재 검증)
  const { data: leads, error: fetchError } = await supabase
    .from('leads')
    .select('id, clinic_id, customer_id')
    .in('id', ids)
  if (fetchError) return apiError(fetchError.message, 500)
  if (!leads || leads.length === 0) return apiError('삭제할 리드를 찾을 수 없습니다.', 404)

  const foundIds = leads.map(l => l.id)

  // 삭제 전 스냅샷 보관 (레코드별 clinic_id로 정확히 보관)
  await archiveManyBeforeDelete(supabase, 'leads', foundIds, user.id)

  const { error } = await supabase.from('leads').delete().in('id', foundIds)
  if (error) return apiError(error.message, 500)

  // clinic별 활동 로그 기록 (logActivity는 내부 try/catch로 실패해도 안전 → 병렬 처리)
  await Promise.allSettled(leads.map(lead => logActivity(supabase, {
    userId: user.id, clinicId: lead.clinic_id,
    action: 'lead_delete', targetTable: 'leads', targetId: lead.id,
    detail: { customer_id: lead.customer_id, bulk: true },
  })))

  return apiSuccess({ deleted: foundIds.length, ids: foundIds })
})

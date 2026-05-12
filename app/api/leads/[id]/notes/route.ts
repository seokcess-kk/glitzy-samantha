import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { parseId, sanitizeString } from '@/lib/security'
import { logActivity } from '@/lib/activity-log'

const MAX_NOTE_LENGTH = 1000

interface LeadRow {
  id: number
  clinic_id: number
}

/**
 * 리드 메모(타임라인) 목록 조회
 * - 오래된 순(1차 → N차) 정렬
 * - 작성자 이름 포함
 */
export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const leadId = parseId(segments[segments.indexOf('leads') + 1])
  if (!leadId) return apiError('유효한 ID가 필요합니다.', 400)

  const supabase = serverSupabase()

  // 리드의 clinic_id 권한 확인
  let leadQuery = supabase.from('leads').select('id, clinic_id').eq('id', leadId)
  const filtered = applyClinicFilter(leadQuery, { clinicId, assignedClinicIds })
  if (filtered === null) return apiError('접근 권한이 없습니다.', 403)
  leadQuery = filtered

  const { data: lead, error: leadError } = await leadQuery.single<LeadRow>()
  if (leadError || !lead) return apiError('리드를 찾을 수 없습니다.', 404)

  const { data, error } = await supabase
    .from('lead_notes')
    .select('id, content, created_by, created_at, updated_at, author:users!lead_notes_created_by_fkey(id, username)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })

  if (error) return apiError(error.message, 500)

  return apiSuccess({ notes: data || [] })
})

/**
 * 리드 메모 추가 (타임라인 끝에 N+1차로 추가)
 */
export const POST = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const leadId = parseId(segments[segments.indexOf('leads') + 1])
  if (!leadId) return apiError('유효한 ID가 필요합니다.', 400)

  let body: { content?: unknown }
  try {
    body = await req.json()
  } catch {
    return apiError('유효한 JSON 본문이 필요합니다.', 400)
  }

  const raw = typeof body.content === 'string' ? body.content : ''
  const content = sanitizeString(raw, MAX_NOTE_LENGTH).trim()
  if (!content) return apiError('메모 내용이 비어있습니다.', 400)

  const supabase = serverSupabase()

  let leadQuery = supabase.from('leads').select('id, clinic_id').eq('id', leadId)
  const filtered = applyClinicFilter(leadQuery, { clinicId, assignedClinicIds })
  if (filtered === null) return apiError('접근 권한이 없습니다.', 403)
  leadQuery = filtered

  const { data: lead, error: leadError } = await leadQuery.single<LeadRow>()
  if (leadError || !lead) return apiError('리드를 찾을 수 없습니다.', 404)

  const { data: inserted, error: insertError } = await supabase
    .from('lead_notes')
    .insert({
      lead_id: leadId,
      clinic_id: lead.clinic_id,
      content,
      created_by: Number(user.id),
    })
    .select('id, content, created_by, created_at, updated_at, author:users!lead_notes_created_by_fkey(id, username)')
    .single()

  if (insertError || !inserted) return apiError(insertError?.message || '메모 추가 실패', 500)

  await logActivity(supabase, {
    userId: user.id, clinicId: lead.clinic_id,
    action: 'lead_note_add', targetTable: 'lead_notes', targetId: inserted.id,
    detail: { lead_id: leadId },
  })

  return apiSuccess({ note: inserted })
})

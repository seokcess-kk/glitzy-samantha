import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { parseId, sanitizeString } from '@/lib/security'
import { logActivity } from '@/lib/activity-log'

const MAX_NOTE_LENGTH = 1000

interface LeadRow {
  id: number
  clinic_id: number
}

interface NoteRow {
  id: number
  lead_id: number
  clinic_id: number
  content: string
  created_by: number | null
}

function getIds(req: Request): { leadId: number | null; noteId: number | null } {
  const segments = new URL(req.url).pathname.split('/')
  const leadIdx = segments.indexOf('leads')
  const notesIdx = segments.indexOf('notes')
  return {
    leadId: parseId(segments[leadIdx + 1]),
    noteId: parseId(segments[notesIdx + 1]),
  }
}

/**
 * 권한: 본인이 작성한 노트 또는 superadmin/clinic_admin만 수정/삭제 가능
 */
function canMutate(noteCreatedBy: number | null, userId: number | string, role: string): boolean {
  if (role === 'superadmin' || role === 'clinic_admin') return true
  return noteCreatedBy !== null && Number(noteCreatedBy) === Number(userId)
}

/**
 * 리드 메모 수정
 */
export const PATCH = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  const { leadId, noteId } = getIds(req)
  if (!leadId || !noteId) return apiError('유효한 ID가 필요합니다.', 400)

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

  // 리드 권한 확인
  let leadQuery = supabase.from('leads').select('id, clinic_id').eq('id', leadId)
  const filtered = applyClinicFilter(leadQuery, { clinicId, assignedClinicIds })
  if (filtered === null) return apiError('접근 권한이 없습니다.', 403)
  leadQuery = filtered

  const { data: lead, error: leadError } = await leadQuery.single<LeadRow>()
  if (leadError || !lead) return apiError('리드를 찾을 수 없습니다.', 404)

  // 노트 조회 + 작성자 확인
  const { data: note, error: noteError } = await supabase
    .from('lead_notes')
    .select('id, lead_id, clinic_id, content, created_by')
    .eq('id', noteId)
    .eq('lead_id', leadId)
    .single<NoteRow>()
  if (noteError || !note) return apiError('메모를 찾을 수 없습니다.', 404)

  if (!canMutate(note.created_by, user.id, user.role)) {
    return apiError('본인이 작성한 메모만 수정할 수 있습니다.', 403)
  }

  const { data: updated, error: updateError } = await supabase
    .from('lead_notes')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', noteId)
    .select('id, content, created_by, created_at, updated_at, author:users!lead_notes_created_by_fkey(id, username)')
    .single()

  if (updateError || !updated) return apiError(updateError?.message || '메모 수정 실패', 500)

  await logActivity(supabase, {
    userId: user.id, clinicId: lead.clinic_id,
    action: 'lead_note_update', targetTable: 'lead_notes', targetId: noteId,
    detail: { lead_id: leadId },
  })

  return apiSuccess({ note: updated })
})

/**
 * 리드 메모 삭제
 */
export const DELETE = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  const { leadId, noteId } = getIds(req)
  if (!leadId || !noteId) return apiError('유효한 ID가 필요합니다.', 400)

  const supabase = serverSupabase()

  let leadQuery = supabase.from('leads').select('id, clinic_id').eq('id', leadId)
  const filtered = applyClinicFilter(leadQuery, { clinicId, assignedClinicIds })
  if (filtered === null) return apiError('접근 권한이 없습니다.', 403)
  leadQuery = filtered

  const { data: lead, error: leadError } = await leadQuery.single<LeadRow>()
  if (leadError || !lead) return apiError('리드를 찾을 수 없습니다.', 404)

  const { data: note, error: noteError } = await supabase
    .from('lead_notes')
    .select('id, lead_id, clinic_id, content, created_by')
    .eq('id', noteId)
    .eq('lead_id', leadId)
    .single<NoteRow>()
  if (noteError || !note) return apiError('메모를 찾을 수 없습니다.', 404)

  if (!canMutate(note.created_by, user.id, user.role)) {
    return apiError('본인이 작성한 메모만 삭제할 수 있습니다.', 403)
  }

  const { error: deleteError } = await supabase
    .from('lead_notes')
    .delete()
    .eq('id', noteId)
  if (deleteError) return apiError(deleteError.message, 500)

  await logActivity(supabase, {
    userId: user.id, clinicId: lead.clinic_id,
    action: 'lead_note_delete', targetTable: 'lead_notes', targetId: noteId,
    detail: { lead_id: leadId },
  })

  return apiSuccess({ deleted: true })
})

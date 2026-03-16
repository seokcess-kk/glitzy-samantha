import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, withSuperAdmin, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { sanitizeString, parseId } from '@/lib/security'

export const GET = withClinicFilter(async (req, { clinicId, assignedClinicIds }) => {
  const supabase = serverSupabase()

  let query = supabase
    .from('monitoring_keywords')
    .select('*')
    .order('category')
    .order('keyword')

  const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
  if (filtered === null) return apiSuccess([])
  query = filtered

  const url = new URL(req.url)
  const activeOnly = url.searchParams.get('active_only')
  if (activeOnly === 'true') query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})

export const POST = withSuperAdmin(async (req: Request, { user }) => {
  const { clinic_id, keyword, category } = await req.json()

  const cid = parseId(clinic_id)
  if (!cid) return apiError('병원을 선택해주세요.', 400)
  if (!keyword?.trim()) return apiError('키워드를 입력해주세요.', 400)

  const validCategories = ['place', 'website', 'smartblock']
  if (!validCategories.includes(category)) return apiError('유효하지 않은 카테고리입니다.', 400)

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('monitoring_keywords')
    .insert({
      clinic_id: cid,
      keyword: sanitizeString(keyword.trim(), 100),
      category,
      created_by: parseInt(user.id, 10),
    })
    .select()
    .single()

  if (error) {
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      return apiError('이미 등록된 키워드입니다.', 400)
    }
    return apiError(error.message, 500)
  }
  return apiSuccess(data, 201)
})

export const PATCH = withSuperAdmin(async (req: Request) => {
  const { id, is_active, keyword } = await req.json()

  const keywordId = parseId(id)
  if (!keywordId) return apiError('유효한 키워드 ID가 필요합니다.', 400)

  const updates: Record<string, any> = {}
  if (typeof is_active === 'boolean') updates.is_active = is_active
  if (keyword?.trim()) updates.keyword = sanitizeString(keyword.trim(), 100)

  if (Object.keys(updates).length === 0) return apiError('변경할 항목이 없습니다.', 400)

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('monitoring_keywords')
    .update(updates)
    .eq('id', keywordId)
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})

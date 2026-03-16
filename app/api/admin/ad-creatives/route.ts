import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { sanitizeString, parseId } from '@/lib/security'

export const GET = withSuperAdmin(async (req: Request) => {
  const url = new URL(req.url)
  const clinicId = url.searchParams.get('clinic_id')
  const landingPageId = url.searchParams.get('landing_page_id')
  const activeOnly = url.searchParams.get('active') === 'true'

  const supabase = serverSupabase()
  let query = supabase
    .from('ad_creatives')
    .select(`
      *,
      clinic:clinics(id, name),
      landing_page:landing_pages(id, name, file_name)
    `)
    .order('created_at', { ascending: false })

  if (clinicId) {
    const parsedClinicId = parseId(clinicId)
    if (parsedClinicId) query = query.eq('clinic_id', parsedClinicId)
  }

  if (landingPageId) {
    const parsedLpId = parseId(landingPageId)
    if (parsedLpId) query = query.eq('landing_page_id', parsedLpId)
  }

  if (activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})

export const POST = withSuperAdmin(async (req: Request) => {
  const body = await req.json()
  const {
    name, description, utm_content, utm_source, utm_medium, utm_campaign, utm_term,
    platform, clinic_id, landing_page_id, is_active, file_name, file_type
  } = body

  if (!name || !utm_content) {
    return apiError('소재명과 UTM Content 값은 필수입니다.', 400)
  }

  if (!clinic_id) {
    return apiError('병원을 선택해주세요.', 400)
  }

  const supabase = serverSupabase()

  // clinic_id 유효성 검증
  const validClinicId = parseId(clinic_id)
  if (validClinicId === null) {
    return apiError('유효하지 않은 병원 ID입니다.', 400)
  }

  const { data: clinic } = await supabase
    .from('clinics')
    .select('id')
    .eq('id', validClinicId)
    .single()

  if (!clinic) {
    return apiError('존재하지 않는 병원입니다.', 400)
  }

  // landing_page_id 유효성 검증 (선택적)
  let validLandingPageId: number | null = null
  if (landing_page_id) {
    validLandingPageId = parseId(landing_page_id)
    if (validLandingPageId) {
      const { data: lp } = await supabase
        .from('landing_pages')
        .select('id')
        .eq('id', validLandingPageId)
        .single()

      if (!lp) {
        return apiError('존재하지 않는 랜딩 페이지입니다.', 400)
      }
    }
  }

  // utm_content 중복 검사 (같은 병원 내)
  const { data: existing } = await supabase
    .from('ad_creatives')
    .select('id')
    .eq('clinic_id', validClinicId)
    .eq('utm_content', utm_content)
    .maybeSingle()

  if (existing) {
    return apiError('이미 동일한 UTM Content 값이 존재합니다.', 400)
  }

  const { data, error } = await supabase
    .from('ad_creatives')
    .insert({
      name: sanitizeString(name, 100),
      description: description ? sanitizeString(description, 500) : null,
      utm_content: sanitizeString(utm_content, 100),
      utm_source: utm_source ? sanitizeString(utm_source, 100) : null,
      utm_medium: utm_medium ? sanitizeString(utm_medium, 100) : null,
      utm_campaign: utm_campaign ? sanitizeString(utm_campaign, 100) : null,
      utm_term: utm_term ? sanitizeString(utm_term, 100) : null,
      platform: platform ? sanitizeString(platform, 50) : null,
      clinic_id: validClinicId,
      landing_page_id: validLandingPageId,
      is_active: is_active !== false,
      file_name: file_name ? sanitizeString(file_name, 200) : null,
      file_type: file_type ? sanitizeString(file_type, 50) : null,
    })
    .select(`
      *,
      clinic:clinics(id, name),
      landing_page:landing_pages(id, name, file_name)
    `)
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})

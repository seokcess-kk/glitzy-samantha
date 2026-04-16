import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { sanitizeString } from '@/lib/security'
import { createErpClient } from '@/lib/services/erpClient'
import { createLogger } from '@/lib/logger'
import { demoClinicsApiShape } from '@/lib/demo/fixtures/clinics'

const logger = createLogger('AdminClinics')

export const GET = withSuperAdmin(async (_req, { user }) => {
  if (user.role === 'demo_viewer') {
    return apiSuccess(demoClinicsApiShape())
  }

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})

export const POST = withSuperAdmin(async (req: Request) => {
  const body = await req.json()
  const { name, slug, create_erp_client, erp_client_id, business_number, contact_name, contact_phone, contact_email } = body

  if (!name || !slug) {
    return apiError('병원명과 슬러그를 입력해주세요.', 400)
  }

  // 슬러그 형식 검증
  const slugPattern = /^[a-z0-9-]{2,50}$/
  if (!slugPattern.test(slug)) {
    return apiError('슬러그는 영문 소문자, 숫자, 하이픈만 사용 가능합니다. (2-50자)', 400)
  }

  let finalErpClientId: string | null = erp_client_id ?? null

  // ERP 거래처 동시 생성
  if (create_erp_client) {
    try {
      const erpResult = await createErpClient({
        name: sanitizeString(name, 100),
        business_number: business_number || undefined,
        contact_name: contact_name || undefined,
        contact_phone: contact_phone || undefined,
        contact_email: contact_email || undefined,
      })
      finalErpClientId = erpResult.data.id
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ERP 거래처 생성 실패'
      logger.error('ERP 거래처 생성 실패', err, { name })
      if (message.includes('409')) {
        return apiError('동일한 이름 또는 사업자번호의 거래처가 이미 존재합니다.', 409)
      }
      return apiError('ERP 거래처 생성에 실패했습니다.', 500)
    }
  }

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('clinics')
    .insert({
      name: sanitizeString(name, 100),
      slug: slug.toLowerCase(),
      erp_client_id: finalErpClientId,
    })
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})

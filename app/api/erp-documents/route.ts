import { withClinicFilter, apiSuccess, apiError } from '@/lib/api-middleware'
import { fetchQuotes, fetchInvoices } from '@/lib/services/erpClient'
import { serverSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('ERPDocuments')

export const GET = withClinicFilter(async (req, { user, clinicId }) => {
  if (user.role === 'clinic_staff') return apiError('Forbidden', 403)
  if (!clinicId) return apiError('병원을 선택해주세요.', 400)

  const supabase = serverSupabase()
  const { data: clinic } = await supabase
    .from('clinics')
    .select('erp_client_id')
    .eq('id', clinicId)
    .single()

  if (!clinic?.erp_client_id) {
    return apiError('ERP 거래처가 연결되지 않은 병원입니다.', 400)
  }

  const erpClientId = clinic.erp_client_id

  const url = new URL(req.url)
  const type = url.searchParams.get('type') || 'quotes'
  const status = url.searchParams.get('status') || undefined
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '20')

  try {
    if (type === 'invoices') {
      const result = await fetchInvoices(erpClientId, { status, page, limit })
      return apiSuccess(result)
    }
    const result = await fetchQuotes(erpClientId, { status, page, limit })
    return apiSuccess(result)
  } catch (err) {
    logger.error('ERP 문서 조회 실패', err, { clinicId, erpClientId, type })
    return apiError('ERP 문서 조회에 실패했습니다.', 500)
  }
})

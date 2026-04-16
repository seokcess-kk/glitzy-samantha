import { withClinicFilter, apiSuccess, apiError } from '@/lib/api-middleware'
import { fetchQuoteDetail, fetchInvoiceDetail } from '@/lib/services/erpClient'
import { serverSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('ERPDocumentDetail')

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  const id = url.pathname.split('/').pop()!
  const type = url.searchParams.get('type') || 'quotes'

  if (!UUID_REGEX.test(id)) {
    return apiError('유효한 문서 ID가 필요합니다.', 400)
  }

  try {
    if (type === 'invoices') {
      const result = await fetchInvoiceDetail(erpClientId, id)
      return apiSuccess(result)
    }
    const result = await fetchQuoteDetail(erpClientId, id)
    return apiSuccess(result)
  } catch (err) {
    logger.error('ERP 문서 상세 조회 실패', err, { clinicId, erpClientId, id, type })
    return apiError('ERP 문서 조회에 실패했습니다.', 500)
  }
})

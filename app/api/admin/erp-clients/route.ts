import { withSuperAdmin, apiSuccess, apiError } from '@/lib/api-middleware'
import { fetchErpClients } from '@/lib/services/erpClient'
import { createLogger } from '@/lib/logger'

const logger = createLogger('AdminErpClients')

export const GET = withSuperAdmin(async (req, { user }) => {
  if (user.role === 'demo_viewer') {
    return apiSuccess({ data: [], pagination: { page: 1, totalPages: 0, totalCount: 0 } })
  }

  const url = new URL(req.url)
  const search = url.searchParams.get('search') || undefined
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')

  try {
    const result = await fetchErpClients({ search, page, limit })
    return apiSuccess(result)
  } catch (err) {
    logger.error('ERP 거래처 조회 실패', err)
    return apiError('ERP 거래처 조회에 실패했습니다.', 500)
  }
})

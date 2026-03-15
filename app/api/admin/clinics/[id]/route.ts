import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'

/**
 * 병원 개별 수정 API (알림 설정 등)
 */
export const PATCH = withSuperAdmin(async (req: Request) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const id = url.pathname.split('/').pop()

  if (!id || isNaN(Number(id))) return apiError('유효한 ID가 필요합니다.', 400)

  const body = await req.json()
  const updateData: Record<string, unknown> = {}

  if ('notify_phone' in body) updateData.notify_phone = body.notify_phone
  if ('notify_enabled' in body) updateData.notify_enabled = body.notify_enabled

  if (Object.keys(updateData).length === 0) return apiError('수정할 항목이 없습니다.', 400)

  const { error } = await supabase
    .from('clinics')
    .update(updateData)
    .eq('id', Number(id))

  if (error) return apiError(error.message, 500)

  return apiSuccess({ success: true })
})

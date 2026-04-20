import bcrypt from 'bcryptjs'
import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { parseId } from '@/lib/security'
import { logActivity } from '@/lib/activity-log'
import { createLogger } from '@/lib/logger'

const logger = createLogger('AdminUserPassword')

export const PATCH = withSuperAdmin(async (req: Request, { user }) => {
  try {
    const userId = parseId(new URL(req.url).pathname.split('/users/')[1]?.split('/')[0])
    if (!userId) return apiError('유효한 사용자 ID가 필요합니다.', 400)

    const { password } = await req.json()

    if (typeof password !== 'string' || password.length < 8) {
      return apiError('비밀번호는 최소 8자 이상이어야 합니다.', 400)
    }
    if (password.length > 128) {
      return apiError('비밀번호가 너무 깁니다.', 400)
    }

    const supabase = serverSupabase()

    const { data: targetUser } = await supabase
      .from('users')
      .select('id, username, role, clinic_id, password_version')
      .eq('id', userId)
      .single()

    if (!targetUser) return apiError('사용자를 찾을 수 없습니다.', 404)

    const password_hash = await bcrypt.hash(password, 12)
    const nextVersion = (targetUser.password_version ?? 1) + 1

    const { error } = await supabase
      .from('users')
      .update({ password_hash, password_version: nextVersion })
      .eq('id', userId)

    if (error) return apiError(error.message, 500)

    await logActivity(supabase, {
      userId: user.id,
      clinicId: targetUser.clinic_id,
      action: 'reset_password',
      targetTable: 'users',
      targetId: userId,
      detail: { target_username: targetUser.username, target_role: targetUser.role },
    })

    return apiSuccess({ success: true })
  } catch (err) {
    logger.error('비밀번호 재설정 실패', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})

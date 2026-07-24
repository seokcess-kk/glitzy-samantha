import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { isValidPhoneNumber, parseId } from '@/lib/security'
import { checkRateLimit, recordFailedAttempt } from '@/lib/rate-limit'
import { sendSmsWithLog } from '@/lib/solapi'
import { createLogger } from '@/lib/logger'

const logger = createLogger('TestSms')

/**
 * 알림 문자 테스트 발송 (superadmin)
 * POST /api/admin/clinics/[id]/test-sms  body: { phones: string[] }
 * 저장 전에도 현재 입력한 연락처로 실제 발송을 검증. 결과는 sms_send_logs에도 기록되나
 * lead_id 없이 기록되므로 발송 실패 배너(/api/admin/sms-failures, lead_id 있는 것만) 집계에는 미포함.
 */
export const POST = withSuperAdmin(async (req: Request, { user }) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  // /api/admin/clinics/[id]/test-sms → id는 뒤에서 두 번째 세그먼트
  const parts = url.pathname.split('/')
  const clinicId = parseId(parts[parts.length - 2])
  if (!clinicId) return apiError('유효한 병원 ID가 필요합니다.', 400)

  // 남용/비용 방지 — superadmin당 15분 내 제한(로그인 rate-limit 모듈 재사용, in-memory best-effort)
  const rl = checkRateLimit(String(user.id), 'test-sms')
  if (rl.limited) {
    return apiError(`테스트 문자 발송이 일시 제한되었습니다. ${rl.retryAfterSeconds ?? 60}초 후 다시 시도하세요.`, 429)
  }

  const body = await req.json().catch(() => ({}))
  const phones: string[] = Array.isArray(body.phones)
    ? body.phones.filter((p: unknown): p is string => typeof p === 'string' && p.trim().length > 0)
    : []
  if (phones.length === 0) return apiError('테스트할 연락처가 없습니다.', 400)
  if (phones.length > 3) return apiError('연락처는 최대 3개입니다.', 400)
  for (const p of phones) {
    if (!isValidPhoneNumber(p)) return apiError(`유효하지 않은 연락처입니다: ${p}`, 400)
  }

  // SOLAPI 3종 모두 필요 (key/secret/sender) — 하나라도 없으면 발송 실패 → 사전 차단
  if (!process.env.SOLAPI_API_KEY || !process.env.SOLAPI_API_SECRET || !process.env.SOLAPI_SENDER_NUMBER) {
    return apiError('SMS 발송이 설정되지 않았습니다. (SOLAPI 환경변수 미설정)', 400)
  }

  // 병원 존재 검증 (FK 위반 방지 + 잘못된 대상 발송 방지)
  const { data: clinic, error: clinicErr } = await supabase.from('clinics').select('name').eq('id', clinicId).single()
  if (clinicErr || !clinic) return apiError('병원을 찾을 수 없습니다.', 404)

  const clinicName = clinic.name || '병원'
  const text = `[${clinicName}] 알림 설정 테스트 문자입니다. 이 문자를 받으셨다면 리드 알림이 정상 동작합니다.`

  // 이번 발송을 rate-limit 카운트에 반영
  recordFailedAttempt(String(user.id), 'test-sms')

  const results = await Promise.all(
    phones.map(async (phone) => {
      const r = await sendSmsWithLog(supabase, { to: phone, text, clinicId }).catch(() => ({ success: false, error: 'send_error' as string | undefined }))
      return { phone, success: r.success, error: r.error ?? null }
    }),
  )
  const allSent = results.every(r => r.success)
  if (!allSent) logger.warn('테스트 문자 일부 실패', { clinicId, results })
  return apiSuccess({ results, allSent })
})

import { serverSupabase } from '@/lib/supabase'
import { withAuth, apiError, apiSuccess } from '@/lib/api-middleware'
import {
  parseId,
  sanitizeString,
  isValidPaymentAmount,
  isValidDate,
  checkClinicAccess,
} from '@/lib/security'
import { logActivity } from '@/lib/activity-log'
import { archiveBeforeDelete } from '@/lib/archive'

function getIdFromUrl(req: Request): number | null {
  const url = new URL(req.url)
  return parseId(url.pathname.split('/').pop())
}

// 결제 수정 (자기 병원 결제만, demo_viewer 차단)
export const PATCH = withAuth(async (req: Request, { user }) => {
  const paymentId = getIdFromUrl(req)
  if (!paymentId) return apiError('유효한 ID가 필요합니다.', 400)

  const supabase = serverSupabase()

  const { data: payment } = await supabase
    .from('payments')
    .select('id, clinic_id, customer_id, treatment_name, payment_amount, payment_date')
    .eq('id', paymentId)
    .single()
  if (!payment) return apiError('결제를 찾을 수 없습니다.', 404)

  if (!checkClinicAccess(payment.clinic_id, user)) {
    return apiError('해당 결제에 대한 권한이 없습니다.', 403)
  }

  const body = await req.json().catch(() => ({}))
  const updates: Record<string, unknown> = {}

  if (body.treatmentName !== undefined) {
    if (typeof body.treatmentName !== 'string' || body.treatmentName.trim() === '') {
      return apiError('시술명은 필수입니다.', 400)
    }
    updates.treatment_name = sanitizeString(body.treatmentName, 200)
  }

  if (body.paymentAmount !== undefined) {
    const amount = Number(body.paymentAmount)
    if (!isValidPaymentAmount(amount)) {
      return apiError('유효한 결제 금액이 필요합니다. (1원 ~ 1억원)', 400)
    }
    updates.payment_amount = amount
  }

  if (body.paymentDate !== undefined) {
    if (typeof body.paymentDate !== 'string' || !isValidDate(body.paymentDate)) {
      return apiError('유효하지 않은 날짜 형식입니다.', 400)
    }
    // KST 자정 기준으로 저장 (YYYY-MM-DD 입력 가정)
    const ymd = /^\d{4}-\d{2}-\d{2}$/.test(body.paymentDate)
      ? body.paymentDate
      : new Date(body.paymentDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
    updates.payment_date = new Date(`${ymd}T00:00:00+09:00`).toISOString()
  }

  if (Object.keys(updates).length === 0) {
    return apiError('수정할 항목이 없습니다.', 400)
  }

  updates.updated_by = Number(user.id)

  const { data, error } = await supabase
    .from('payments')
    .update(updates)
    .eq('id', paymentId)
    .select()
    .single()
  if (error) return apiError(error.message, 500)

  await logActivity(supabase, {
    userId: user.id,
    clinicId: payment.clinic_id,
    action: 'payment_update',
    targetTable: 'payments',
    targetId: paymentId,
    detail: {
      customer_id: payment.customer_id,
      before: {
        treatment_name: payment.treatment_name,
        payment_amount: payment.payment_amount,
        payment_date: payment.payment_date,
      },
      after: updates,
    },
  })

  return apiSuccess(data)
})

// 결제 삭제 (자기 병원 결제만, demo_viewer 차단)
export const DELETE = withAuth(async (req: Request, { user }) => {
  const paymentId = getIdFromUrl(req)
  if (!paymentId) return apiError('유효한 ID가 필요합니다.', 400)

  const supabase = serverSupabase()

  const { data: payment } = await supabase
    .from('payments')
    .select('id, clinic_id, customer_id')
    .eq('id', paymentId)
    .single()
  if (!payment) return apiError('결제를 찾을 수 없습니다.', 404)

  if (!checkClinicAccess(payment.clinic_id, user)) {
    return apiError('해당 결제에 대한 권한이 없습니다.', 403)
  }

  await archiveBeforeDelete(supabase, 'payments', paymentId, user.id, payment.clinic_id)
  const { error } = await supabase.from('payments').delete().eq('id', paymentId)
  if (error) return apiError(error.message, 500)

  await logActivity(supabase, {
    userId: user.id, clinicId: payment.clinic_id,
    action: 'payment_delete', targetTable: 'payments', targetId: paymentId,
    detail: { customer_id: payment.customer_id },
  })

  return apiSuccess({ deleted: true })
})

import { serverSupabase } from '@/lib/supabase'
import { apiError, apiSuccess } from '@/lib/api-middleware'
import { logActivity } from '@/lib/activity-log'
import { createLogger } from '@/lib/logger'
import { timingSafeEqual } from 'crypto'

const logger = createLogger('WebhookErpClient')

const VALID_EVENTS = ['client.created', 'client.updated', 'client.deleted'] as const
type EventType = typeof VALID_EVENTS[number]

interface WebhookBody {
  event: EventType
  data: {
    id: string
    name: string
    branch_name?: string | null
    business_number?: string | null
    contact_name?: string | null
    contact_phone?: string | null
    contact_email?: string | null
  }
  timestamp: string
}

function verifyAuth(req: Request): boolean {
  const key = process.env.ERP_SERVICE_KEY
  if (!key) return false

  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false

  const token = auth.slice(7)
  const tokenBuf = Buffer.from(token)
  const keyBuf = Buffer.from(key)
  if (tokenBuf.length !== keyBuf.length || !timingSafeEqual(tokenBuf, keyBuf)) {
    return false
  }
  return true
}

export async function POST(req: Request) {
  if (!verifyAuth(req)) {
    return apiError('Unauthorized', 401)
  }

  let body: WebhookBody
  try {
    body = await req.json()
  } catch {
    return apiError('잘못된 요청 본문입니다.', 400)
  }

  const { event, data } = body
  if (!event || !VALID_EVENTS.includes(event as EventType) || !data?.id) {
    return apiError('유효하지 않은 이벤트입니다.', 400)
  }

  const supabase = serverSupabase()
  const clinicName = data.branch_name ? `${data.name} (${data.branch_name})` : data.name

  try {
    switch (event) {
      case 'client.created': {
        // 자동 등록 비활성화 — clinics 는 admin 에서 명시적으로 생성 후 ERP 매핑.
        // glitzy-web 에서 잘못 꼬여 등록된 거래처가 자동 유입되는 운영 혼선을 차단.
        logger.info('client.created 이벤트 무시 (자동 등록 비활성화)', {
          erp_client_id: data.id,
          name: data.name,
        })
        return apiSuccess({ message: '자동 등록이 비활성화되어 있습니다. admin 에서 매핑하세요.' })
      }

      case 'client.updated': {
        const { data: clinic } = await supabase
          .from('clinics')
          .select('id')
          .eq('erp_client_id', data.id)
          .maybeSingle()

        if (!clinic) {
          logger.warn('매핑된 클리닉 없음 — 업데이트 스킵', { erpClientId: data.id })
          return apiSuccess({ message: 'not_linked' })
        }

        await supabase
          .from('clinics')
          .update({ name: clinicName })
          .eq('id', clinic.id)

        logActivity(supabase, {
          userId: 0,
          clinicId: clinic.id,
          action: 'erp_webhook_client_updated',
          targetTable: 'clinics',
          targetId: clinic.id,
          detail: { erp_client_id: data.id, name: data.name },
        })

        return apiSuccess({ message: 'updated', clinic_id: clinic.id })
      }

      case 'client.deleted': {
        const { data: clinic } = await supabase
          .from('clinics')
          .select('id')
          .eq('erp_client_id', data.id)
          .maybeSingle()

        if (!clinic) {
          logger.warn('매핑된 클리닉 없음 — 삭제 스킵', { erpClientId: data.id })
          return apiSuccess({ message: 'not_linked' })
        }

        await supabase
          .from('clinics')
          .update({ is_active: false })
          .eq('id', clinic.id)

        logActivity(supabase, {
          userId: 0,
          clinicId: clinic.id,
          action: 'erp_webhook_client_deleted',
          targetTable: 'clinics',
          targetId: clinic.id,
          detail: { erp_client_id: data.id },
        })

        return apiSuccess({ message: 'deactivated', clinic_id: clinic.id })
      }
    }
  } catch (err) {
    logger.error('Webhook 처리 실패', err, { event, erpClientId: data.id })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

import { serverSupabase } from '@/lib/supabase'
import { apiError, apiSuccess } from '@/lib/api-middleware'
import { qstash } from '@/lib/qstash'
import {
  isValidPhoneNumber,
  isValidUrl,
  normalizePhoneNumber,
  sanitizeString,
  sanitizeUrl,
  parseId,
} from '@/lib/security'
import {
  parseUtmFromUrl,
  sanitizeUtmParams,
  mergeUtmParams,
  parseLandingPageIdFromUrl,
  type UtmParams,
} from '@/lib/utm'
import { createLogger } from '@/lib/logger'
import { sendErrorAlert } from '@/lib/error-alert'
import { sendCapiEvent } from '@/lib/services/metaCapi'
import { waitUntil } from '@vercel/functions'

const logger = createLogger('WebhookLead')

// raw 로그 상태 업데이트 (실패해도 메인 플로우를 막지 않음)
async function updateRawLog(
  supabase: ReturnType<typeof serverSupabase>,
  rawLogId: number | null,
  update: { status: string; lead_id?: number; error_message?: string }
) {
  if (!rawLogId) return
  try {
    await supabase
      .from('lead_raw_logs')
      .update({ ...update, processed_at: new Date().toISOString() })
      .eq('id', rawLogId)
  } catch (e) {
    logger.warn('raw 로그 업데이트 실패', { rawLogId, error: e })
  }
}

export async function POST(req: Request) {
  const supabase = serverSupabase()
  let rawLogId: number | null = null

  // --- body 파싱 ---
  let body: {
    name?: string
    phoneNumber?: string
    campaignId?: string
    source?: string
    inflowUrl?: string
    clinic_id?: number | string
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    utm_content?: string
    utm_term?: string
    landing_page_id?: number | string
    custom_data?: Record<string, unknown>
    idempotency_key?: string
    event_id?: string
  }

  try {
    body = await req.json()
  } catch {
    return apiError('잘못된 요청 형식입니다.', 400)
  }

  // --- Layer 1: raw 로그 즉시 저장 ---
  try {
    // 멱등성 키가 있으면 중복 확인
    if (body.idempotency_key) {
      const { data: existing } = await supabase
        .from('lead_raw_logs')
        .select('id, status, lead_id')
        .eq('idempotency_key', body.idempotency_key)
        .single()

      if (existing) {
        // 이미 처리 완료된 요청이면 성공 응답 반환
        if (existing.status === 'processed') {
          return apiSuccess({
            success: true,
            message: '이미 처리된 요청입니다.',
            leadId: existing.lead_id,
            duplicate: true,
          })
        }
        // received/failed 상태면 재처리 진행 (rawLogId 설정)
        rawLogId = existing.id
      }
    }

    if (!rawLogId) {
      const { data: rawLog } = await supabase
        .from('lead_raw_logs')
        .insert({
          payload: body,
          status: 'received',
          clinic_id: body.clinic_id ? parseId(body.clinic_id) : null,
          idempotency_key: body.idempotency_key || null,
        })
        .select('id')
        .single()
      rawLogId = rawLog?.id ?? null
    }
  } catch (e) {
    // raw 로그 저장 실패는 메인 플로우를 막지 않음
    logger.warn('raw 로그 저장 실패', { error: e })
  }

  // --- 검증 ---
  const {
    name,
    phoneNumber,
    campaignId,
    source,
    inflowUrl,
    clinic_id,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    landing_page_id,
    custom_data,
    event_id,
  } = body

  if (!phoneNumber) {
    await updateRawLog(supabase, rawLogId, { status: 'failed', error_message: '전화번호 누락' })
    return apiError('전화번호는 필수입니다.', 400)
  }

  if (!isValidPhoneNumber(phoneNumber)) {
    await updateRawLog(supabase, rawLogId, { status: 'failed', error_message: '전화번호 형식 오류' })
    return apiError('유효한 전화번호 형식이 아닙니다. (예: 010-1234-5678 또는 01012345678)', 400)
  }

  if (inflowUrl && !isValidUrl(inflowUrl)) {
    await updateRawLog(supabase, rawLogId, { status: 'failed', error_message: 'URL 형식 오류' })
    return apiError('유효하지 않은 URL 형식입니다.', 400)
  }

  // clinic_id / landing_page_id 의 최종 확정은 아래 try 안에서 수행한다.
  // 폼이 보낸 값이 무효(__LP_DATA__ 미주입 시 하드코딩 fallback 문자열 등)여도
  // inflow_url 의 id= 와 landing_pages 조회로 귀속을 복구하기 위해 DB 접근이 필요하기 때문.

  // --- 데이터 가공 ---
  const normalizedPhone = normalizePhoneNumber(phoneNumber)
  const sanitizedName = name ? sanitizeString(name, 50) : undefined
  const sanitizedCampaignId = campaignId ? sanitizeString(campaignId, 100) : undefined
  const sanitizedSource = source ? sanitizeString(source, 50) : 'Unknown'

  const explicitUtm: Partial<UtmParams> = {
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
  }
  const urlUtm = inflowUrl ? parseUtmFromUrl(inflowUrl) : {}
  const finalUtm = sanitizeUtmParams(mergeUtmParams(explicitUtm, urlUtm))
  const finalSource = finalUtm.utm_source || sanitizedSource

  // clinic_id 는 catch 의 에러 로깅에서도 참조하므로 try 밖에서 선언, 안에서 확정
  let validClinicId = parseId(clinic_id)

  // --- 처리 ---
  try {
    // 0. clinic_id / landing_page_id 확정 (서버 복구)
    //   - landing_page_id: body 우선, 무효/누락 시 inflow_url 의 id= 로 복구
    //   - clinic_id: landing_pages 의 소속 병원을 진실의 원천으로 삼아 보정
    //     (폼이 __LP_DATA__ 미주입으로 fallback 문자열을 보내도 리드를 버리지 않음)
    let validLandingPageId: number | null = landing_page_id ? parseId(landing_page_id) : null
    if (validLandingPageId === null && inflowUrl) {
      validLandingPageId = parseLandingPageIdFromUrl(inflowUrl)
    }

    if (validLandingPageId !== null) {
      const { data: lp } = await supabase
        .from('landing_pages')
        .select('id, clinic_id')
        .eq('id', validLandingPageId)
        .maybeSingle()

      if (lp) {
        // 랜딩페이지가 실재 → 그 병원이 진짜 소속. clinic_id 보정/보강
        if (lp.clinic_id) {
          if (validClinicId !== null && validClinicId !== lp.clinic_id) {
            logger.warn('clinic_id 불일치 — 랜딩페이지 소속으로 보정', {
              bodyClinicId: validClinicId,
              landingPageClinicId: lp.clinic_id,
              landingPageId: validLandingPageId,
            })
          }
          validClinicId = lp.clinic_id
        }
      } else {
        // 존재하지 않는 landing_page_id → FK 위반 방지로 미연결 처리
        logger.warn('존재하지 않는 landing_page_id — 미연결로 저장', { landingPageId: validLandingPageId })
        validLandingPageId = null
      }
    }

    // 복구해도 병원을 특정할 수 없으면 그때만 거부 (이름/전화는 lead_raw_logs 에 보존됨)
    if (validClinicId === null) {
      await updateRawLog(supabase, rawLogId, { status: 'failed', error_message: 'clinic_id 확정 불가' })
      return apiError('clinic_id를 확인할 수 없습니다.', 400)
    }

    // 1. 고객 조회/생성 (clinic_id 기준으로 격리)
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .eq('clinic_id', validClinicId)
      .maybeSingle()

    let customer = existingCustomer
    if (!customer) {
      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert({
          phone_number: normalizedPhone,
          name: sanitizedName,
          first_source: finalSource,
          first_campaign_id: finalUtm.utm_campaign || sanitizedCampaignId,
          clinic_id: validClinicId,
        })
        .select()
        .single()
      if (error) throw error
      customer = newCustomer
    }

    // 2. 리드 생성
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        customer_id: customer.id,
        clinic_id: validClinicId,
        utm_source: finalUtm.utm_source,
        utm_medium: finalUtm.utm_medium,
        utm_campaign: finalUtm.utm_campaign,
        utm_content: finalUtm.utm_content,
        utm_term: finalUtm.utm_term,
        campaign_id: sanitizedCampaignId,
        inflow_url: inflowUrl ? sanitizeUrl(inflowUrl, 500) : null,
        chatbot_sent: false,
        landing_page_id: validLandingPageId,
        custom_data: { ...(custom_data || {}), name: sanitizedName || undefined },
      })
      .select()
      .single()
    if (leadError) throw leadError

    // raw 로그 → processed
    await updateRawLog(supabase, rawLogId, { status: 'processed', lead_id: lead.id })

    // 3. SMS 알림 — waitUntil 로 함수 응답 이후에도 promise 완료 보장 (서버리스 환경에서 응답 직후 fetch abort 방지)
    waitUntil((async () => {
      try {
        const { data: clinic } = await supabase
          .from('clinics')
          .select('notify_phone, notify_phones, notify_enabled, name')
          .eq('id', validClinicId)
          .single()

        if (clinic?.notify_enabled && process.env.SOLAPI_API_KEY) {
          const phones: string[] =
            (clinic.notify_phones && clinic.notify_phones.length > 0)
              ? clinic.notify_phones
              : (clinic.notify_phone ? [clinic.notify_phone] : [])

          if (phones.length > 0) {
            const { sendSmsWithLog } = await import('@/lib/solapi')
            const smsText = `[${clinic.name}] 상담 유입\n이름: ${sanitizedName || '미입력'}\n연락처: ${normalizedPhone}`
            const clinicId = validClinicId

            const results = await Promise.all(
              phones.map(phone =>
                sendSmsWithLog(supabase, {
                  to: phone,
                  text: smsText,
                  clinicId,
                  leadId: lead.id,
                }).catch(() => ({ success: false, logId: undefined, error: 'catch' }))
              )
            )

            // 실패 건 재시도 스케줄 (QStash 3분 후)
            if (process.env.QSTASH_TOKEN) {
              for (const r of results) {
                if (!r.success && r.logId) {
                  await qstash.publishJSON({
                    url: `${process.env.NEXTAUTH_URL}/api/qstash/sms-retry`,
                    body: { logId: r.logId },
                    delay: 180,
                  }).catch(() => {})
                }
              }
            }
          }
        }
      } catch (e) {
        logger.warn('SMS 알림 발송 실패 (non-blocking)', { error: e, leadId: lead.id })
      }
    })())

    // 4. QStash 챗봇 스케줄 — 카카오 알림톡 API 연동 전까지 비활성화
    // if (process.env.QSTASH_TOKEN && process.env.KAKAO_API_KEY) {
    //   await qstash.publishJSON({
    //     url: `${process.env.NEXTAUTH_URL}/api/qstash/chatbot`,
    //     body: { leadId: lead.id, phoneNumber: normalizedPhone, name: sanitizedName },
    //     delay: 300,
    //   })
    // }

    // 5. Meta CAPI Lead 이벤트 전송 — waitUntil 로 함수 응답 이후에도 fetch 유지 (이전엔 fire-and-forget 이라
    // 응답 직후 함수 종료 시 fetch 가 abort 되어 "This operation was aborted" 로 capi_events.fail 누적)
    // event_id 검증: UUID 형식이거나 100자 이내 영숫자+하이픈만 허용
    const isValidEventId = event_id && /^[a-zA-Z0-9\-]{1,100}$/.test(event_id)
    const capiEventId = isValidEventId ? event_id : crypto.randomUUID()
    waitUntil(
      sendCapiEvent(supabase, {
        clinicId: validClinicId,
        leadId: lead.id,
        eventName: 'Lead',
        eventId: capiEventId,
        userData: {
          phone: normalizedPhone,
          firstName: sanitizedName || undefined,
        },
        eventSourceUrl: inflowUrl ? sanitizeUrl(inflowUrl, 500) : undefined,
      }).catch((e) => {
        logger.warn('CAPI 전송 실패 (non-blocking)', { error: e, leadId: lead.id })
      })
    )

    return apiSuccess({
      success: true,
      message: '리드가 등록되고 담당자 알림 및 챗봇 발송이 스케줄되었습니다.',
      leadId: lead.id,
      customerId: customer.id,
      isNewCustomer: !existingCustomer,
      utm: finalUtm,
      eventId: capiEventId,
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    logger.error('리드 처리 실패', err as Error, { rawLogId, clinic_id: validClinicId })
    await updateRawLog(supabase, rawLogId, { status: 'failed', error_message: errorMsg })
    waitUntil(
      sendErrorAlert('lead_webhook_fail', `리드 처리 실패: ${errorMsg}`, { rawLogId, clinic_id: validClinicId }).catch(() => {})
    )
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

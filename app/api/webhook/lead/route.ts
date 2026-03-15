import { serverSupabase } from '@/lib/supabase'
import { apiError, apiSuccess } from '@/lib/api-middleware'
import { qstash } from '@/lib/qstash'
import {
  isValidPhoneNumber,
  isValidUrl,
  normalizePhoneNumber,
  sanitizeString,
  parseId,
} from '@/lib/security'
import {
  parseUtmFromUrl,
  sanitizeUtmParams,
  mergeUtmParams,
  type UtmParams,
} from '@/lib/utm'

export async function POST(req: Request) {
  let body: {
    name?: string
    phoneNumber?: string
    campaignId?: string
    source?: string
    inflowUrl?: string
    clinic_id?: number | string
    // UTM 파라미터 (개별 전달 가능)
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    utm_content?: string
    utm_term?: string
    // 랜딩 페이지 연동
    landing_page_id?: number | string
    custom_data?: Record<string, unknown>
  }

  try {
    body = await req.json()
  } catch {
    return apiError('잘못된 요청 형식입니다.', 400)
  }

  const {
    name,
    phoneNumber,
    campaignId,
    source,
    inflowUrl,
    clinic_id,
    // UTM 파라미터
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    // 랜딩 페이지 연동
    landing_page_id,
    custom_data,
  } = body

  // 전화번호 필수 검증
  if (!phoneNumber) {
    return apiError('전화번호는 필수입니다.', 400)
  }

  // 전화번호 형식 검증
  if (!isValidPhoneNumber(phoneNumber)) {
    return apiError('유효한 전화번호 형식이 아닙니다. (예: 010-1234-5678 또는 01012345678)', 400)
  }

  // URL 검증 (제공된 경우)
  if (inflowUrl && !isValidUrl(inflowUrl)) {
    return apiError('유효하지 않은 URL 형식입니다.', 400)
  }

  // clinic_id 필수 검증
  if (clinic_id === undefined || clinic_id === null || clinic_id === '') {
    return apiError('clinic_id는 필수입니다.', 400)
  }

  const validClinicId = parseId(clinic_id)
  if (validClinicId === null) {
    return apiError('유효하지 않은 clinic_id입니다.', 400)
  }

  // 전화번호 정규화 (하이픈 추가)
  const normalizedPhone = normalizePhoneNumber(phoneNumber)

  // 입력값 sanitize (XSS 방지)
  const sanitizedName = name ? sanitizeString(name, 50) : undefined
  const sanitizedCampaignId = campaignId ? sanitizeString(campaignId, 100) : undefined
  const sanitizedSource = source ? sanitizeString(source, 50) : 'Unknown'

  // UTM 파라미터 처리
  // 1. 명시적으로 전달된 UTM 파라미터
  const explicitUtm: Partial<UtmParams> = {
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
  }

  // 2. inflowUrl에서 UTM 추출 (fallback)
  const urlUtm = inflowUrl ? parseUtmFromUrl(inflowUrl) : {}

  // 3. 병합 및 sanitize (명시적 값 우선)
  const finalUtm = sanitizeUtmParams(mergeUtmParams(explicitUtm, urlUtm))

  // 4. first_source 결정: utm_source > source 파라미터 > 'Unknown'
  const finalSource = finalUtm.utm_source || sanitizedSource

  const supabase = serverSupabase()

  try {
    // 1. 고객 조회 (전화번호 기준)
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('*')
      .eq('phone_number', normalizedPhone)
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

    // landing_page_id 유효성 검증
    let validLandingPageId: number | null = null
    if (landing_page_id) {
      validLandingPageId = parseId(landing_page_id)
    }

    // 2. 리드 기록 생성 (UTM 필드 포함)
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        customer_id: customer.id,
        clinic_id: customer.clinic_id || validClinicId,
        // UTM 필드
        utm_source: finalUtm.utm_source,
        utm_medium: finalUtm.utm_medium,
        utm_campaign: finalUtm.utm_campaign,
        utm_content: finalUtm.utm_content,
        utm_term: finalUtm.utm_term,
        // 기존 필드 (하위 호환)
        campaign_id: sanitizedCampaignId,
        inflow_url: inflowUrl ? sanitizeString(inflowUrl, 500) : null,
        chatbot_sent: false,
        // 랜딩 페이지 연동
        landing_page_id: validLandingPageId,
        custom_data: custom_data || {},
      })
      .select()
      .single()
    if (leadError) throw leadError

    // 3. 병원 담당자 SMS 알림 발송 (즉시, 솔라피)
    try {
      const { data: clinic } = await supabase
        .from('clinics')
        .select('notify_phone, notify_enabled, name')
        .eq('id', customer.clinic_id || validClinicId)
        .single()

      if (clinic?.notify_enabled && clinic?.notify_phone && process.env.SOLAPI_API_KEY) {
        const { sendSms } = await import('@/lib/solapi')
        const campaignLabel = finalUtm.utm_campaign || '직접유입'
        await sendSms({
          to: clinic.notify_phone,
          text: `[${clinic.name}] 새 리드 유입\n이름: ${sanitizedName || '미입력'}\n연락처: ${normalizedPhone}\n캠페인: ${campaignLabel}`,
        }).catch(() => {}) // 알림 실패가 리드 등록을 막지 않도록
      }
    } catch {
      // 알림 발송 실패는 무시 (리드 등록은 이미 완료)
    }

    // 4. QStash로 5분 후 챗봇 발송 스케줄
    if (process.env.QSTASH_TOKEN) {
      await qstash.publishJSON({
        url: `${process.env.NEXTAUTH_URL}/api/qstash/chatbot`,
        body: { leadId: lead.id, phoneNumber: normalizedPhone, name: sanitizedName },
        delay: 300,
      })
    }

    return apiSuccess({
      success: true,
      message: '리드가 등록되고 담당자 알림 및 챗봇 발송이 스케줄되었습니다.',
      leadId: lead.id,
      customerId: customer.id,
      isNewCustomer: !existingCustomer,
      utm: finalUtm,
    })
  } catch (err: unknown) {
    console.error('[Webhook Error]', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

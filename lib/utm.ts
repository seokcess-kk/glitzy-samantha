/**
 * UTM 파라미터 처리 유틸리티
 * Phase 1: 데이터 연결
 */

export interface UtmParams {
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_content?: string | null
  utm_term?: string | null
}

/**
 * URL에서 UTM 파라미터 추출
 */
export function parseUtmFromUrl(url: string): UtmParams {
  try {
    const urlObj = new URL(url)
    const params = urlObj.searchParams

    return {
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
      utm_content: params.get('utm_content'),
      utm_term: params.get('utm_term'),
    }
  } catch {
    return {}
  }
}

/**
 * inflow_url 등 URL의 `id` 쿼리 파라미터에서 랜딩페이지 ID(양의 정수)를 추출.
 *
 * 랜딩페이지 폼이 `__LP_DATA__` 주입 실패로 무효한 clinic_id/landing_page_id
 * (예: 하드코딩 fallback 문자열)를 보냈을 때, 서버가 유입 주소로부터 귀속을
 * 복구하기 위한 폴백. iframe 렌더 URL(`/api/lp/render?id=...`)과 공개 URL
 * (`/lp?id=...`) 모두 `id=` 를 갖는다. 상대경로도 처리하도록 base를 지정.
 *
 * @returns 양의 정수 ID. 없거나 형식이 어긋나면 null
 */
export function parseLandingPageIdFromUrl(url: string | null | undefined): number | null {
  if (!url) return null
  try {
    const urlObj = new URL(url, 'https://samantha.glitzy.kr')
    const raw = urlObj.searchParams.get('id')
    if (!raw) return null
    const trimmed = raw.trim()
    const id = parseInt(trimmed, 10)
    // 정확히 숫자만으로 이뤄진 양의 정수일 때만 허용 ("123abc" 등 오인 방지)
    return Number.isInteger(id) && id > 0 && String(id) === trimmed ? id : null
  } catch {
    return null
  }
}

/**
 * UTM 파라미터 sanitize (XSS 방지, 길이 제한)
 */
export function sanitizeUtmParam(value: string | null | undefined, maxLength: number): string | null {
  if (!value) return null

  // 위험 문자 제거
  const sanitized = value
    .replace(/[<>"'&]/g, '')
    .trim()
    .slice(0, maxLength)

  return sanitized || null
}

/**
 * UTM 파라미터 객체 전체 sanitize
 */
export function sanitizeUtmParams(params: Partial<UtmParams>): UtmParams {
  return {
    utm_source: sanitizeUtmParam(params.utm_source, 50),
    utm_medium: sanitizeUtmParam(params.utm_medium, 50),
    utm_campaign: sanitizeUtmParam(params.utm_campaign, 100),
    utm_content: sanitizeUtmParam(params.utm_content, 200),
    utm_term: sanitizeUtmParam(params.utm_term, 100),
  }
}

/**
 * UTM 파라미터 병합 (명시적 값 > URL에서 추출한 값)
 *
 * @param explicit - API 요청으로 직접 전달된 UTM 파라미터
 * @param fromUrl - inflow_url에서 추출한 UTM 파라미터
 * @returns 병합된 UTM 파라미터 (명시적 값 우선)
 */
export function mergeUtmParams(explicit: Partial<UtmParams>, fromUrl: UtmParams): UtmParams {
  return {
    utm_source: explicit.utm_source || fromUrl.utm_source || null,
    utm_medium: explicit.utm_medium || fromUrl.utm_medium || null,
    utm_campaign: explicit.utm_campaign || fromUrl.utm_campaign || null,
    utm_content: explicit.utm_content || fromUrl.utm_content || null,
    utm_term: explicit.utm_term || fromUrl.utm_term || null,
  }
}

/**
 * UTM source를 표시용 라벨로 변환
 */
export function getUtmSourceLabel(source: string | null | undefined): string {
  if (!source) return 'Unknown'

  const labels: Record<string, string> = {
    'meta': 'Meta',
    'facebook': 'Meta',
    'instagram': 'Instagram',
    'google': 'Google',
    'naver': 'Naver',
    'kakao': 'Kakao',
    'tiktok': 'TikTok',
    'youtube': 'YouTube',
    'phone': 'Phone',
    'direct': 'Direct',
  }

  return labels[source.toLowerCase()] || source
}

/**
 * UTM medium을 표시용 라벨로 변환
 */
export function getUtmMediumLabel(medium: string | null | undefined): string {
  if (!medium) return ''

  const labels: Record<string, string> = {
    'cpc': 'CPC 광고',
    'display': '디스플레이',
    'video': '동영상',
    'short': '숏폼',
    'social': '소셜',
    'blog': '블로그',
    'organic': '자연유입',
    'referral': '레퍼럴',
    'email': '이메일',
  }

  return labels[medium.toLowerCase()] || medium
}

/**
 * UTM 파라미터로 URL 빌드
 */
export interface BuildUtmUrlOptions {
  baseUrl: string
  source?: string
  medium?: string
  campaign?: string
  content?: string
  term?: string
  adGroup?: string // content 앞에 prefix로 결합
}

export function buildUtmUrl(options: BuildUtmUrlOptions): string | null {
  const { baseUrl, source, medium, campaign, content, term, adGroup } = options

  if (!baseUrl?.trim()) return null

  try {
    const urlStr = baseUrl.trim().startsWith('http')
      ? baseUrl.trim()
      : 'https://' + baseUrl.trim()

    const url = new URL(urlStr)

    if (source) url.searchParams.set('utm_source', source)
    if (medium) url.searchParams.set('utm_medium', medium)
    if (campaign) url.searchParams.set('utm_campaign', campaign)

    // adGroup + content 결합
    const contentVal = adGroup && content
      ? `${adGroup}_${content}`
      : adGroup || content
    if (contentVal) url.searchParams.set('utm_content', contentVal)

    if (term) url.searchParams.set('utm_term', term)

    return url.toString()
  } catch {
    return null
  }
}

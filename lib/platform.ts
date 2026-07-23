/**
 * 광고 플랫폼 & 캠페인 타입 중앙 상수 모듈 (Single Source of Truth)
 *
 * 모든 플랫폼 관련 상수는 이 파일에서 import하여 사용.
 * 다른 파일에 플랫폼 목록을 하드코딩하지 말 것.
 */

// ═══ 1계층: API Platform (광고 API 연동 단위) ═══

export const API_PLATFORMS = [
  'meta_ads', 'google_ads', 'tiktok_ads',
  'naver_ads', 'kakao_ads', 'dable_ads',
] as const

export type ApiPlatform = (typeof API_PLATFORMS)[number]

/**
 * 광고 매체는 아니지만 병원별 API 설정 UI로 관리하는 부가 연동 플랫폼.
 * 광고 동기화(SYNC_ENABLED_PLATFORMS)·캠페인 타입·소재 등록 대상에는 포함되지 않는다.
 * - meta_capi: Meta Conversions API (전환 이벤트 서버 전송). pixel_id + access_token
 */
export const CONFIG_ONLY_PLATFORMS = ['meta_capi'] as const
export type ConfigOnlyPlatform = (typeof CONFIG_ONLY_PLATFORMS)[number]

/** API 설정 UI/라우트가 다루는 전체 플랫폼 (광고 매체 + 부가 연동) */
export type ConfigPlatform = ApiPlatform | ConfigOnlyPlatform

/** 동기화 활성 플랫폼 — adSyncManager에서 실제 API 호출 대상 */
export const SYNC_ENABLED_PLATFORMS: ApiPlatform[] = ['meta_ads', 'google_ads', 'tiktok_ads', 'dable_ads']

/** API 설정 UI에 표시할 플랫폼 (광고 매체 6개 + 부가 연동) */
export const API_CONFIG_PLATFORMS: readonly ConfigPlatform[] = [...API_PLATFORMS, ...CONFIG_ONLY_PLATFORMS]

/** 연결 테스트가 구현된 플랫폼 (설정 다이얼로그 '연결 테스트' 버튼 활성 기준) */
export const CONNECTION_TEST_PLATFORMS: readonly ConfigPlatform[] = [
  'meta_ads', 'google_ads', 'tiktok_ads', 'dable_ads', 'meta_capi',
]

export const API_PLATFORM_LABELS: Record<ConfigPlatform, string> = {
  meta_ads: 'Meta',
  google_ads: 'Google',
  tiktok_ads: 'TikTok',
  naver_ads: 'Naver',
  kakao_ads: 'Kakao',
  dable_ads: 'Dable',
  meta_capi: 'Meta CAPI',
}

export const API_PLATFORM_SHORT: Record<ConfigPlatform, string> = {
  meta_ads: 'M',
  google_ads: 'G',
  tiktok_ads: 'T',
  naver_ads: 'N',
  kakao_ads: 'K',
  dable_ads: 'D',
  meta_capi: 'CAPI',
}

/** 플랫폼별 API 키 필드 정의 */
export const API_PLATFORM_FIELDS: Record<ConfigPlatform, { key: string; label: string; placeholder: string }[]> = {
  meta_ads: [
    { key: 'account_id', label: '광고 계정 ID', placeholder: 'act_xxxxxxxxxx' },
    { key: 'access_token', label: '액세스 토큰', placeholder: '액세스 토큰을 입력하세요' },
  ],
  google_ads: [
    { key: 'customer_id', label: 'Customer ID', placeholder: '123-456-7890' },
    { key: 'login_customer_id', label: 'Login Customer ID (MCC, 선택 · 비우면 ENV fallback)', placeholder: '123-456-7890' },
    { key: 'client_id', label: 'Client ID (선택 · 비우면 ENV fallback)', placeholder: 'xxxxxx.apps.googleusercontent.com' },
    { key: 'client_secret', label: 'Client Secret (선택 · 비우면 ENV fallback)', placeholder: 'Client Secret을 입력하세요' },
    { key: 'developer_token', label: 'Developer Token (선택 · 비우면 ENV fallback)', placeholder: 'Developer Token을 입력하세요' },
    { key: 'refresh_token', label: 'Refresh Token (선택 · 비우면 ENV fallback)', placeholder: 'Refresh Token을 입력하세요' },
  ],
  tiktok_ads: [
    { key: 'advertiser_id', label: 'Advertiser ID', placeholder: 'Advertiser ID를 입력하세요' },
    { key: 'access_token', label: 'Access Token', placeholder: 'Access Token을 입력하세요' },
  ],
  naver_ads: [
    { key: 'customer_id', label: '고객 ID', placeholder: '네이버 광고 고객 ID' },
    { key: 'access_license', label: 'Access License', placeholder: 'API License' },
    { key: 'secret_key', label: 'Secret Key', placeholder: 'API Secret Key' },
  ],
  kakao_ads: [
    { key: 'ad_account_id', label: '광고계정 ID', placeholder: '카카오모먼트 광고계정 ID' },
    { key: 'access_token', label: 'Access Token', placeholder: 'Access Token을 입력하세요' },
  ],
  dable_ads: [
    { key: 'client_name', label: 'Client Name', placeholder: 'Dable 계정명 (예: dable.io)' },
    { key: 'api_key', label: 'API Key', placeholder: 'Dable API Key' },
  ],
  meta_capi: [
    { key: 'pixel_id', label: 'Pixel(데이터세트) ID', placeholder: '이벤트 데이터세트 ID (숫자)' },
    { key: 'access_token', label: 'CAPI 액세스 토큰', placeholder: '이벤트 관리자 → 전환 API에서 생성' },
  ],
}

/** 플랫폼별 API 저장 시 필수 필드 */
export const API_REQUIRED_FIELDS: Record<ConfigPlatform, string[]> = {
  meta_ads: ['account_id', 'access_token'],
  google_ads: ['customer_id'],
  tiktok_ads: ['advertiser_id', 'access_token'],
  naver_ads: ['customer_id', 'access_license', 'secret_key'],
  kakao_ads: ['ad_account_id', 'access_token'],
  dable_ads: ['client_name', 'api_key'],
  meta_capi: ['pixel_id', 'access_token'],
}

// ═══ 2계층: Campaign Type (플랫폼 하위) ═══

export const CAMPAIGN_TYPES_BY_PLATFORM: Record<ApiPlatform, string[]> = {
  meta_ads: ['feed', 'reels', 'stories', 'audience_network'],
  google_ads: ['search', 'gdn', 'demand_gen', 'pmax', 'youtube', 'app'],
  tiktok_ads: ['in_feed', 'topview'],
  naver_ads: ['search_ad', 'gfa', 'brand_search'],
  kakao_ads: ['moment', 'keyword', 'bizboard'],
  dable_ads: ['native'],
}

export const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  // Meta
  feed: 'Feed', reels: 'Reels', stories: 'Stories', audience_network: 'Audience Network',
  // Google
  search: '검색', gdn: 'GDN', demand_gen: 'Demand Gen', pmax: 'Performance Max', youtube: 'YouTube', app: 'App',
  // TikTok
  in_feed: 'In-Feed', topview: 'TopView',
  // Naver
  search_ad: '검색광고', gfa: 'GFA', brand_search: '브랜드검색',
  // Kakao
  moment: '모먼트', keyword: '키워드', bizboard: '비즈보드',
  // Dable
  native: 'Native',
}

// ═══ 소재 등록용 Platform ═══

export const CREATIVE_PLATFORMS = [
  { value: 'meta', label: 'Meta (Facebook/Instagram)', apiPlatform: 'meta_ads' as ApiPlatform },
  { value: 'google', label: 'Google Ads', apiPlatform: 'google_ads' as ApiPlatform },
  { value: 'naver', label: '네이버', apiPlatform: 'naver_ads' as ApiPlatform },
  { value: 'kakao', label: '카카오', apiPlatform: 'kakao_ads' as ApiPlatform },
  { value: 'tiktok', label: '틱톡', apiPlatform: 'tiktok_ads' as ApiPlatform },
  { value: 'youtube', label: '유튜브', apiPlatform: 'google_ads' as ApiPlatform },
  { value: 'dable', label: 'Dable', apiPlatform: 'dable_ads' as ApiPlatform },
  { value: 'other', label: '기타', apiPlatform: null },
] as const

export type CreativePlatform = (typeof CREATIVE_PLATFORMS)[number]['value']

// ═══ 플랫폼별 UTM Source 옵션 (플랫폼+매체유형 조합) ═══
// Source = 트래픽 출처 (플랫폼+매체유형), Medium = 과금 방식 (수기 입력)

export interface UtmSourceOption {
  value: string
  label: string
}

export const PLATFORM_UTM_SOURCES: Record<string, UtmSourceOption[]> = {
  meta:    [
    { value: 'meta_feed', label: 'Meta Feed' },
    { value: 'meta_reels', label: 'Meta Reels' },
    { value: 'meta_stories', label: 'Meta Stories' },
    { value: 'meta_audience', label: 'Meta Audience Network' },
  ],
  google:  [
    { value: 'google_search', label: 'Google 검색' },
    { value: 'google_gdn', label: 'Google GDN' },
    { value: 'google_pmax', label: 'Google PMax' },
    { value: 'google_demand_gen', label: 'Google Demand Gen' },
    { value: 'google_youtube', label: 'Google YouTube' },
  ],
  naver:   [
    { value: 'naver_sa', label: '네이버 검색광고 (SA)' },
    { value: 'naver_gfa', label: '네이버 GFA' },
    { value: 'naver_brand', label: '네이버 브랜드검색' },
  ],
  kakao:   [
    { value: 'kakao_moment', label: '카카오 모먼트' },
    { value: 'kakao_keyword', label: '카카오 키워드' },
    { value: 'kakao_bizboard', label: '카카오 비즈보드' },
  ],
  tiktok:  [
    { value: 'tiktok_feed', label: 'TikTok In-Feed' },
    { value: 'tiktok_topview', label: 'TikTok TopView' },
  ],
  youtube: [
    { value: 'youtube_video', label: 'YouTube 영상광고' },
    { value: 'youtube_shorts', label: 'YouTube Shorts' },
  ],
  dable:   [
    { value: 'dable_native', label: 'Dable Native' },
  ],
}

/** UTM source 값 → 사람이 읽을 수 있는 라벨 변환 */
export function getSourceLabel(source: string): string {
  for (const sources of Object.values(PLATFORM_UTM_SOURCES)) {
    const found = sources.find(s => s.value === source)
    if (found) return found.label
  }
  return source
}

/** UTM source 값 → 플랫폼 채널명 추출 (집계용, 예: 'google_search' → 'Google') */
export function sourceToChannel(source: string): string {
  if (!source) return 'Unknown'
  const prefix = source.split('_')[0]?.toLowerCase()
  const channelMap: Record<string, string> = {
    meta: 'Meta', google: 'Google', naver: 'Naver', kakao: 'Kakao',
    tiktok: 'TikTok', youtube: 'YouTube', dable: 'Dable',
    facebook: 'Meta', fb: 'Meta', ig: 'Instagram', instagram: 'Instagram',
  }
  return channelMap[prefix] || source
}

// ═══ 유틸 함수 ═══

export function isApiPlatform(value: unknown): value is ApiPlatform {
  return typeof value === 'string' && (API_PLATFORMS as readonly string[]).includes(value)
}

/** 광고 매체 + 부가 연동(meta_capi 등) 포함 — API 설정 라우트의 허용 검증용 */
export function isConfigPlatform(value: unknown): value is ConfigPlatform {
  return typeof value === 'string' && (API_CONFIG_PLATFORMS as readonly string[]).includes(value)
}

export function isSyncEnabled(platform: ApiPlatform): boolean {
  return SYNC_ENABLED_PLATFORMS.includes(platform)
}

/** 소재 등록용 platform → ApiPlatform 변환 (예: 'meta' → 'meta_ads') */
export function creativeToApiPlatform(platform: string): ApiPlatform | null {
  const found = CREATIVE_PLATFORMS.find(p => p.value === platform)
  return found?.apiPlatform ?? null
}

/** DB의 ApiPlatform → 소재 등록용 platform 변환 (예: 'meta_ads' → 'meta') */
export function apiToCreativePlatform(apiPlatform: string): string {
  const found = CREATIVE_PLATFORMS.find(p => p.apiPlatform === apiPlatform)
  return found?.value ?? apiPlatform
}

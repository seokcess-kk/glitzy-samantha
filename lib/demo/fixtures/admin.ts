/**
 * Demo 모드 admin 페이지용 fixture
 * - /admin/landing-pages, /admin/ad-creatives, /admin/clinics, /admin/users 시연용
 * - 실 DB 접근 없이 정적 데이터 반환
 * - ID 범위: LP 6001~, Creative 7001~, User 8001~ (실 데이터 ID와 충돌 회피)
 */

import { DEMO_CLINICS } from './clinics'

interface DemoLandingPage {
  id: number
  name: string
  file_name: string
  original_file_name: string | null
  clinic_id: number | null
  description: string | null
  is_active: boolean
  created_at: string
  clinic: { id: number; name: string } | null
}

interface DemoAdCreative {
  id: number
  name: string
  description: string | null
  utm_content: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  platform: string | null
  clinic_id: number
  landing_page_id: number | null
  is_active: boolean
  file_name: string | null
  file_type: string | null
  created_at: string
  clinic: { id: number; name: string } | null
  landing_page: { id: number; name: string; file_name: string } | null
}

interface DemoAdminUser {
  id: number
  username: string
  role: 'superadmin' | 'agency_staff' | 'clinic_admin' | 'clinic_staff'
  clinic_id: number | null
  is_active: boolean
  created_at: string
  clinic: { name: string } | null
}

interface DemoApiConfig {
  platform: string
  config: Record<string, unknown>
  is_active: boolean
  last_tested_at: string | null
  last_test_result: string | null
}

const KST = (iso: string) => iso

const LP_FIXTURES: DemoLandingPage[] = [
  { id: 6001, name: '강남점 보톡스 5월 프로모션', file_name: 'demo-lp-botox-may.html', original_file_name: 'botox-may-2026.html', clinic_id: 1001, description: '강남점 5월 한정 보톡스 패키지 LP', is_active: true, created_at: KST('2026-05-02T09:00:00+09:00'), clinic: { id: 1001, name: '글리치 강남점' } },
  { id: 6002, name: '강남점 울쎄라피 79만원', file_name: 'demo-lp-ulthera-79.html', original_file_name: 'ulthera-79.html', clinic_id: 1001, description: '울쎄라피 79만원 단독 상품 LP', is_active: true, created_at: KST('2026-04-18T09:00:00+09:00'), clinic: { id: 1001, name: '글리치 강남점' } },
  { id: 6003, name: '분당점 봄맞이 종합 케어', file_name: 'demo-lp-bundang-spring.html', original_file_name: 'bundang-spring.html', clinic_id: 1002, description: '봄맞이 종합 케어 패키지 LP', is_active: true, created_at: KST('2026-04-25T09:00:00+09:00'), clinic: { id: 1002, name: '글리치 분당점' } },
  { id: 6004, name: '스마일 코필러 신규 이벤트', file_name: 'demo-lp-smile-filler.html', original_file_name: 'smile-filler.html', clinic_id: 1003, description: '코필러 30만원대 진입 LP', is_active: true, created_at: KST('2026-05-08T09:00:00+09:00'), clinic: { id: 1003, name: '스마일 성형외과' } },
  { id: 6005, name: '프리미엄 레이저 토닝 5+1', file_name: 'demo-lp-premium-toning.html', original_file_name: 'premium-toning.html', clinic_id: 1004, description: '레이저 토닝 5회+1회 추가 패키지 LP', is_active: true, created_at: KST('2026-04-11T09:00:00+09:00'), clinic: { id: 1004, name: '프리미엄 피부과' } },
  { id: 6006, name: '프리미엄 여드름 클리닉', file_name: 'demo-lp-premium-acne.html', original_file_name: 'premium-acne.html', clinic_id: 1004, description: '여드름 집중 케어 4주 프로그램', is_active: false, created_at: KST('2026-03-20T09:00:00+09:00'), clinic: { id: 1004, name: '프리미엄 피부과' } },
  { id: 6007, name: '리본 임플란트 100만원대', file_name: 'demo-lp-ribbon-implant.html', original_file_name: 'ribbon-implant.html', clinic_id: 1005, description: '임플란트 단일 109만원 단일 상품 LP', is_active: true, created_at: KST('2026-04-30T09:00:00+09:00'), clinic: { id: 1005, name: '리본 치과' } },
  { id: 6008, name: '맑은눈 라식 50% 할인', file_name: 'demo-lp-clear-lasik.html', original_file_name: 'clear-lasik.html', clinic_id: 1006, description: '라식 검진 무료 + 시술 할인 LP', is_active: true, created_at: KST('2026-05-05T09:00:00+09:00'), clinic: { id: 1006, name: '맑은눈 안과' } },
]

const CREATIVE_FIXTURES: DemoAdCreative[] = [
  { id: 7001, name: '울쎄라피_79_c', description: '울쎄라피 79만원 메인 광고', utm_content: 'ulthera_79_c', utm_source: 'meta', utm_medium: 'cpc', utm_campaign: '2605_ulthera', utm_term: null, platform: 'meta_ads', clinic_id: 1001, landing_page_id: 6002, is_active: true, file_name: null, file_type: 'image/jpeg', created_at: KST('2026-04-20T09:00:00+09:00'), clinic: { id: 1001, name: '글리치 강남점' }, landing_page: { id: 6002, name: '강남점 울쎄라피 79만원', file_name: 'demo-lp-ulthera-79.html' } },
  { id: 7002, name: '울쎄라피_79_b', description: '울쎄라피 79만원 B안', utm_content: 'ulthera_79_b', utm_source: 'meta', utm_medium: 'cpc', utm_campaign: '2605_ulthera', utm_term: null, platform: 'meta_ads', clinic_id: 1001, landing_page_id: 6002, is_active: true, file_name: null, file_type: 'image/jpeg', created_at: KST('2026-04-20T09:00:00+09:00'), clinic: { id: 1001, name: '글리치 강남점' }, landing_page: { id: 6002, name: '강남점 울쎄라피 79만원', file_name: 'demo-lp-ulthera-79.html' } },
  { id: 7003, name: '보톡스 5월', description: '보톡스 5월 프로모션', utm_content: 'botox_may', utm_source: 'meta', utm_medium: 'cpc', utm_campaign: '2605_botox', utm_term: null, platform: 'meta_ads', clinic_id: 1001, landing_page_id: 6001, is_active: true, file_name: null, file_type: 'image/jpeg', created_at: KST('2026-05-02T10:00:00+09:00'), clinic: { id: 1001, name: '글리치 강남점' }, landing_page: { id: 6001, name: '강남점 보톡스 5월 프로모션', file_name: 'demo-lp-botox-may.html' } },
  { id: 7004, name: '강남 검색광고 A', description: 'Google 검색 광고 A안', utm_content: 'gangnam_search_a', utm_source: 'google', utm_medium: 'cpc', utm_campaign: '2605_search', utm_term: '강남 성형외과', platform: 'google_ads', clinic_id: 1001, landing_page_id: 6001, is_active: true, file_name: null, file_type: null, created_at: KST('2026-04-10T09:00:00+09:00'), clinic: { id: 1001, name: '글리치 강남점' }, landing_page: { id: 6001, name: '강남점 보톡스 5월 프로모션', file_name: 'demo-lp-botox-may.html' } },
  { id: 7005, name: '분당 봄케어 메인', description: '분당점 봄 케어 메인 영상', utm_content: 'bundang_spring_v1', utm_source: 'meta', utm_medium: 'cpc', utm_campaign: '2604_spring', utm_term: null, platform: 'meta_ads', clinic_id: 1002, landing_page_id: 6003, is_active: true, file_name: null, file_type: 'video/mp4', created_at: KST('2026-04-25T09:00:00+09:00'), clinic: { id: 1002, name: '글리치 분당점' }, landing_page: { id: 6003, name: '분당점 봄맞이 종합 케어', file_name: 'demo-lp-bundang-spring.html' } },
  { id: 7006, name: '스마일 코필러 메인', description: '스마일 성형외과 코필러 메인', utm_content: 'smile_filler_main', utm_source: 'tiktok', utm_medium: 'cpc', utm_campaign: '2605_filler', utm_term: null, platform: 'tiktok_ads', clinic_id: 1003, landing_page_id: 6004, is_active: true, file_name: null, file_type: 'video/mp4', created_at: KST('2026-05-08T09:00:00+09:00'), clinic: { id: 1003, name: '스마일 성형외과' }, landing_page: { id: 6004, name: '스마일 코필러 신규 이벤트', file_name: 'demo-lp-smile-filler.html' } },
  { id: 7007, name: '프리미엄 토닝 패키지', description: '레이저 토닝 5+1 광고', utm_content: 'premium_toning_5plus1', utm_source: 'meta', utm_medium: 'cpc', utm_campaign: '2604_toning', utm_term: null, platform: 'meta_ads', clinic_id: 1004, landing_page_id: 6005, is_active: true, file_name: null, file_type: 'image/jpeg', created_at: KST('2026-04-12T09:00:00+09:00'), clinic: { id: 1004, name: '프리미엄 피부과' }, landing_page: { id: 6005, name: '프리미엄 레이저 토닝 5+1', file_name: 'demo-lp-premium-toning.html' } },
  { id: 7008, name: '프리미엄 검색광고', description: '피부과 일반 검색', utm_content: 'premium_search_general', utm_source: 'google', utm_medium: 'cpc', utm_campaign: '2605_general', utm_term: '강남 피부과', platform: 'google_ads', clinic_id: 1004, landing_page_id: 6005, is_active: true, file_name: null, file_type: null, created_at: KST('2026-04-12T09:00:00+09:00'), clinic: { id: 1004, name: '프리미엄 피부과' }, landing_page: { id: 6005, name: '프리미엄 레이저 토닝 5+1', file_name: 'demo-lp-premium-toning.html' } },
  { id: 7009, name: '리본 임플란트 메인', description: '임플란트 109만원 메인', utm_content: 'ribbon_implant_109', utm_source: 'meta', utm_medium: 'cpc', utm_campaign: '2604_implant', utm_term: null, platform: 'meta_ads', clinic_id: 1005, landing_page_id: 6007, is_active: true, file_name: null, file_type: 'image/jpeg', created_at: KST('2026-04-30T09:00:00+09:00'), clinic: { id: 1005, name: '리본 치과' }, landing_page: { id: 6007, name: '리본 임플란트 100만원대', file_name: 'demo-lp-ribbon-implant.html' } },
  { id: 7010, name: '맑은눈 라식 메인', description: '라식 무료 검진 메인', utm_content: 'clear_lasik_main', utm_source: 'meta', utm_medium: 'cpc', utm_campaign: '2605_lasik', utm_term: null, platform: 'meta_ads', clinic_id: 1006, landing_page_id: 6008, is_active: true, file_name: null, file_type: 'image/jpeg', created_at: KST('2026-05-05T09:00:00+09:00'), clinic: { id: 1006, name: '맑은눈 안과' }, landing_page: { id: 6008, name: '맑은눈 라식 50% 할인', file_name: 'demo-lp-clear-lasik.html' } },
  { id: 7011, name: '맑은눈 검색광고', description: '라식 검색', utm_content: 'clear_lasik_search', utm_source: 'naver', utm_medium: 'cpc', utm_campaign: '2605_lasik_search', utm_term: '라식 비용', platform: 'naver_ads', clinic_id: 1006, landing_page_id: 6008, is_active: true, file_name: null, file_type: null, created_at: KST('2026-05-05T09:00:00+09:00'), clinic: { id: 1006, name: '맑은눈 안과' }, landing_page: { id: 6008, name: '맑은눈 라식 50% 할인', file_name: 'demo-lp-clear-lasik.html' } },
  { id: 7012, name: '프리미엄 여드름 (비활성)', description: '여드름 4주 프로그램 광고', utm_content: 'premium_acne_4w', utm_source: 'meta', utm_medium: 'cpc', utm_campaign: '2603_acne', utm_term: null, platform: 'meta_ads', clinic_id: 1004, landing_page_id: 6006, is_active: false, file_name: null, file_type: 'image/jpeg', created_at: KST('2026-03-20T09:00:00+09:00'), clinic: { id: 1004, name: '프리미엄 피부과' }, landing_page: { id: 6006, name: '프리미엄 여드름 클리닉', file_name: 'demo-lp-premium-acne.html' } },
]

const USER_FIXTURES: DemoAdminUser[] = [
  { id: 8001, username: 'superadmin', role: 'superadmin', clinic_id: null, is_active: true, created_at: KST('2025-01-01T09:00:00+09:00'), clinic: null },
  { id: 8002, username: 'glitzy_gangnam_admin', role: 'clinic_admin', clinic_id: 1001, is_active: true, created_at: KST('2025-02-15T09:00:00+09:00'), clinic: { name: '글리치 강남점' } },
  { id: 8003, username: 'glitzy_gangnam_staff1', role: 'clinic_staff', clinic_id: 1001, is_active: true, created_at: KST('2025-03-02T09:00:00+09:00'), clinic: { name: '글리치 강남점' } },
  { id: 8004, username: 'glitzy_gangnam_staff2', role: 'clinic_staff', clinic_id: 1001, is_active: true, created_at: KST('2025-03-02T09:00:00+09:00'), clinic: { name: '글리치 강남점' } },
  { id: 8005, username: 'glitzy_bundang_admin', role: 'clinic_admin', clinic_id: 1002, is_active: true, created_at: KST('2025-02-20T09:00:00+09:00'), clinic: { name: '글리치 분당점' } },
  { id: 8006, username: 'smile_admin', role: 'clinic_admin', clinic_id: 1003, is_active: true, created_at: KST('2025-03-10T09:00:00+09:00'), clinic: { name: '스마일 성형외과' } },
  { id: 8007, username: 'premium_admin', role: 'clinic_admin', clinic_id: 1004, is_active: true, created_at: KST('2025-01-25T09:00:00+09:00'), clinic: { name: '프리미엄 피부과' } },
  { id: 8008, username: 'ribbon_admin', role: 'clinic_admin', clinic_id: 1005, is_active: true, created_at: KST('2025-04-05T09:00:00+09:00'), clinic: { name: '리본 치과' } },
  { id: 8009, username: 'clear_admin', role: 'clinic_admin', clinic_id: 1006, is_active: true, created_at: KST('2025-04-12T09:00:00+09:00'), clinic: { name: '맑은눈 안과' } },
  { id: 8010, username: 'glitzy_marketing', role: 'agency_staff', clinic_id: null, is_active: true, created_at: KST('2025-03-15T09:00:00+09:00'), clinic: null },
  { id: 8011, username: 'glitzy_marketing2', role: 'agency_staff', clinic_id: null, is_active: false, created_at: KST('2025-02-08T09:00:00+09:00'), clinic: null },
]

/** /api/admin/landing-pages 응답 (includeFiles 여부와 무관하게 객체로 통일) */
export function demoAdminLandingPagesResponse(clinicId: number | null) {
  const filtered = clinicId ? LP_FIXTURES.filter(lp => lp.clinic_id === clinicId) : LP_FIXTURES
  return {
    landingPages: filtered,
    availableFiles: ['demo-lp-botox-may.html', 'demo-lp-ulthera-79.html', 'demo-lp-bundang-spring.html', 'demo-lp-smile-filler.html', 'demo-lp-premium-toning.html', 'demo-lp-ribbon-implant.html', 'demo-lp-clear-lasik.html', 'demo-lp-premium-acne.html'],
  }
}

/** /api/admin/landing-pages/[id] (GET) */
export function demoAdminLandingPage(id: number) {
  return LP_FIXTURES.find(lp => lp.id === id) || null
}

/** /api/admin/landing-pages/stats — withClinicFilter 라 clinic_id 적용 */
export function demoAdminLandingPageStats(clinicId: number | null) {
  const lps = clinicId ? LP_FIXTURES.filter(lp => lp.clinic_id === clinicId) : LP_FIXTURES
  return lps.map(lp => {
    // 그럴듯한 통계 — id 기반 deterministic
    const seed = lp.id
    const leads = 30 + (seed % 7) * 18
    const bookings = Math.round(leads * (0.35 + (seed % 5) * 0.04))
    const paying = Math.round(bookings * (0.55 + (seed % 4) * 0.05))
    const revenue = paying * (450_000 + (seed % 6) * 80_000)
    return {
      landing_page_id: lp.id,
      lead_count: leads,
      booking_count: bookings,
      paying_customers: paying,
      revenue,
      booking_rate: leads > 0 ? Math.round((bookings / leads) * 1000) / 10 : 0,
      conversion_rate: leads > 0 ? Math.round((paying / leads) * 1000) / 10 : 0,
    }
  })
}

/** /api/admin/ad-creatives */
export function demoAdminAdCreatives(clinicId: number | null) {
  return clinicId ? CREATIVE_FIXTURES.filter(c => c.clinic_id === clinicId) : CREATIVE_FIXTURES
}

/** /api/admin/ad-creatives/[id] */
export function demoAdminAdCreative(id: number) {
  return CREATIVE_FIXTURES.find(c => c.id === id) || null
}

/** /api/admin/clinics/[id]/api-configs — 가짜 활성 매체 설정 (민감 필드는 빈값) */
export function demoAdminClinicApiConfigs(clinicId: number): DemoApiConfig[] {
  const clinic = DEMO_CLINICS.find(c => c.id === clinicId)
  if (!clinic) return []
  // 모든 데모 병원은 Meta/Google 활성, 일부는 TikTok 추가
  const configs: DemoApiConfig[] = [
    { platform: 'meta_ads', config: { account_id: `act_${1000000000000000 + clinicId}`, access_token: '****demo' }, is_active: true, last_tested_at: '2026-05-12T09:00:00+09:00', last_test_result: 'success' },
    { platform: 'google_ads', config: { customer_id: `${100 + clinicId}-${200 + clinicId}-${300 + clinicId}`, client_id: '****demo', client_secret: '****demo', developer_token: '****demo', refresh_token: '****demo' }, is_active: true, last_tested_at: '2026-05-12T09:00:00+09:00', last_test_result: 'success' },
  ]
  if (clinic.platformShare.tiktok > 0.2) {
    configs.push({ platform: 'tiktok_ads', config: { advertiser_id: `${7000000000000000 + clinicId}`, access_token: '****demo' }, is_active: true, last_tested_at: '2026-05-12T09:00:00+09:00', last_test_result: 'success' })
  }
  return configs
}

/** /api/admin/users */
export function demoAdminUsers() {
  return USER_FIXTURES
}

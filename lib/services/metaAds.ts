import { serverSupabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/api-client'
import { createLogger } from '@/lib/logger'
import { getKstDateString } from '@/lib/date'

const SERVICE_NAME = 'MetaAds'
const logger = createLogger(SERVICE_NAME)

// Meta Graph API 버전 — 업그레이드 시 이 한 줄만 변경
// 분기별 changelog 점검: https://developers.facebook.com/docs/marketing-api/changelog
const META_API_VERSION = 'v25.0'
const META_GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`

// 응답이 "필드 존재하지 않음"(deprecation) 패턴인지 감지
// 다음 버전 업그레이드 또는 Meta의 일방적 필드 제거 시 즉시 인지 가능
function isFieldRemovedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = (err as { error?: { code?: number; message?: string } }).error
  if (!e) return false
  return e.code === 100 && typeof e.message === 'string' && /nonexisting field/i.test(e.message)
}

export interface MetaAdsOptions {
  clinicId?: number
  accountId?: string
  accessToken?: string
}

export async function fetchMetaAds(date = new Date(), options?: MetaAdsOptions) {
  const dateStr = getKstDateString(date)
  const startTime = Date.now()

  // options 제공 시 options 사용, 아닐 시 환경변수 폴백
  const accountId = options?.accountId || process.env.META_AD_ACCOUNT_ID
  const accessToken = options?.accessToken || process.env.META_ACCESS_TOKEN
  if (!accountId || !accessToken) {
    logger.warn('Missing META_AD_ACCOUNT_ID or META_ACCESS_TOKEN', { clinicId: options?.clinicId })
    return { platform: 'meta_ads', count: 0, error: 'Missing credentials' }
  }

  const supabase = serverSupabase()

  try {
    // access_token은 URL이 아닌 Authorization 헤더로 전달 (보안)
    const url = `${META_GRAPH_BASE}/${accountId}/insights?` +
      new URLSearchParams({
        level: 'campaign',
        fields: 'campaign_id,campaign_name,spend,clicks,impressions',
        time_range: JSON.stringify({ since: dateStr, until: dateStr }),
        time_increment: '1',
      })

    const { response } = await fetchWithRetry(url, {
      service: SERVICE_NAME,
      timeout: 30000,
      retries: 3,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const err = await response.json()
      if (isFieldRemovedError(err)) {
        logger.error('Meta API 필드 제거 감지 (campaign insights) — 버전 호환성 점검 필요', new Error(JSON.stringify(err)), { version: META_API_VERSION, clinicId: options?.clinicId })
      }
      throw new Error(`Meta API error: ${JSON.stringify(err)}`)
    }

    const json = await response.json()
    const campaigns = json.data || []

    // 배치 처리
    if (campaigns.length > 0) {
      const rows = campaigns.map((c: Record<string, string>) => ({
        platform: 'meta_ads',
        campaign_id: c.campaign_id,
        campaign_name: c.campaign_name,
        spend_amount: parseFloat(c.spend || '0'),
        clicks: parseInt(c.clicks || '0'),
        impressions: parseInt(c.impressions || '0'),
        stat_date: dateStr,
        clinic_id: options?.clinicId || null,
      }))

      // clinic_id가 NULL이면 partial unique index 사용 (폴백 모드)
      const onConflict = options?.clinicId
        ? 'clinic_id,platform,campaign_id,stat_date'
        : 'platform,campaign_id,stat_date'
      const { error } = await supabase
        .from('ad_campaign_stats')
        .upsert(rows, { onConflict })

      if (error) {
        logger.error('DB upsert error', error, { clinicId: options?.clinicId })
      }
    }

    const duration = Date.now() - startTime
    logger.info('Sync completed', { action: 'sync', count: campaigns.length, duration, clinicId: options?.clinicId })

    return { platform: 'meta_ads', count: campaigns.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Sync failed', error, { action: 'sync', duration: Date.now() - startTime, clinicId: options?.clinicId })
    return { platform: 'meta_ads', count: 0, error: message }
  }
}

// url_tags 문자열에서 utm_content 추출
function parseUtmContentFromUrlTags(urlTags: string | null | undefined): string | null {
  if (!urlTags) return null
  try {
    return new URLSearchParams(urlTags).get('utm_content') || null
  } catch {
    return null
  }
}

// 전체 URL에서 utm_content 쿼리 파라미터 추출
function parseUtmContentFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.searchParams.get('utm_content') || null
  } catch {
    return null
  }
}

// creative 객체에서 utm_content를 폴백 체인으로 추출
// Graph API에서 creative.effective_link 필드는 제거됨 → object_story_spec / asset_feed_spec 사용
function extractUtmContentFromCreative(creative: unknown): string | null {
  if (!creative || typeof creative !== 'object') return null
  const c = creative as Record<string, unknown>

  // 1) url_tags (광고 레벨 URL Parameters)
  const utmFromTags = parseUtmContentFromUrlTags(c.url_tags as string | undefined)
  if (utmFromTags) return utmFromTags

  // 2) object_story_spec.link_data.link (외부 트래픽/일반 페이지 게시물 광고)
  const oss = c.object_story_spec as Record<string, unknown> | undefined
  if (oss && typeof oss === 'object') {
    const linkData = oss.link_data as Record<string, unknown> | undefined
    const link = linkData?.link as string | undefined
    const utmFromLink = parseUtmContentFromUrl(link)
    if (utmFromLink) return utmFromLink

    // 3) video_data.call_to_action.value.link (동영상 광고)
    const videoData = oss.video_data as Record<string, unknown> | undefined
    const cta = videoData?.call_to_action as Record<string, unknown> | undefined
    const ctaValue = cta?.value as Record<string, unknown> | undefined
    const ctaLink = ctaValue?.link as string | undefined
    const utmFromCta = parseUtmContentFromUrl(ctaLink)
    if (utmFromCta) return utmFromCta
  }

  // 4) asset_feed_spec.link_urls[*].website_url (Advantage+ / Dynamic Creative)
  const afs = c.asset_feed_spec as Record<string, unknown> | undefined
  const linkUrls = afs?.link_urls as Array<Record<string, unknown>> | undefined
  if (Array.isArray(linkUrls)) {
    for (const entry of linkUrls) {
      const websiteUrl = entry?.website_url as string | undefined
      const utmFromAfs = parseUtmContentFromUrl(websiteUrl)
      if (utmFromAfs) return utmFromAfs
    }
  }

  return null
}

interface MetaAdInsight {
  ad_id: string
  ad_name: string
  campaign_id: string
  campaign_name: string
  spend: string
  clicks: string
  impressions: string
}

/**
 * Meta 광고(ad) 레벨 일별 성과 수집
 * - insights?level=ad 로 ad별 spend/clicks/impressions 조회
 * - 각 ad의 creative url_tags/effective_link에서 utm_content 추출
 * - ad_stats 테이블에 upsert
 */
export async function fetchMetaAdStats(date = new Date(), options?: MetaAdsOptions) {
  const dateStr = getKstDateString(date)
  const startTime = Date.now()

  const accountId = options?.accountId || process.env.META_AD_ACCOUNT_ID
  const accessToken = options?.accessToken || process.env.META_ACCESS_TOKEN
  if (!accountId || !accessToken) {
    return { platform: 'meta_ads', count: 0, error: 'Missing credentials' }
  }

  const supabase = serverSupabase()

  try {
    // 1. Ad 레벨 인사이트 조회 (페이지네이션)
    const allAds: MetaAdInsight[] = []
    let nextUrl: string | null = `${META_GRAPH_BASE}/${accountId}/insights?` +
      new URLSearchParams({
        level: 'ad',
        fields: 'ad_id,ad_name,campaign_id,campaign_name,spend,clicks,impressions',
        time_range: JSON.stringify({ since: dateStr, until: dateStr }),
        time_increment: '1',
        limit: '500',
      })

    while (nextUrl) {
      const { response } = await fetchWithRetry(nextUrl, {
        service: SERVICE_NAME,
        timeout: 30000,
        retries: 3,
        headers: { 'Authorization': `Bearer ${accessToken}` },
      })

      if (!response.ok) {
        const err = await response.json()
        if (isFieldRemovedError(err)) {
          logger.error('Meta API 필드 제거 감지 (ad insights) — 버전 호환성 점검 필요', new Error(JSON.stringify(err)), { version: META_API_VERSION, clinicId: options?.clinicId })
        }
        throw new Error(`Meta API error (ad level): ${JSON.stringify(err)}`)
      }

      const json = await response.json()
      allAds.push(...(json.data || []))
      nextUrl = json.paging?.next || null
    }

    if (allAds.length === 0) {
      return { platform: 'meta_ads', count: 0 }
    }

    // 2. utm_content 매핑 — 기존 캐시 로드 후 새 ad_id만 Meta API 조회
    const adIds = [...new Set(allAds.map(a => a.ad_id))]

    // DB에서 기존 ad_id→utm_content 캐시
    const utmCache = new Map<string, string | null>()
    const { data: existingRows } = await supabase
      .from('ad_stats')
      .select('ad_id, utm_content')
      .in('ad_id', adIds)
      .not('utm_content', 'is', null)

    for (const row of existingRows || []) {
      utmCache.set(row.ad_id, row.utm_content)
    }

    // 캐시에 없는 ad_id → utm_content 추출 (url_tags → object_story_spec → asset_feed_spec)
    // Graph API에서 creative.effective_link는 제거됨. 폴백 체인은 extractUtmContentFromCreative 참조.
    const uncachedIds = adIds.filter(id => !utmCache.has(id))
    const creativeFields = 'creative{url_tags,object_story_spec{link_data{link},video_data{call_to_action}},asset_feed_spec{link_urls}}'
    for (const adId of uncachedIds) {
      try {
        const creativeUrl = `${META_GRAPH_BASE}/${adId}?fields=${creativeFields}`
        const { response: cRes } = await fetchWithRetry(creativeUrl, {
          service: SERVICE_NAME,
          timeout: 10000,
          retries: 2,
          headers: { 'Authorization': `Bearer ${accessToken}` },
        })
        if (cRes.ok) {
          const cJson = await cRes.json()
          utmCache.set(adId, extractUtmContentFromCreative(cJson?.creative))
        } else {
          // 필드 제거(deprecation) 패턴이면 명시적 로깅 — 운영자가 즉시 인지하고 폴백 체인 추가 가능
          try {
            const err = await cRes.json()
            if (isFieldRemovedError(err)) {
              logger.error('Meta API 필드 제거 감지 (ad creative) — 폴백 체인 보강 필요', new Error(JSON.stringify(err)), { adId, version: META_API_VERSION, clinicId: options?.clinicId })
            }
          } catch { /* JSON 파싱 실패 무시 */ }
          utmCache.set(adId, null)
        }
      } catch {
        utmCache.set(adId, null)
      }
    }

    // 3. ad_stats upsert
    const rows = allAds.map(a => ({
      platform: 'meta_ads',
      ad_id: a.ad_id,
      ad_name: a.ad_name,
      campaign_id: a.campaign_id,
      campaign_name: a.campaign_name,
      utm_content: utmCache.get(a.ad_id) || null,
      spend_amount: parseFloat(a.spend || '0'),
      clicks: parseInt(a.clicks || '0'),
      impressions: parseInt(a.impressions || '0'),
      stat_date: dateStr,
      clinic_id: options?.clinicId || null,
    }))

    const onConflict = options?.clinicId
      ? 'clinic_id,platform,ad_id,stat_date'
      : 'platform,ad_id,stat_date'
    const { error } = await supabase
      .from('ad_stats')
      .upsert(rows, { onConflict })

    if (error) {
      logger.error('ad_stats upsert error', error, { clinicId: options?.clinicId })
    }

    const duration = Date.now() - startTime
    logger.info('Ad-level sync completed', {
      action: 'sync_ad_level',
      count: allAds.length,
      newUtmMappings: uncachedIds.length,
      duration,
      clinicId: options?.clinicId,
    })

    return { platform: 'meta_ads', count: allAds.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Ad-level sync failed', error, { action: 'sync_ad_level', duration: Date.now() - startTime, clinicId: options?.clinicId })
    return { platform: 'meta_ads', count: 0, error: message }
  }
}

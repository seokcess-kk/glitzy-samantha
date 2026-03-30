import { serverSupabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/api-client'
import { createLogger } from '@/lib/logger'
import { getKstDateString } from '@/lib/date'

const SERVICE_NAME = 'TikTokAds'
const logger = createLogger(SERVICE_NAME)
const BASE_URL = 'https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/'

interface TikTokCampaign {
  dimensions: {
    campaign_id: string
  }
  metrics: {
    campaign_name: string
    spend: string
    clicks: string
    impressions: string
  }
}

interface TikTokAd {
  dimensions: {
    ad_id: string
    stat_time_day: string
  }
  metrics: {
    ad_name: string
    campaign_id: string
    campaign_name: string
    spend: string
    clicks: string
    impressions: string
  }
}

export interface TikTokAdsOptions {
  clinicId?: number
  advertiserId?: string
  accessToken?: string
}

export async function fetchTikTokAds(date = new Date(), options?: TikTokAdsOptions) {
  const dateStr = getKstDateString(date)
  const startTime = Date.now()

  const advertiserId = options?.advertiserId || process.env.TIKTOK_ADVERTISER_ID
  const accessToken = options?.accessToken || process.env.TIKTOK_ACCESS_TOKEN
  if (!advertiserId || !accessToken) {
    logger.warn('Missing TIKTOK_ADVERTISER_ID or TIKTOK_ACCESS_TOKEN', { clinicId: options?.clinicId })
    return { platform: 'TikTok', count: 0, error: 'Missing credentials' }
  }

  const supabase = serverSupabase()

  try {
    // 페이지네이션으로 전체 캠페인 데이터 수집
    const allCampaigns: TikTokCampaign[] = []
    let page = 1
    const pageSize = 200

    while (true) {
      const url = new URL(BASE_URL)
      url.searchParams.set('advertiser_id', advertiserId)
      url.searchParams.set('report_type', 'BASIC')
      url.searchParams.set('data_level', 'AUCTION_CAMPAIGN')
      url.searchParams.set('dimensions', JSON.stringify(['campaign_id', 'stat_time_day']))
      url.searchParams.set('metrics', JSON.stringify(['campaign_name', 'spend', 'clicks', 'impressions']))
      url.searchParams.set('start_date', dateStr)
      url.searchParams.set('end_date', dateStr)
      url.searchParams.set('page', String(page))
      url.searchParams.set('page_size', String(pageSize))

      const { response } = await fetchWithRetry(url.toString(), {
        headers: { 'Access-Token': accessToken },
        service: SERVICE_NAME,
        timeout: 30000,
        retries: 3,
      })

      if (!response.ok) {
        throw new Error(`TikTok API error: ${response.statusText}`)
      }

      const json = await response.json()
      if (json.code !== 0) {
        throw new Error(`TikTok API error: ${json.message || 'Unknown'}`)
      }

      const campaigns: TikTokCampaign[] = json.data?.list || []
      allCampaigns.push(...campaigns)

      const totalPage = json.data?.page_info?.total_page || 1
      if (page >= totalPage) break
      page++
    }

    // 배치 처리
    if (allCampaigns.length > 0) {
      const rows = allCampaigns.map((c) => ({
        platform: 'TikTok',
        campaign_id: c.dimensions.campaign_id,
        campaign_name: c.metrics.campaign_name,
        spend_amount: parseFloat(c.metrics.spend || '0'),
        clicks: parseInt(c.metrics.clicks || '0'),
        impressions: parseInt(c.metrics.impressions || '0'),
        stat_date: dateStr,
        clinic_id: options?.clinicId || null,
      }))

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
    logger.info('Sync completed', { action: 'sync', count: allCampaigns.length, duration, clinicId: options?.clinicId })

    return { platform: 'TikTok', count: allCampaigns.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Sync failed', error, { action: 'sync', duration: Date.now() - startTime, clinicId: options?.clinicId })
    return { platform: 'TikTok', count: 0, error: message }
  }
}

/**
 * TikTok Ad 레벨 성과 수집 (소재별 성과용)
 * - data_level=AUCTION_AD → ad_stats 테이블에 저장
 * - 페이지네이션 지원 (page_size=200)
 */
export async function fetchTikTokAdStats(date = new Date(), options?: TikTokAdsOptions) {
  const dateStr = getKstDateString(date)
  const startTime = Date.now()

  const advertiserId = options?.advertiserId || process.env.TIKTOK_ADVERTISER_ID
  const accessToken = options?.accessToken || process.env.TIKTOK_ACCESS_TOKEN
  if (!advertiserId || !accessToken) {
    logger.warn('Missing TikTok credentials for ad stats', { clinicId: options?.clinicId })
    return { platform: 'TikTok', count: 0, error: 'Missing credentials' }
  }

  const supabase = serverSupabase()

  try {
    // 페이지네이션으로 전체 ad 레벨 데이터 수집
    const allAds: TikTokAd[] = []
    let page = 1
    const pageSize = 200

    while (true) {
      const url = new URL(BASE_URL)
      url.searchParams.set('advertiser_id', advertiserId)
      url.searchParams.set('report_type', 'BASIC')
      url.searchParams.set('data_level', 'AUCTION_AD')
      url.searchParams.set('dimensions', JSON.stringify(['ad_id', 'stat_time_day']))
      url.searchParams.set('metrics', JSON.stringify(['ad_name', 'campaign_id', 'campaign_name', 'spend', 'clicks', 'impressions']))
      url.searchParams.set('start_date', dateStr)
      url.searchParams.set('end_date', dateStr)
      url.searchParams.set('page', String(page))
      url.searchParams.set('page_size', String(pageSize))

      const { response } = await fetchWithRetry(url.toString(), {
        headers: { 'Access-Token': accessToken },
        service: SERVICE_NAME,
        timeout: 30000,
        retries: 3,
      })

      if (!response.ok) {
        throw new Error(`TikTok API error (ad level): ${response.statusText}`)
      }

      const json = await response.json()
      if (json.code !== 0) {
        throw new Error(`TikTok API error: ${json.message || 'Unknown'}`)
      }

      const ads: TikTokAd[] = json.data?.list || []
      allAds.push(...ads)

      const totalPage = json.data?.page_info?.total_page || 1
      if (page >= totalPage) break
      page++
    }

    if (allAds.length === 0) {
      return { platform: 'TikTok', count: 0 }
    }

    // ad_stats 테이블에 upsert
    const rows = allAds.map((a) => ({
      platform: 'TikTok',
      ad_id: a.dimensions.ad_id,
      ad_name: a.metrics.ad_name,
      campaign_id: a.metrics.campaign_id,
      spend_amount: parseFloat(a.metrics.spend || '0'),
      clicks: parseInt(a.metrics.clicks || '0'),
      impressions: parseInt(a.metrics.impressions || '0'),
      stat_date: dateStr,
      clinic_id: options?.clinicId || null,
      utm_content: null,
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
    logger.info('Ad stats sync completed', { action: 'ad_sync', count: allAds.length, duration, clinicId: options?.clinicId })

    return { platform: 'TikTok', count: allAds.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Ad stats sync failed', error, { action: 'ad_sync', duration: Date.now() - startTime, clinicId: options?.clinicId })
    return { platform: 'TikTok', count: 0, error: message }
  }
}

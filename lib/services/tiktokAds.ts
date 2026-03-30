import { serverSupabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/api-client'
import { createLogger } from '@/lib/logger'
import { getKstDateString } from '@/lib/date'

const SERVICE_NAME = 'TikTokAds'
const logger = createLogger(SERVICE_NAME)
const BASE_URL = 'https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/'

interface TikTokReportRow {
  dimensions: Record<string, string>
  metrics: Record<string, string>
}

export interface TikTokAdsOptions {
  clinicId?: number
  advertiserId?: string
  accessToken?: string
}

/**
 * TikTok Report API 페이지네이션 공통 헬퍼
 * data_level/dimensions/metrics만 다르고 호출 구조는 동일
 */
async function fetchTikTokReport(params: {
  advertiserId: string
  accessToken: string
  dataLevel: string
  dimensions: string[]
  metrics: string[]
  dateStr: string
}): Promise<TikTokReportRow[]> {
  const allRows: TikTokReportRow[] = []
  let page = 1
  const pageSize = 200

  while (true) {
    const url = new URL(BASE_URL)
    url.searchParams.set('advertiser_id', params.advertiserId)
    url.searchParams.set('report_type', 'BASIC')
    url.searchParams.set('data_level', params.dataLevel)
    url.searchParams.set('dimensions', JSON.stringify(params.dimensions))
    url.searchParams.set('metrics', JSON.stringify(params.metrics))
    url.searchParams.set('start_date', params.dateStr)
    url.searchParams.set('end_date', params.dateStr)
    url.searchParams.set('page', String(page))
    url.searchParams.set('page_size', String(pageSize))

    const { response } = await fetchWithRetry(url.toString(), {
      headers: { 'Access-Token': params.accessToken },
      service: SERVICE_NAME,
      timeout: 30000,
      retries: 3,
    })

    if (!response.ok) {
      throw new Error(`TikTok API error (${params.dataLevel}): ${response.statusText}`)
    }

    const json = await response.json()
    if (json.code !== 0) {
      throw new Error(`TikTok API error: ${json.message || 'Unknown'}`)
    }

    allRows.push(...(json.data?.list || []))

    const totalPage = json.data?.page_info?.total_page || 1
    if (page >= totalPage) break
    page++
  }

  return allRows
}

/**
 * TikTok 캠페인 레벨 수집 → ad_campaign_stats
 */
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
    const rows = await fetchTikTokReport({
      advertiserId,
      accessToken,
      dataLevel: 'AUCTION_CAMPAIGN',
      dimensions: ['campaign_id', 'stat_time_day'],
      metrics: ['campaign_name', 'spend', 'clicks', 'impressions'],
      dateStr,
    })

    if (rows.length > 0) {
      const dbRows = rows.map((r) => ({
        platform: 'TikTok',
        campaign_id: r.dimensions.campaign_id,
        campaign_name: r.metrics.campaign_name,
        spend_amount: parseFloat(r.metrics.spend || '0'),
        clicks: parseInt(r.metrics.clicks || '0'),
        impressions: parseInt(r.metrics.impressions || '0'),
        stat_date: dateStr,
        clinic_id: options?.clinicId || null,
      }))

      const onConflict = options?.clinicId
        ? 'clinic_id,platform,campaign_id,stat_date'
        : 'platform,campaign_id,stat_date'
      const { error } = await supabase
        .from('ad_campaign_stats')
        .upsert(dbRows, { onConflict })

      if (error) {
        logger.error('DB upsert error', error, { clinicId: options?.clinicId })
      }
    }

    const duration = Date.now() - startTime
    logger.info('Sync completed', { action: 'sync', count: rows.length, duration, clinicId: options?.clinicId })

    return { platform: 'TikTok', count: rows.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Sync failed', error, { action: 'sync', duration: Date.now() - startTime, clinicId: options?.clinicId })
    return { platform: 'TikTok', count: 0, error: message }
  }
}

/**
 * TikTok Ad 레벨 성과 수집 (소재별 성과용) → ad_stats
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
    const rows = await fetchTikTokReport({
      advertiserId,
      accessToken,
      dataLevel: 'AUCTION_AD',
      dimensions: ['ad_id', 'stat_time_day'],
      metrics: ['ad_name', 'campaign_id', 'campaign_name', 'spend', 'clicks', 'impressions'],
      dateStr,
    })

    if (rows.length === 0) {
      return { platform: 'TikTok', count: 0 }
    }

    const dbRows = rows.map((r) => ({
      platform: 'TikTok',
      ad_id: r.dimensions.ad_id,
      ad_name: r.metrics.ad_name,
      campaign_id: r.metrics.campaign_id,
      spend_amount: parseFloat(r.metrics.spend || '0'),
      clicks: parseInt(r.metrics.clicks || '0'),
      impressions: parseInt(r.metrics.impressions || '0'),
      stat_date: dateStr,
      clinic_id: options?.clinicId || null,
      utm_content: null,
    }))

    const onConflict = options?.clinicId
      ? 'clinic_id,platform,ad_id,stat_date'
      : 'platform,ad_id,stat_date'
    const { error } = await supabase
      .from('ad_stats')
      .upsert(dbRows, { onConflict })

    if (error) {
      logger.error('ad_stats upsert error', error, { clinicId: options?.clinicId })
    }

    const duration = Date.now() - startTime
    logger.info('Ad stats sync completed', { action: 'ad_sync', count: rows.length, duration, clinicId: options?.clinicId })

    return { platform: 'TikTok', count: rows.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Ad stats sync failed', error, { action: 'ad_sync', duration: Date.now() - startTime, clinicId: options?.clinicId })
    return { platform: 'TikTok', count: 0, error: message }
  }
}

import { serverSupabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/api-client'
import { createLogger } from '@/lib/logger'
import { getKstDateString } from '@/lib/date'

const SERVICE_NAME = 'TikTokAds'
const logger = createLogger(SERVICE_NAME)

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

export interface TikTokAdsOptions {
  clinicId?: number
  advertiserId?: string
  accessToken?: string
}

export async function fetchTikTokAds(date = new Date(), options?: TikTokAdsOptions) {
  const dateStr = getKstDateString(date)
  const startTime = Date.now()

  // options 제공 시 options 사용, 아닐 시 환경변수 폴백
  const advertiserId = options?.advertiserId || process.env.TIKTOK_ADVERTISER_ID
  const accessToken = options?.accessToken || process.env.TIKTOK_ACCESS_TOKEN
  if (!advertiserId || !accessToken) {
    logger.warn('Missing TIKTOK_ADVERTISER_ID or TIKTOK_ACCESS_TOKEN', { clinicId: options?.clinicId })
    return { platform: 'TikTok', count: 0, error: 'Missing credentials' }
  }

  const supabase = serverSupabase()

  try {
    const url = new URL('https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/')
    url.searchParams.set('advertiser_id', advertiserId)
    url.searchParams.set('report_type', 'BASIC')
    url.searchParams.set('data_level', 'AUCTION_CAMPAIGN')
    url.searchParams.set('dimensions', JSON.stringify(['campaign_id', 'stat_time_day']))
    url.searchParams.set('metrics', JSON.stringify(['campaign_name', 'spend', 'clicks', 'impressions']))
    url.searchParams.set('start_date', dateStr)
    url.searchParams.set('end_date', dateStr)

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
    const campaigns: TikTokCampaign[] = json.data?.list || []

    // 배치 처리
    if (campaigns.length > 0) {
      const rows = campaigns.map((c) => ({
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
    logger.info('Sync completed', { action: 'sync', count: campaigns.length, duration, clinicId: options?.clinicId })

    return { platform: 'TikTok', count: campaigns.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Sync failed', error, { action: 'sync', duration: Date.now() - startTime, clinicId: options?.clinicId })
    return { platform: 'TikTok', count: 0, error: message }
  }
}

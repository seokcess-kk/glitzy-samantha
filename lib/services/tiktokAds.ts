import { serverSupabase } from '@/lib/supabase'
import { fetchWithRetry, logServiceCall } from '@/lib/api-client'

const SERVICE_NAME = 'TikTokAds'

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

export async function fetchTikTokAds(date = new Date()) {
  const dateStr = date.toISOString().split('T')[0]
  const startTime = Date.now()

  // 환경변수 검증
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN
  if (!advertiserId || !accessToken) {
    console.warn(`[${SERVICE_NAME}] Missing TIKTOK_ADVERTISER_ID or TIKTOK_ACCESS_TOKEN`)
    return { platform: 'TikTok', count: 0, error: 'Missing credentials' }
  }

  const supabase = serverSupabase()

  try {
    const url = new URL('https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/')
    url.searchParams.set('advertiser_id', advertiserId)
    url.searchParams.set('report_type', 'BASIC')
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
      }))

      const { error } = await supabase
        .from('ad_campaign_stats')
        .upsert(rows, { onConflict: 'platform,campaign_id,stat_date' })

      if (error) {
        console.error(`[${SERVICE_NAME}] DB upsert error:`, error.message)
      }
    }

    const duration = Date.now() - startTime
    logServiceCall(SERVICE_NAME, 'sync', { count: campaigns.length, duration_ms: duration })

    return { platform: 'TikTok', count: campaigns.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logServiceCall(SERVICE_NAME, 'error', { error: message, duration_ms: Date.now() - startTime })
    return { platform: 'TikTok', count: 0, error: message }
  }
}

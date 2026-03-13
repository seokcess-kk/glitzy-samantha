import { GoogleAdsApi } from 'google-ads-api'
import { serverSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const SERVICE_NAME = 'GoogleAds'
const logger = createLogger(SERVICE_NAME)

export async function fetchGoogleAds(date = new Date()) {
  const dateStr = date.toISOString().split('T')[0]
  const startTime = Date.now()

  // 환경변수 검증
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN

  if (!clientId || !clientSecret || !developerToken || !customerId || !refreshToken) {
    logger.warn('Missing Google Ads credentials')
    return { platform: 'Google', count: 0, error: 'Missing credentials' }
  }

  const supabase = serverSupabase()

  try {
    const client = new GoogleAdsApi({
      client_id: clientId,
      client_secret: clientSecret,
      developer_token: developerToken,
    })

    const customer = client.Customer({
      customer_id: customerId,
      refresh_token: refreshToken,
    })

    const campaigns = await customer.query(`
      SELECT campaign.id, campaign.name, metrics.cost_micros, metrics.clicks, metrics.impressions
      FROM campaign
      WHERE segments.date = '${dateStr}' AND campaign.status = 'ENABLED'
    `)

    // 배치 처리
    if (campaigns.length > 0) {
      const rows = campaigns.map((row) => ({
        platform: 'Google',
        campaign_id: String(row.campaign?.id || ''),
        campaign_name: row.campaign?.name || '',
        spend_amount: (row.metrics?.cost_micros || 0) / 1_000_000,
        clicks: row.metrics?.clicks || 0,
        impressions: row.metrics?.impressions || 0,
        stat_date: dateStr,
      }))

      const { error } = await supabase
        .from('ad_campaign_stats')
        .upsert(rows, { onConflict: 'platform,campaign_id,stat_date' })

      if (error) {
        logger.error('DB upsert error', error)
      }
    }

    const duration = Date.now() - startTime
    logger.info('Sync completed', { action: 'sync', count: campaigns.length, duration })

    return { platform: 'Google', count: campaigns.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Sync failed', error, { action: 'sync', duration: Date.now() - startTime })
    return { platform: 'Google', count: 0, error: message }
  }
}

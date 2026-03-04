import { GoogleAdsApi } from 'google-ads-api'
import { serverSupabase } from '@/lib/supabase'

export async function fetchGoogleAds(date = new Date()) {
  const dateStr = date.toISOString().split('T')[0]
  const supabase = serverSupabase()

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  })

  const customer = client.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID!,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
  })

  const campaigns = await customer.query(`
    SELECT campaign.id, campaign.name, metrics.cost_micros, metrics.clicks, metrics.impressions
    FROM campaign
    WHERE segments.date = '${dateStr}' AND campaign.status = 'ENABLED'
  `)

  for (const row of campaigns) {
    const spendKrw = (row.metrics.cost_micros || 0) / 1_000_000

    await supabase.from('ad_campaign_stats').upsert({
      platform: 'Google',
      campaign_id: String(row.campaign.id),
      campaign_name: row.campaign.name,
      spend_amount: spendKrw,
      clicks: row.metrics.clicks || 0,
      impressions: row.metrics.impressions || 0,
      stat_date: dateStr,
    }, { onConflict: 'platform,campaign_id,stat_date' })
  }

  console.log(`[GoogleAds] ${campaigns.length}개 캠페인 수집 완료`)
  return { platform: 'Google', count: campaigns.length }
}

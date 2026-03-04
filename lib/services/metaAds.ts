import { serverSupabase } from '@/lib/supabase'

export async function fetchMetaAds(date = new Date()) {
  const dateStr = date.toISOString().split('T')[0]
  const supabase = serverSupabase()

  const response = await fetch(
    `https://graph.facebook.com/v19.0/${process.env.META_AD_ACCOUNT_ID}/insights?` +
    new URLSearchParams({
      access_token: process.env.META_ACCESS_TOKEN!,
      level: 'campaign',
      fields: 'campaign_id,campaign_name,spend,clicks,impressions',
      time_range: JSON.stringify({ since: dateStr, until: dateStr }),
      time_increment: '1',
    })
  )

  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Meta API error: ${JSON.stringify(err)}`)
  }

  const json = await response.json()
  const campaigns = json.data || []

  for (const c of campaigns) {
    await supabase.from('ad_campaign_stats').upsert({
      platform: 'Meta',
      campaign_id: c.campaign_id,
      campaign_name: c.campaign_name,
      spend_amount: parseFloat(c.spend || 0),
      clicks: parseInt(c.clicks || 0),
      impressions: parseInt(c.impressions || 0),
      stat_date: dateStr,
    }, { onConflict: 'platform,campaign_id,stat_date' })
  }

  console.log(`[MetaAds] ${campaigns.length}개 캠페인 수집 완료`)
  return { platform: 'Meta', count: campaigns.length }
}

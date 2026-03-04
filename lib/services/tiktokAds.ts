import { serverSupabase } from '@/lib/supabase'

export async function fetchTikTokAds(date = new Date()) {
  const dateStr = date.toISOString().split('T')[0]
  const supabase = serverSupabase()

  const url = new URL('https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/')
  url.searchParams.set('advertiser_id', process.env.TIKTOK_ADVERTISER_ID!)
  url.searchParams.set('report_type', 'BASIC')
  url.searchParams.set('dimensions', JSON.stringify(['campaign_id', 'stat_time_day']))
  url.searchParams.set('metrics', JSON.stringify(['campaign_name', 'spend', 'clicks', 'impressions']))
  url.searchParams.set('start_date', dateStr)
  url.searchParams.set('end_date', dateStr)

  const response = await fetch(url.toString(), {
    headers: { 'Access-Token': process.env.TIKTOK_ACCESS_TOKEN! },
  })

  if (!response.ok) throw new Error(`TikTok API error: ${response.statusText}`)

  const json = await response.json()
  const campaigns = json.data?.list || []

  for (const c of campaigns) {
    const { dimensions, metrics } = c
    await supabase.from('ad_campaign_stats').upsert({
      platform: 'TikTok',
      campaign_id: dimensions.campaign_id,
      campaign_name: metrics.campaign_name,
      spend_amount: parseFloat(metrics.spend || 0),
      clicks: parseInt(metrics.clicks || 0),
      impressions: parseInt(metrics.impressions || 0),
      stat_date: dateStr,
    }, { onConflict: 'platform,campaign_id,stat_date' })
  }

  console.log(`[TikTokAds] ${campaigns.length}개 캠페인 수집 완료`)
  return { platform: 'TikTok', count: campaigns.length }
}

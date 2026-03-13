import { serverSupabase } from '@/lib/supabase'
import { fetchWithRetry, logServiceCall } from '@/lib/api-client'

const SERVICE_NAME = 'MetaAds'

export async function fetchMetaAds(date = new Date()) {
  const dateStr = date.toISOString().split('T')[0]
  const startTime = Date.now()

  // 환경변수 검증
  const accountId = process.env.META_AD_ACCOUNT_ID
  const accessToken = process.env.META_ACCESS_TOKEN
  if (!accountId || !accessToken) {
    console.warn(`[${SERVICE_NAME}] Missing META_AD_ACCOUNT_ID or META_ACCESS_TOKEN`)
    return { platform: 'Meta', count: 0, error: 'Missing credentials' }
  }

  const supabase = serverSupabase()

  try {
    // access_token은 URL이 아닌 Authorization 헤더로 전달 (보안)
    const url = `https://graph.facebook.com/v19.0/${accountId}/insights?` +
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
      throw new Error(`Meta API error: ${JSON.stringify(err)}`)
    }

    const json = await response.json()
    const campaigns = json.data || []

    // 배치 처리
    if (campaigns.length > 0) {
      const rows = campaigns.map((c: Record<string, string>) => ({
        platform: 'Meta',
        campaign_id: c.campaign_id,
        campaign_name: c.campaign_name,
        spend_amount: parseFloat(c.spend || '0'),
        clicks: parseInt(c.clicks || '0'),
        impressions: parseInt(c.impressions || '0'),
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

    return { platform: 'Meta', count: campaigns.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logServiceCall(SERVICE_NAME, 'error', { error: message, duration_ms: Date.now() - startTime })
    return { platform: 'Meta', count: 0, error: message }
  }
}

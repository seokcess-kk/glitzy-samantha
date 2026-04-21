import { serverSupabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/api-client'
import { createLogger } from '@/lib/logger'
import { getKstDateString } from '@/lib/date'

const SERVICE_NAME = 'DableAds'
const logger = createLogger(SERVICE_NAME)
const BASE_URL = 'https://marketing.dable.io'

// 보정 기간: Dable은 7일 이내 데이터가 변동될 수 있음 → 매번 최근 7일 재동기화
const ROLLING_DAYS = 7

export interface DableAdsOptions {
  clinicId?: number
  clientName?: string
  apiKey?: string
}

/**
 * Dable Daily Report 응답 스키마 (group_by_campaign=1)
 * {
 *   "20260415": {
 *     "<campaign_id>": {
 *       exposes, impressions, clicks, ctr, cost_spent, avg_cpc,
 *       convertion_cnt, convertion_rate, cpa, campaign_name,
 *       convertion: { <type>: { cnt, conversion_rate, cpa } }
 *     }
 *   }
 * }
 */
interface DableCampaignMetrics {
  exposes?: number
  impressions?: number
  clicks?: number
  ctr?: number
  cost_spent?: number
  avg_cpc?: number
  convertion_cnt?: number
  convertion_rate?: number
  cpa?: number
  campaign_name?: string
}

type DableDailyReport = Record<string, Record<string, DableCampaignMetrics>>

// YYYYMMDD → YYYY-MM-DD
function toIsoDate(ymd: string): string | null {
  const s = ymd.replace(/-/g, '')
  if (s.length !== 8) return null
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

// YYYYMMDD 포맷 (Dable API 요청용)
function toDableDate(date: Date): string {
  return getKstDateString(date).replace(/-/g, '')
}

// 기준일에서 N일 전 Date 반환 (KST 무관 — Dable 날짜만 추출할 것이므로 무방)
function subDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - days)
  return d
}

/**
 * Dable 캠페인 레벨 일별 성과 수집 → ad_campaign_stats
 * - 1회 HTTP 호출로 최근 7일치 일괄 조회 (group_by_campaign=1)
 * - Dable은 7일 이내 데이터 보정이 있어 매번 롤링 재조회 + UPSERT로 덮어쓰기
 * - ad(ad_stats) 레벨 API는 미제공 → ad_stats 미사용
 */
export async function fetchDableAds(date = new Date(), options?: DableAdsOptions) {
  const startTime = Date.now()

  const clientName = options?.clientName || process.env.DABLE_CLIENT_NAME
  const apiKey = options?.apiKey || process.env.DABLE_API_KEY
  if (!clientName || !apiKey) {
    logger.warn('Missing DABLE_CLIENT_NAME or DABLE_API_KEY', { clinicId: options?.clinicId })
    return { platform: 'dable_ads', count: 0, error: 'Missing credentials' }
  }

  const endDate = toDableDate(date)
  const startDate = toDableDate(subDays(date, ROLLING_DAYS - 1))

  const supabase = serverSupabase()

  try {
    const url = new URL(`${BASE_URL}/api/client/${encodeURIComponent(clientName)}/daily_report`)
    url.searchParams.set('api_key', apiKey)
    url.searchParams.set('start_date', startDate)
    url.searchParams.set('end_date', endDate)
    url.searchParams.set('group_by_campaign', '1')

    const { response } = await fetchWithRetry(url.toString(), {
      service: SERVICE_NAME,
      timeout: 30000,
      retries: 3,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Dable API error (${response.status}): ${text.slice(0, 200)}`)
    }

    const json = (await response.json()) as DableDailyReport | null
    if (!json || typeof json !== 'object') {
      logger.warn('Dable API 응답 형식 오류', { clinicId: options?.clinicId })
      return { platform: 'dable_ads', count: 0, error: 'Invalid response format' }
    }

    // 중첩 객체 평탄화: { "YYYYMMDD": { "campaign_id": { metrics } } } → flat rows
    const dbRows: Array<{
      platform: string
      campaign_type: string
      campaign_id: string
      campaign_name: string
      spend_amount: number
      clicks: number
      impressions: number
      stat_date: string
      clinic_id: number | null
    }> = []

    for (const [ymd, campaignMap] of Object.entries(json)) {
      const statDate = toIsoDate(ymd)
      if (!statDate || !campaignMap || typeof campaignMap !== 'object') continue

      for (const [campaignId, m] of Object.entries(campaignMap)) {
        if (!campaignId || !m || typeof m !== 'object') continue
        dbRows.push({
          platform: 'dable_ads',
          campaign_type: 'native',
          campaign_id: campaignId,
          campaign_name: m.campaign_name || `Dable Campaign ${campaignId}`,
          spend_amount: Number(m.cost_spent || 0),
          clicks: Number(m.clicks || 0),
          impressions: Number(m.impressions || 0),
          stat_date: statDate,
          clinic_id: options?.clinicId || null,
        })
      }
    }

    if (dbRows.length > 0) {
      const onConflict = options?.clinicId
        ? 'clinic_id,platform,campaign_id,stat_date'
        : 'platform,campaign_id,stat_date'

      const { error } = await supabase
        .from('ad_campaign_stats')
        .upsert(dbRows, { onConflict })

      if (error) {
        logger.error('DB upsert error', error, { clinicId: options?.clinicId })
        return { platform: 'dable_ads', count: 0, error: error.message }
      }
    }

    const duration = Date.now() - startTime
    logger.info('Sync completed', {
      action: 'sync',
      count: dbRows.length,
      dateKeys: Object.keys(json).length,
      startDate,
      endDate,
      duration,
      clinicId: options?.clinicId,
    })

    return { platform: 'dable_ads', count: dbRows.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Sync failed', error, {
      action: 'sync',
      duration: Date.now() - startTime,
      clinicId: options?.clinicId,
    })
    return { platform: 'dable_ads', count: 0, error: message }
  }
}

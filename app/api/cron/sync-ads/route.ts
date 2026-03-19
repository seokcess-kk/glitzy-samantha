import { fetchMetaAds } from '@/lib/services/metaAds'
import { fetchGoogleAds } from '@/lib/services/googleAds'
import { fetchTikTokAds } from '@/lib/services/tiktokAds'
import { apiError, apiSuccess } from '@/lib/api-middleware'
import { sendErrorAlert } from '@/lib/error-alert'
import { detectAllClinicAnomalies } from '@/lib/ads-anomaly'
import { serverSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('CronSyncAds')

export const maxDuration = 60

// Vercel Cron이 매일 새벽 3시에 호출 (vercel.json 참고)
export async function GET(req: Request) {
  // Vercel Cron 인증 확인
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError('Unauthorized', 401)
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const [metaResult, googleResult, tiktokResult] = await Promise.allSettled([
    fetchMetaAds(yesterday),
    fetchGoogleAds(yesterday),
    fetchTikTokAds(yesterday),
  ])

  const failures = [
    metaResult.status === 'rejected' && 'Meta',
    googleResult.status === 'rejected' && 'Google',
    tiktokResult.status === 'rejected' && 'TikTok',
  ].filter(Boolean)
  if (failures.length > 0) {
    sendErrorAlert('ad_sync_fail', `광고 동기화 실패: ${failures.join(', ')}`).catch(() => {})
  }

  // 동기화 성공 건이 있을 때만 이상치 감지 실행
  let anomalyCount = 0
  const hasAnySuccess = [metaResult, googleResult, tiktokResult].some(r => r.status === 'fulfilled')
  if (hasAnySuccess) {
    try {
      const supabase = serverSupabase()
      const { totalAnomalies, summaryMessage } = await detectAllClinicAnomalies(supabase)
      anomalyCount = totalAnomalies
      if (totalAnomalies > 0) {
        sendErrorAlert('ads_anomaly', summaryMessage).catch(() => {})
      }
    } catch (err) {
      logger.error('이상치 감지 실행 실패', err, { action: 'detect_anomalies' })
    }
  }

  logger.info('광고 데이터 자동 수집 완료', { anomalyCount })
  return apiSuccess({
    success: true,
    results: {
      meta: metaResult.status === 'fulfilled' ? metaResult.value.count : 'failed',
      google: googleResult.status === 'fulfilled' ? googleResult.value.count : 'failed',
      tiktok: tiktokResult.status === 'fulfilled' ? tiktokResult.value.count : 'failed',
    },
    anomalyCount,
  })
}

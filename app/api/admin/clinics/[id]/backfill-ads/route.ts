/**
 * 병원별 광고 backfill (superadmin UI 트리거용)
 * - POST: 날짜 범위 + 매체 선택으로 광고 데이터 재동기화
 *
 * 동일 로직의 /api/admin/backfill-ads 는 CRON_SECRET 인증 스크립트 전용.
 * UI 다이얼로그(components/ads/backfill-dialog.tsx)는 이 라우트를 호출.
 */

import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { syncClinic } from '@/lib/services/adSyncManager'
import { parseId } from '@/lib/security'
import { createLogger } from '@/lib/logger'
import { getKstDateString } from '@/lib/date'
import { isApiPlatform, type ApiPlatform } from '@/lib/platform'

const logger = createLogger('BackfillAdsAdmin')

export const maxDuration = 300

export const POST = withSuperAdmin(async (req: Request) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  // pathname: /api/admin/clinics/[id]/backfill-ads
  const idSegment = segments[segments.indexOf('clinics') + 1]
  const clinicId = parseId(idSegment)
  if (!clinicId) return apiError('유효한 병원 ID가 필요합니다.')

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return apiError('유효한 JSON 본문이 필요합니다.')
  }

  const startDate = typeof body.startDate === 'string' ? body.startDate : ''
  const endDate = typeof body.endDate === 'string' ? body.endDate : ''

  if (!startDate || !endDate) {
    return apiError('startDate, endDate 필수 (YYYY-MM-DD)')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return apiError('날짜 형식: YYYY-MM-DD')
  }

  let platforms: ApiPlatform[] | undefined
  if (Array.isArray(body.platforms)) {
    const filtered = body.platforms.filter((p: unknown): p is ApiPlatform => isApiPlatform(p))
    platforms = filtered.length > 0 ? filtered : undefined
  }

  if (!platforms || platforms.length === 0) {
    return apiError('백필할 매체를 1개 이상 선택해주세요.')
  }

  const start = new Date(startDate + 'T00:00:00+09:00')
  const end = new Date(endDate + 'T00:00:00+09:00')

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return apiError('유효한 날짜 형식이 아닙니다 (YYYY-MM-DD)')
  }

  const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000)
  if (diffDays < 0) return apiError('시작일이 종료일보다 늦습니다.')
  if (diffDays > 90) return apiError('최대 90일까지 가능합니다.')

  logger.info('Backfill 시작', { clinicId, startDate, endDate, days: diffDays + 1, platforms })

  try {
    const allResults: { date: string; platform: string; count: number; error: string | null }[] = []

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d)
      const dateStr = getKstDateString(currentDate)

      const results = await syncClinic(clinicId, currentDate, { platforms })

      for (const r of results) {
        allResults.push({
          date: dateStr,
          platform: r.platform,
          count: r.count,
          error: r.error || null,
        })
      }
    }

    const totalCount = allResults.reduce((sum, r) => sum + r.count, 0)
    const errorCount = allResults.filter(r => r.error).length

    logger.info('Backfill 완료', { clinicId, totalCount, errorCount, days: diffDays + 1 })

    return apiSuccess({
      clinicId,
      syncedDays: diffDays + 1,
      totalCount,
      errorCount,
      results: allResults,
    })
  } catch (error) {
    logger.error('Backfill 실패', error, { clinicId, startDate, endDate })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})

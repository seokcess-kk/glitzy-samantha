import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { getKstDateString } from '@/lib/date'
import { fetchAdMarkups, buildMarkupStatRows, markupCampaignIds, MARKUP_HINT } from '@/lib/ad-markup'
import { fetchAllRowsResult } from '@/lib/supabase-paginate'
import { createLogger } from '@/lib/logger'

const logger = createLogger('AdsStats')

// inflow_url에서 utm_id (Meta campaign_id) 추출
function extractUtmId(inflowUrl: string | null): string | null {
  if (!inflowUrl) return null
  const match = inflowUrl.match(/utm_id=(\d+)/)
  return match?.[1] || null
}

export const GET = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  const url = new URL(req.url)
  const platform = url.searchParams.get('platform')

  // 우선순위: startDate/endDate(명시) > days(fallback, 호환성)
  const startDateParam = url.searchParams.get('startDate')
  const endDateParam = url.searchParams.get('endDate')
  const daysParam = Number(url.searchParams.get('days') || 30)
  const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 30

  const endDate = endDateParam || getKstDateString()
  const startDate = startDateParam || getKstDateString(new Date(Date.now() - days * 86400000))

  if (user.role === 'demo_viewer') {
    const { demoAdStats } = await import('@/lib/demo/fixtures/aggregates')
    return apiSuccess(demoAdStats(clinicId, startDate, endDate, platform))
  }

  const supabase = serverSupabase()

  // 리드 created_at 비교용 KST 범위 (timestamptz)
  const leadStart = `${startDate}T00:00:00+09:00`
  const leadEndDate = new Date(`${endDate}T00:00:00+09:00`)
  leadEndDate.setDate(leadEndDate.getDate() + 1)
  const leadEnd = leadEndDate.toISOString()

  try {
    // agency_staff 배정 병원 0개 → 빈 결과
    if (assignedClinicIds !== null && assignedClinicIds.length === 0) {
      return apiSuccess({ stats: [], campaignLeadCounts: {} })
    }

    // 1) ad_campaign_stats 전량 (stat_date는 DATE 타입) — 1,000행 상한을 id 페이지네이션으로 우회
    const { data, error } = await fetchAllRowsResult<{ campaign_id: string | null; campaign_name: string | null; [key: string]: unknown }>((from, to) => {
      let q = applyClinicFilter(supabase.from('ad_campaign_stats').select('*')
        .gte('stat_date', startDate).lte('stat_date', endDate), { clinicId, assignedClinicIds })!
      if (platform) q = q.eq('platform', platform)
      return q.order('id').range(from, to)
    })
    if (error) {
      logger.error('ad_campaign_stats 조회 실패', error, { clinicId })
      // 조회 실패를 빈 성공(0건)으로 위장하지 않고 에러로 표면화 — 프론트에서 "0"과 구분
      return apiError('광고 통계 조회에 실패했습니다.', 500)
    }

    // 2) campaign_id별 리드 수 산출
    // leads.inflow_url의 utm_id 파라미터가 Meta campaign_id와 일치
    const campaignLeadCounts: Record<string, number> = {}

    const { data: leadsData } = await fetchAllRowsResult<{ inflow_url: string | null }>((from, to) =>
      applyClinicFilter(supabase.from('leads').select('inflow_url').not('inflow_url', 'is', null)
        .gte('created_at', leadStart).lt('created_at', leadEnd), { clinicId, assignedClinicIds })!.order('id').range(from, to))

    for (const lead of leadsData || []) {
      const campId = extractUtmId(lead.inflow_url as string)
      if (campId) {
        campaignLeadCounts[campId] = (campaignLeadCounts[campId] || 0) + 1
      }
    }

    // 광고비 마크업(관리 수수료 등) — 대상 캠페인 spend에 일별 가산 (DB 원본은 그대로).
    // 수수료 전용 합성 행을 합쳐 반환하면 프론트 캠페인 집계(spend/CPC/CPL)에 반영됨.
    // 프론트는 campaign_name으로 집계하므로, 합성 행의 이름을 실제 동기화된 캠페인명에
    // 맞춰 동일 캠페인으로 병합되게 한다(설정 campaign_name과 미세 차이 방지).
    const markups = await fetchAdMarkups(supabase, { clinicId, assignedClinicIds })
    const realCampaignName = new Map<string, string>()
    for (const r of data || []) {
      if (r.campaign_id && r.campaign_name && !realCampaignName.has(r.campaign_id)) {
        realCampaignName.set(r.campaign_id, r.campaign_name)
      }
    }
    const markupRows = buildMarkupStatRows(markups, startDate, endDate)
      .filter((r) => !platform || r.platform === platform)
      .map((r) => ({
        ...r,
        campaign_name: (r.campaign_id && realCampaignName.get(r.campaign_id)) || r.campaign_name,
      }))
    const stats = markupRows.length > 0 ? [...(data || []), ...markupRows] : data

    return apiSuccess({
      stats,
      campaignLeadCounts,
      // 가산이 적용된 캠페인 — UI 고지(ⓘ "관리비 포함") 표시용
      markup: { campaignIds: markupCampaignIds(markups, startDate, endDate), hint: MARKUP_HINT },
    })
  } catch (err) {
    logger.error('ads/stats 조회 실패', err, { clinicId })
    return apiError('광고 통계 조회에 실패했습니다.', 500)
  }
})

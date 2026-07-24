import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { normalizeChannel } from '@/lib/channel'
import { getKstDateString } from '@/lib/date'
import { fetchAdMarkups, buildMarkupStatRows } from '@/lib/ad-markup'
import { createLogger } from '@/lib/logger'
import { fetchAllRowsResult } from '@/lib/supabase-paginate'

const logger = createLogger('RoasTrend')

interface DayChannelEntry {
  date: string
  channels: Record<string, { spend: number; revenue: number; roas: number }>
}

/**
 * 채널별 일별 ROAS 추이 API
 * GET /api/attribution/roas-trend?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
export const GET = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  if (user.role === 'demo_viewer') {
    const { demoAttributionRoasTrend } = await import('@/lib/demo/fixtures/extras')
    const url = new URL(req.url)
    return apiSuccess(demoAttributionRoasTrend(clinicId, url.searchParams.get('startDate'), url.searchParams.get('endDate')))
  }

  const supabase = serverSupabase()
  const url = new URL(req.url)

  const today = getKstDateString()
  const startDate = url.searchParams.get('startDate') || getKstDateString(new Date(Date.now() - 30 * 86400000))
  const endDate = url.searchParams.get('endDate') || today

  // 빈 날짜 틀 생성
  const dayMap = new Map<string, Record<string, { spend: number; revenue: number }>>()
  const start = new Date(startDate)
  const end = new Date(endDate)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dayMap.set(getKstDateString(new Date(d)), {})
  }

  // agency_staff 배정 병원 0개 → 빈 결과
  if (assignedClinicIds !== null && assignedClinicIds.length === 0) {
    return apiSuccess([])
  }

  try {
    // 광고비·결제 일별 집계 — 합계이므로 1,000행 상한을 id 페이지네이션으로 우회
    const [adRes, payRes] = await Promise.all([
      fetchAllRowsResult<{ stat_date: string; platform: string; spend_amount: number }>((from, to) =>
        applyClinicFilter(supabase.from('ad_campaign_stats').select('stat_date, platform, spend_amount')
          .gte('stat_date', startDate).lte('stat_date', endDate), { clinicId, assignedClinicIds })!.order('id').range(from, to)),
      fetchAllRowsResult<{ payment_amount: number; payment_date: string; customers: { first_source: string | null }[] }>((from, to) =>
        applyClinicFilter(supabase.from('payments').select('payment_amount, payment_date, customers(first_source)')
          .gte('payment_date', startDate).lte('payment_date', endDate), { clinicId, assignedClinicIds })!.order('id').range(from, to)),
    ])

    if (adRes.error) return apiError('ROAS 추이 조회에 실패했습니다.', 500)
    if (payRes.error) return apiError('ROAS 추이 조회에 실패했습니다.', 500)

    const toKstDate = (dateStr: string) =>
      new Date(dateStr).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })

    // 광고비 일별 채널 집계
    for (const row of adRes.data || []) {
      const date = row.stat_date.slice(0, 10)
      const ch = normalizeChannel(row.platform)
      const entry = dayMap.get(date)
      if (!entry) continue
      if (!entry[ch]) entry[ch] = { spend: 0, revenue: 0 }
      entry[ch].spend += Number(row.spend_amount) || 0
    }

    // 광고비 마크업(관리 수수료 등) 일별 채널 가산 — DB 원본은 그대로, 조회 시점에만 합산
    const markups = await fetchAdMarkups(supabase, { clinicId, assignedClinicIds })
    for (const row of buildMarkupStatRows(markups, startDate, endDate)) {
      const ch = normalizeChannel(row.platform)
      const entry = dayMap.get(row.stat_date)
      if (!entry) continue
      if (!entry[ch]) entry[ch] = { spend: 0, revenue: 0 }
      entry[ch].spend += row.spend_amount
    }

    // 매출 일별 채널 집계 (퍼스트터치 기준)
    for (const row of payRes.data || []) {
      const customer = row.customers as unknown as { first_source: string | null } | null
      const ch = normalizeChannel(customer?.first_source ?? null)
      const date = toKstDate(row.payment_date)
      const entry = dayMap.get(date)
      if (!entry) continue
      if (!entry[ch]) entry[ch] = { spend: 0, revenue: 0 }
      entry[ch].revenue += Number(row.payment_amount) || 0
    }

    // ROAS 계산 + 응답 조립
    const result: DayChannelEntry[] = []
    for (const [date, channels] of dayMap) {
      const computed: Record<string, { spend: number; revenue: number; roas: number }> = {}
      for (const [ch, data] of Object.entries(channels)) {
        computed[ch] = {
          spend: data.spend,
          revenue: Math.round(data.revenue),
          roas: data.spend > 0 ? Number((data.revenue / data.spend).toFixed(2)) : 0,
        }
      }
      result.push({ date, channels: computed })
    }

    return apiSuccess(result)
  } catch (error) {
    logger.error('ROAS 추이 조회 실패', error, { clinicId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})

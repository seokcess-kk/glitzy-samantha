import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { getKstDateString } from '@/lib/date'
import { fetchAdMarkups, buildMarkupStatRows } from '@/lib/ad-markup'

const DEFAULT_DAYS = 28

interface DayEntry {
  date: string
  spend: number
  clicks: number
  impressions: number
  leads: number
  cpl: number
  cpc: number
  ctr: number
}

export const GET = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  if (user.role === 'demo_viewer') {
    const { demoEfficiencyTrend } = await import('@/lib/demo/fixtures/aggregates')
    const url = new URL(req.url)
    return apiSuccess(demoEfficiencyTrend(clinicId, url.searchParams.get('startDate'), url.searchParams.get('endDate')))
  }

  const supabase = serverSupabase()
  const url = new URL(req.url)

  const today = getKstDateString()
  const startDate =
    url.searchParams.get('startDate') ||
    getKstDateString(new Date(Date.now() - DEFAULT_DAYS * 86400000))
  const endDate = url.searchParams.get('endDate') || today

  // 요청 기간의 모든 날짜를 빈 틀로 생성 (KST 기준, 데이터 없는 날도 0으로)
  // new Date(startDate) UTC 자정 패턴 회피 → KST 자정 명시 후 KST 일자로 비교
  const dayMap = new Map<string, DayEntry>()
  const cursor = new Date(`${startDate}T00:00:00+09:00`)
  while (getKstDateString(cursor) <= endDate) {
    const key = getKstDateString(cursor)
    dayMap.set(key, { date: key, spend: 0, clicks: 0, impressions: 0, leads: 0, cpl: 0, cpc: 0, ctr: 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  // Timestamp end: endDate 다음날 KST 자정 (exclusive)
  const tsEndDate = new Date(`${endDate}T00:00:00+09:00`)
  tsEndDate.setUTCDate(tsEndDate.getUTCDate() + 1)
  const tsEnd = tsEndDate.toISOString()

  // 광고 집계 쿼리
  let adQuery = supabase
    .from('ad_campaign_stats')
    .select('stat_date, spend_amount, clicks, impressions')
    .gte('stat_date', startDate)
    .lte('stat_date', endDate)
    .order('stat_date')

  // 리드 쿼리
  let leadQuery = supabase
    .from('leads')
    .select('created_at')
    .gte('created_at', `${startDate}T00:00:00+09:00`)
    .lt('created_at', tsEnd)
    .order('created_at')

  const adFiltered = applyClinicFilter(adQuery, { clinicId, assignedClinicIds })
  const leadFiltered = applyClinicFilter(leadQuery, { clinicId, assignedClinicIds })

  // agency_staff 배정 병원 0개 → 빈 날짜 틀 반환
  if (adFiltered === null && leadFiltered === null) {
    return apiSuccess([...dayMap.values()])
  }
  if (adFiltered) adQuery = adFiltered
  if (leadFiltered) leadQuery = leadFiltered

  const [adRes, leadRes] = await Promise.all([
    adFiltered
      ? adQuery
      : Promise.resolve({ data: [] as { stat_date: string; spend_amount: number; clicks: number; impressions: number }[], error: null }),
    leadFiltered
      ? leadQuery
      : Promise.resolve({ data: [] as { created_at: string }[], error: null }),
  ])

  if (adRes.error) return apiError(adRes.error.message, 500)
  if (leadRes.error) return apiError(leadRes.error.message, 500)

  // KST 기준 YYYY-MM-DD 추출 (리드는 timestamp이므로 KST 변환 필요)
  const toKstDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  }

  // 광고비/클릭/노출 일별 집계
  for (const row of adRes.data || []) {
    const key = row.stat_date.slice(0, 10)
    const entry = dayMap.get(key)
    if (entry) {
      entry.spend += Number(row.spend_amount)
      entry.clicks += Number(row.clicks || 0)
      entry.impressions += Number(row.impressions || 0)
    }
  }

  // 광고비 마크업(관리 수수료 등) 일별 가산 — DB 원본은 그대로, 조회 시점에만 합산.
  // 파생 지표(CPL·CPC) 계산 이전에 가산해야 효율 지표에 반영됨.
  const markups = await fetchAdMarkups(supabase, { clinicId, assignedClinicIds })
  for (const row of buildMarkupStatRows(markups, startDate, endDate)) {
    const entry = dayMap.get(row.stat_date)
    if (entry) entry.spend += row.spend_amount
  }

  // 리드 일별 집계
  for (const row of leadRes.data || []) {
    const key = toKstDate(row.created_at)
    const entry = dayMap.get(key)
    if (entry) entry.leads += 1
  }

  // 파생 지표 계산
  for (const entry of dayMap.values()) {
    entry.cpl = entry.leads > 0 ? Math.round(entry.spend / entry.leads) : 0
    entry.cpc = entry.clicks > 0 ? Math.round(entry.spend / entry.clicks) : 0
    entry.ctr = entry.impressions > 0 ? Number(((entry.clicks / entry.impressions) * 100).toFixed(2)) : 0
  }

  return apiSuccess([...dayMap.values()])
})

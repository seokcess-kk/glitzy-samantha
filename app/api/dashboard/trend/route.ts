import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'

export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)

  // startDate 파라미터 지원 (기본값: 8주 전)
  const defaultStart = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString()
  const startDate = url.searchParams.get('startDate') || defaultStart

  let query = supabase
    .from('ad_campaign_stats')
    .select('stat_date, spend_amount, campaign_id')
    .gte('stat_date', startDate)
    .order('stat_date')

  const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
  if (filtered === null) return apiSuccess([])
  query = filtered

  const { data, error } = await query
  if (error) return apiError(error.message, 500)

  // JS에서 주별 집계
  const weekMap = new Map<string, { week: string; spend: number; campaigns: Set<string> }>()
  for (const row of data || []) {
    const d = new Date(row.stat_date)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const key = weekStart.toISOString()
    if (!weekMap.has(key)) weekMap.set(key, { week: key, spend: 0, campaigns: new Set() })
    const w = weekMap.get(key)!
    w.spend += Number(row.spend_amount)
    w.campaigns.add(row.campaign_id)
  }

  const result = [...weekMap.values()].map(w => ({
    week: w.week,
    spend: w.spend,
    campaigns: w.campaigns.size,
  }))

  return apiSuccess(result)
})

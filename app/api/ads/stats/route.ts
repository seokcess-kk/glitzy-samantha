import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'

export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const days = Number(url.searchParams.get('days') || 30)
  const platform = url.searchParams.get('platform')
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('ad_campaign_stats')
    .select('*')
    .gte('stat_date', since)
    .order('stat_date', { ascending: false })

  if (platform) query = query.eq('platform', platform)
  const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
  if (filtered === null) return apiSuccess([])
  query = filtered

  const { data, error } = await query
  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})

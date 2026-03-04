import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serverSupabase } from '@/lib/supabase'
import { getClinicId } from '@/lib/session'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = serverSupabase()
  const url = new URL(req.url)
  const start = url.searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const end = url.searchParams.get('endDate') || new Date().toISOString()
  const clinicId = await getClinicId(req.url)

  const ac = (q: any) => clinicId ? q.eq('clinic_id', clinicId) : q

  const [adStatsRes, leadsRes, paymentsRes, consultRes] = await Promise.all([
    ac(supabase.from('ad_campaign_stats').select('spend_amount').gte('stat_date', start).lte('stat_date', end)),
    ac(supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', start).lte('created_at', end)),
    ac(supabase.from('payments').select('payment_amount').gte('payment_date', start).lte('payment_date', end)),
    ac(supabase.from('consultations').select('*', { count: 'exact', head: true })
      .in('status', ['예약완료', '방문완료']).gte('created_at', start).lte('created_at', end)),
  ])

  const totalSpend = adStatsRes.data?.reduce((s, r) => s + Number(r.spend_amount), 0) || 0
  const totalLeads = leadsRes.count || 0
  const totalRevenue = paymentsRes.data?.reduce((s, r) => s + Number(r.payment_amount), 0) || 0
  const bookedCount = consultRes.count || 0

  return NextResponse.json({
    cpl: totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0,
    roas: totalSpend > 0 ? Number((totalRevenue / totalSpend).toFixed(2)) : 0,
    bookingRate: totalLeads > 0 ? Number(((bookedCount / totalLeads) * 100).toFixed(1)) : 0,
    totalRevenue,
    totalLeads,
    totalSpend,
  })
}

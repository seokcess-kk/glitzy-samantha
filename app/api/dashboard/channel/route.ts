import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serverSupabase } from '@/lib/supabase'
import { getClinicId } from '@/lib/session'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = serverSupabase()
  const clinicId = await getClinicId(req.url)

  const ac = (q: any) => clinicId ? q.eq('clinic_id', clinicId) : q

  const [adStatsRes, customersRes, paymentsRes] = await Promise.all([
    ac(supabase.from('ad_campaign_stats').select('platform, spend_amount')),
    ac(supabase.from('customers').select('id, first_source').in('first_source', ['Meta', 'Google', 'TikTok'])),
    ac(supabase.from('payments').select('payment_amount, customer_id')),
  ])

  const customerSourceMap = new Map((customersRes.data || []).map(c => [c.id, c.first_source]))

  const spendByPlatform: Record<string, number> = {}
  for (const row of adStatsRes.data || []) {
    spendByPlatform[row.platform] = (spendByPlatform[row.platform] || 0) + Number(row.spend_amount)
  }

  const leadsBySource: Record<string, number> = {}
  for (const c of customersRes.data || []) {
    if (c.first_source) leadsBySource[c.first_source] = (leadsBySource[c.first_source] || 0) + 1
  }

  const revenueBySource: Record<string, number> = {}
  for (const p of paymentsRes.data || []) {
    const source = customerSourceMap.get(p.customer_id) as string | undefined
    if (source) revenueBySource[source] = (revenueBySource[source] || 0) + Number(p.payment_amount)
  }

  const result = ['Meta', 'Google', 'TikTok'].map(platform => {
    const spend = spendByPlatform[platform] || 0
    const leads = leadsBySource[platform] || 0
    const revenue = revenueBySource[platform] || 0
    return {
      channel: platform,
      cpl: leads > 0 ? Math.round(spend / leads) : 0,
      roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : 0,
      leads,
    }
  })

  return NextResponse.json(result)
}

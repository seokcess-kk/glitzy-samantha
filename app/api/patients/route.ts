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

  let query = supabase
    .from('customers')
    .select('*, consultations(*), payments(*)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (clinicId) query = query.eq('clinic_id', clinicId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

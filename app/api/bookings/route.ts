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
    .from('bookings')
    .select('*, customer:customers(id, name, phone_number)')
    .order('booking_datetime', { ascending: true })

  if (clinicId) query = query.eq('clinic_id', clinicId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, status, notes } = await req.json()
  const supabase = serverSupabase()

  const { data, error } = await supabase
    .from('bookings')
    .update({ status, notes })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

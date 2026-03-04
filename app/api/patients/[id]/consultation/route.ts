import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serverSupabase } from '@/lib/supabase'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = serverSupabase()
  const { status, notes, consultationDate } = await req.json()
  const customerId = Number(params.id)

  const { data: existing } = await supabase
    .from('consultations')
    .select('id')
    .eq('customer_id', customerId)
    .maybeSingle()

  let result
  if (existing) {
    result = await supabase
      .from('consultations')
      .update({ status, notes, consultation_date: consultationDate || null })
      .eq('id', existing.id)
      .select()
      .single()
  } else {
    result = await supabase
      .from('consultations')
      .insert({ customer_id: customerId, status, notes, consultation_date: consultationDate || null })
      .select()
      .single()
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json(result.data)
}

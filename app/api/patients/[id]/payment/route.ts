import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serverSupabase } from '@/lib/supabase'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = serverSupabase()
  const { treatmentName, paymentAmount, paymentDate } = await req.json()
  const customerId = Number(params.id)

  if (!treatmentName || !paymentAmount) {
    return NextResponse.json({ error: '시술명과 결제 금액은 필수입니다.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('payments')
    .insert({
      customer_id: customerId,
      treatment_name: treatmentName,
      payment_amount: Number(paymentAmount),
      payment_date: paymentDate || new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

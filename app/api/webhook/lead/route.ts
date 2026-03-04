import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import { qstash } from '@/lib/qstash'

export async function POST(req: Request) {
  let body: { name?: string; phoneNumber?: string; campaignId?: string; source?: string; inflowUrl?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const { name, phoneNumber, campaignId, source, inflowUrl } = body
  if (!phoneNumber) {
    return NextResponse.json({ error: '전화번호는 필수입니다.' }, { status: 400 })
  }

  const supabase = serverSupabase()
  try {
    // 1. 고객 조회 (전화번호 기준)
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('*')
      .eq('phone_number', phoneNumber)
      .maybeSingle()

    let customer = existingCustomer
    if (!customer) {
      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert({ phone_number: phoneNumber, name, first_source: source || 'Unknown', first_campaign_id: campaignId })
        .select()
        .single()
      if (error) throw error
      customer = newCustomer
    }

    // 2. 리드 기록 생성
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({ customer_id: customer.id, campaign_id: campaignId, inflow_url: inflowUrl, chatbot_sent: false })
      .select()
      .single()
    if (leadError) throw leadError

    // 3. QStash로 5분 후 챗봇 발송 스케줄
    if (process.env.QSTASH_TOKEN) {
      await qstash.publishJSON({
        url: `${process.env.NEXTAUTH_URL}/api/qstash/chatbot`,
        body: { leadId: lead.id, phoneNumber, name },
        delay: 300,
      })
    }

    return NextResponse.json({
      success: true,
      message: '리드가 등록되고 5분 내 챗봇 발송 스케줄이 설정되었습니다.',
      leadId: lead.id,
      customerId: customer.id,
    })
  } catch (err: unknown) {
    console.error('[Webhook Error]', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

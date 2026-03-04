import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { serverSupabase } from '@/lib/supabase'

// POST /api/seed?secret=YOUR_CRON_SECRET
export async function POST(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get('secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = serverSupabase()

  // 1. 병원(clinics) 생성
  const { data: clinics } = await supabase
    .from('clinics')
    .upsert([
      { name: '미래성형외과', slug: 'mirae' },
      { name: '강남피부과의원', slug: 'kangnam' },
      { name: '서울치과', slug: 'seoul' },
    ], { onConflict: 'slug' })
    .select()

  if (!clinics || clinics.length < 3) {
    return NextResponse.json({ error: '병원 생성 실패' }, { status: 500 })
  }
  const [c1, c2, c3] = clinics

  // 2. 사용자(users) 생성
  const hash = await bcrypt.hash('password123', 10)
  await supabase.from('users').upsert([
    { username: 'superadmin', password_hash: hash, role: 'superadmin', clinic_id: null },
    { username: 'mirae_admin', password_hash: hash, role: 'clinic_admin', clinic_id: c1.id },
    { username: 'kangnam_admin', password_hash: hash, role: 'clinic_admin', clinic_id: c2.id },
    { username: 'seoul_admin', password_hash: hash, role: 'clinic_admin', clinic_id: c3.id },
  ], { onConflict: 'username' })

  // 3. 고객(customers) 생성 - 병원당 5명
  const customersData = [
    // 미래성형외과
    { clinic_id: c1.id, phone_number: '010-1111-0001', name: '김민지', first_source: 'Meta', first_campaign_id: 'meta_001' },
    { clinic_id: c1.id, phone_number: '010-1111-0002', name: '이수진', first_source: 'Google', first_campaign_id: 'google_001' },
    { clinic_id: c1.id, phone_number: '010-1111-0003', name: '박지현', first_source: 'Meta', first_campaign_id: 'meta_002' },
    { clinic_id: c1.id, phone_number: '010-1111-0004', name: '정하은', first_source: 'TikTok', first_campaign_id: 'tiktok_001' },
    { clinic_id: c1.id, phone_number: '010-1111-0005', name: '최서연', first_source: 'Google', first_campaign_id: 'google_002' },
    // 강남피부과
    { clinic_id: c2.id, phone_number: '010-2222-0001', name: '윤아름', first_source: 'Meta', first_campaign_id: 'meta_003' },
    { clinic_id: c2.id, phone_number: '010-2222-0002', name: '강나연', first_source: 'Meta', first_campaign_id: 'meta_004' },
    { clinic_id: c2.id, phone_number: '010-2222-0003', name: '임소희', first_source: 'Google', first_campaign_id: 'google_003' },
    { clinic_id: c2.id, phone_number: '010-2222-0004', name: '한예은', first_source: 'TikTok', first_campaign_id: 'tiktok_002' },
    { clinic_id: c2.id, phone_number: '010-2222-0005', name: '신유리', first_source: 'Meta', first_campaign_id: 'meta_005' },
    // 서울치과
    { clinic_id: c3.id, phone_number: '010-3333-0001', name: '오준서', first_source: 'Google', first_campaign_id: 'google_004' },
    { clinic_id: c3.id, phone_number: '010-3333-0002', name: '배민준', first_source: 'Meta', first_campaign_id: 'meta_006' },
    { clinic_id: c3.id, phone_number: '010-3333-0003', name: '권지호', first_source: 'Google', first_campaign_id: 'google_005' },
    { clinic_id: c3.id, phone_number: '010-3333-0004', name: '장태양', first_source: 'TikTok', first_campaign_id: 'tiktok_003' },
    { clinic_id: c3.id, phone_number: '010-3333-0005', name: '류성민', first_source: 'Meta', first_campaign_id: 'meta_007' },
  ]

  const { data: customers } = await supabase
    .from('customers')
    .upsert(customersData, { onConflict: 'phone_number' })
    .select()

  if (!customers) return NextResponse.json({ error: '고객 생성 실패' }, { status: 500 })

  // 4. 리드(leads) 생성
  const leadsData = customers.map((c, i) => ({
    clinic_id: c.clinic_id,
    customer_id: c.id,
    campaign_id: c.first_campaign_id,
    inflow_url: `https://form.mmi.kr/lead?src=${c.first_source?.toLowerCase()}`,
    chatbot_sent: i % 3 !== 0,
    chatbot_sent_at: i % 3 !== 0 ? new Date(Date.now() - i * 2 * 24 * 60 * 60 * 1000).toISOString() : null,
  }))
  await supabase.from('leads').upsert(leadsData, { onConflict: 'customer_id' })

  // 5. 예약(bookings) 생성
  const statuses = ['confirmed', 'visited', 'cancelled', 'noshow', 'confirmed']
  const treatments = ['쌍꺼풀', '코 성형', '보톡스', '필러', '레이저', '임플란트', '미백']
  const bookingsData = customers.map((c, i) => ({
    clinic_id: c.clinic_id,
    customer_id: c.id,
    booking_datetime: new Date(Date.now() + (i - 7) * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000).toISOString(),
    status: statuses[i % statuses.length],
    notes: `${treatments[i % treatments.length]} 상담 예약`,
    chatbot_confirmed_at: new Date(Date.now() - i * 3 * 60 * 60 * 1000).toISOString(),
  }))
  await supabase.from('bookings').insert(bookingsData)

  // 6. 상담(consultations) 생성
  const consultStatuses = ['예약완료', '방문완료', '노쇼', '상담중', '취소']
  const consultData = customers.slice(0, 12).map((c, i) => ({
    clinic_id: c.clinic_id,
    customer_id: c.id,
    consultation_date: new Date(Date.now() - i * 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: consultStatuses[i % consultStatuses.length],
    notes: `${treatments[i % treatments.length]} 상담 진행`,
  }))
  await supabase.from('consultations').insert(consultData)

  // 7. 결제(payments) 생성
  const paymentAmounts = [1500000, 800000, 350000, 2200000, 550000, 1800000, 950000]
  const paymentsData = customers.slice(0, 10).map((c, i) => ({
    clinic_id: c.clinic_id,
    customer_id: c.id,
    treatment_name: treatments[i % treatments.length],
    payment_amount: paymentAmounts[i % paymentAmounts.length],
    payment_date: new Date(Date.now() - i * 3 * 24 * 60 * 60 * 1000).toISOString(),
  }))
  await supabase.from('payments').insert(paymentsData)

  // 8. 광고 통계(ad_campaign_stats) 생성 - 병원별 3매체 x 10일
  const platforms = ['Meta', 'Google', 'TikTok']
  const adStats: any[] = []
  const clinicsList = [c1, c2, c3]

  for (const clinic of clinicsList) {
    for (const platform of platforms) {
      for (let d = 0; d < 10; d++) {
        const date = new Date(Date.now() - d * 24 * 60 * 60 * 1000)
        const dateStr = date.toISOString().split('T')[0]
        adStats.push({
          clinic_id: clinic.id,
          platform,
          campaign_id: `${platform.toLowerCase()}_${clinic.slug}_camp_${d % 3 + 1}`,
          campaign_name: `${clinic.name} ${platform} 캠페인 ${d % 3 + 1}`,
          spend_amount: Math.round((Math.random() * 500000 + 100000) / 1000) * 1000,
          clicks: Math.floor(Math.random() * 500 + 50),
          impressions: Math.floor(Math.random() * 20000 + 5000),
          stat_date: dateStr,
        })
      }
    }
  }
  await supabase.from('ad_campaign_stats').upsert(adStats, { onConflict: 'platform,campaign_id,stat_date' })

  return NextResponse.json({
    success: true,
    message: '더미데이터 생성 완료',
    counts: {
      clinics: 3,
      users: 4,
      customers: customers.length,
      bookings: bookingsData.length,
      consultations: consultData.length,
      payments: paymentsData.length,
      adStats: adStats.length,
    },
  })
}

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

  // 3. 광고 유입 고객(customers) - 병원당 5명
  const adCustomersData = [
    { clinic_id: c1.id, phone_number: '010-1111-0001', name: '김민지', first_source: 'Meta', first_campaign_id: 'meta_001' },
    { clinic_id: c1.id, phone_number: '010-1111-0002', name: '이수진', first_source: 'Google', first_campaign_id: 'google_001' },
    { clinic_id: c1.id, phone_number: '010-1111-0003', name: '박지현', first_source: 'Meta', first_campaign_id: 'meta_002' },
    { clinic_id: c1.id, phone_number: '010-1111-0004', name: '정하은', first_source: 'TikTok', first_campaign_id: 'tiktok_001' },
    { clinic_id: c1.id, phone_number: '010-1111-0005', name: '최서연', first_source: 'Google', first_campaign_id: 'google_002' },
    { clinic_id: c2.id, phone_number: '010-2222-0001', name: '윤아름', first_source: 'Meta', first_campaign_id: 'meta_003' },
    { clinic_id: c2.id, phone_number: '010-2222-0002', name: '강나연', first_source: 'Meta', first_campaign_id: 'meta_004' },
    { clinic_id: c2.id, phone_number: '010-2222-0003', name: '임소희', first_source: 'Google', first_campaign_id: 'google_003' },
    { clinic_id: c2.id, phone_number: '010-2222-0004', name: '한예은', first_source: 'TikTok', first_campaign_id: 'tiktok_002' },
    { clinic_id: c2.id, phone_number: '010-2222-0005', name: '신유리', first_source: 'Meta', first_campaign_id: 'meta_005' },
    { clinic_id: c3.id, phone_number: '010-3333-0001', name: '오준서', first_source: 'Google', first_campaign_id: 'google_004' },
    { clinic_id: c3.id, phone_number: '010-3333-0002', name: '배민준', first_source: 'Meta', first_campaign_id: 'meta_006' },
    { clinic_id: c3.id, phone_number: '010-3333-0003', name: '권지호', first_source: 'Google', first_campaign_id: 'google_005' },
    { clinic_id: c3.id, phone_number: '010-3333-0004', name: '장태양', first_source: 'TikTok', first_campaign_id: 'tiktok_003' },
    { clinic_id: c3.id, phone_number: '010-3333-0005', name: '류성민', first_source: 'Meta', first_campaign_id: 'meta_007' },
  ]

  const { data: adCustomers } = await supabase
    .from('customers')
    .upsert(adCustomersData, { onConflict: 'phone_number' })
    .select()

  if (!adCustomers) return NextResponse.json({ error: '고객 생성 실패' }, { status: 500 })

  // 4. 콘텐츠 유입 고객 - 병원당 10명 (utm_campaign으로 구분)
  const contentCampaigns = [
    { campaign: '2026_brand_youtube',       source: 'YouTube',   count: 3 },
    { campaign: '2026_brand_insta_feed',    source: 'Instagram', count: 2 },
    { campaign: '2026_brand_insta_reels',   source: 'Instagram', count: 2 },
    { campaign: '2026_brand_tiktok',        source: 'TikTok',    count: 2 },
    { campaign: '2026_brand_blog',          source: 'Naver',     count: 1 },
  ]
  const contentNames = [
    ['조은서', '황예지', '송민아', '안지혜', '유혜린', '허수진', '남예원', '문가영', '홍채원', '변수아'],
    ['채지수', '공유나', '변민경', '연다은', '방소연', '엄지현', '고나은', '심유리', '표은지', '노세린'],
    ['탁민준', '음성호', '강태양', '라진호', '마성현', '사도현', '하준혁', '유재원', '조태한', '백민서'],
  ]
  const clinicsList = [c1, c2, c3]

  const contentCustomersData: any[] = []
  clinicsList.forEach((clinic, ci) => {
    let nameIdx = 0
    contentCampaigns.forEach(({ campaign, source, count }) => {
      for (let i = 0; i < count; i++) {
        const name = contentNames[ci][nameIdx % contentNames[ci].length]
        nameIdx++
        contentCustomersData.push({
          clinic_id: clinic.id,
          phone_number: `010-${5000 + ci * 100 + nameIdx}-${String(ci * 10 + i).padStart(4, '0')}`,
          name,
          first_source: source,
          first_campaign_id: campaign,
        })
      }
    })
  })

  const { data: contentCustomers } = await supabase
    .from('customers')
    .upsert(contentCustomersData, { onConflict: 'phone_number' })
    .select()

  const allCustomers = [...adCustomers, ...(contentCustomers || [])]

  // 5. 리드 생성
  const leadsData = allCustomers.map((c, i) => ({
    clinic_id: c.clinic_id,
    customer_id: c.id,
    campaign_id: c.first_campaign_id,
    inflow_url: `https://form.mmi.kr/lead?src=${(c.first_source || '').toLowerCase()}&utm_campaign=${c.first_campaign_id}`,
    chatbot_sent: i % 3 !== 0,
    chatbot_sent_at: i % 3 !== 0 ? new Date(Date.now() - i * 2 * 24 * 60 * 60 * 1000).toISOString() : null,
  }))
  await supabase.from('leads').upsert(leadsData, { onConflict: 'customer_id' })

  // 6. 예약(bookings) 생성 - 광고 유입 고객 기준
  const statuses = ['confirmed', 'visited', 'cancelled', 'noshow', 'confirmed']
  const treatments = ['쌍꺼풀', '코 성형', '보톡스', '필러', '레이저', '임플란트', '미백']
  const bookingsData = adCustomers.map((c, i) => ({
    clinic_id: c.clinic_id,
    customer_id: c.id,
    booking_datetime: new Date(Date.now() + (i - 7) * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000).toISOString(),
    status: statuses[i % statuses.length],
    notes: `${treatments[i % treatments.length]} 상담 예약`,
    chatbot_confirmed_at: new Date(Date.now() - i * 3 * 60 * 60 * 1000).toISOString(),
  }))
  await supabase.from('bookings').insert(bookingsData)

  // 7. 상담 생성
  const consultStatuses = ['예약완료', '방문완료', '노쇼', '상담중', '취소']
  const consultData = adCustomers.slice(0, 12).map((c, i) => ({
    clinic_id: c.clinic_id,
    customer_id: c.id,
    consultation_date: new Date(Date.now() - i * 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: consultStatuses[i % consultStatuses.length],
    notes: `${treatments[i % treatments.length]} 상담 진행`,
  }))
  await supabase.from('consultations').insert(consultData)

  // 8. 결제 - 광고 유입 고객 (10건) + 콘텐츠 유입 고객 (7건/클리닉)
  const paymentAmounts = [1500000, 800000, 350000, 2200000, 550000, 1800000, 950000]
  const adPayments = adCustomers.slice(0, 10).map((c, i) => ({
    clinic_id: c.clinic_id,
    customer_id: c.id,
    treatment_name: treatments[i % treatments.length],
    payment_amount: paymentAmounts[i % paymentAmounts.length],
    payment_date: new Date(Date.now() - i * 3 * 24 * 60 * 60 * 1000).toISOString(),
  }))

  // 콘텐츠 유입 결제 - 각 클리닉의 콘텐츠 고객 중 7명
  const contentPayments: any[] = []
  if (contentCustomers) {
    const perClinic = 10 // contentCampaigns 합산 count
    clinicsList.forEach((clinic, ci) => {
      const slice = contentCustomers.filter(c => c.clinic_id === clinic.id).slice(0, 7)
      slice.forEach((c, i) => {
        contentPayments.push({
          clinic_id: c.clinic_id,
          customer_id: c.id,
          treatment_name: treatments[(ci * 7 + i) % treatments.length],
          payment_amount: paymentAmounts[(ci * 7 + i) % paymentAmounts.length],
          payment_date: new Date(Date.now() - (ci * 10 + i) * 2 * 24 * 60 * 60 * 1000).toISOString(),
        })
      })
    })
  }
  await supabase.from('payments').insert([...adPayments, ...contentPayments])

  // 9. 광고 통계 생성
  const platforms = ['Meta', 'Google', 'TikTok']
  const adStats: any[] = []
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

  // 10. 브랜드 콘텐츠 + 통계
  let contentPostCount = 0
  let contentStatCount = 0

  try {
    const budgetByPlatform: Record<string, number> = {
      youtube: 500000, instagram_feed: 200000, instagram_reels: 300000,
      tiktok: 250000, naver_blog: 150000,
    }
    const utmCampaigns: Record<string, string> = {
      youtube: '2026_brand_youtube', instagram_feed: '2026_brand_insta_feed',
      instagram_reels: '2026_brand_insta_reels', tiktok: '2026_brand_tiktok', naver_blog: '2026_brand_blog',
    }
    const utmSources: Record<string, string> = {
      youtube: 'youtube', instagram_feed: 'instagram', instagram_reels: 'instagram',
      tiktok: 'tiktok', naver_blog: 'naver',
    }
    const utmMediums: Record<string, string> = {
      youtube: 'video', instagram_feed: 'social', instagram_reels: 'short',
      tiktok: 'short', naver_blog: 'blog',
    }

    const clinicTitles: Record<string, string[]> = {
      [c1.id]: ['쌍꺼풀 수술 전후 비교', '코 성형 회복 과정', '자연스러운 눈 성형 브이로그', '성형 Q&A 라이브', '안검하수 교정 후기'],
      [c2.id]: ['레이저 토닝 효과 비교', '피부과 시술 종류 소개', '여드름 흉터 제거 전후', '피부 관리 루틴 공개', '보톡스 시술 브이로그'],
      [c3.id]: ['임플란트 시술 과정', '치아 미백 전후 비교', '교정 완성 후기 인터뷰', '스케일링 Q&A', '라미네이트 변신 사례'],
    }
    const contentPlatforms = [
      { platform: 'youtube', count: 3 },
      { platform: 'instagram_feed', count: 3 },
      { platform: 'instagram_reels', count: 2 },
      { platform: 'tiktok', count: 2 },
      { platform: 'naver_blog', count: 2 },
    ]

    const allPosts: any[] = []
    for (const clinic of clinicsList) {
      const titles = clinicTitles[clinic.id]
      let titleIdx = 0
      for (const { platform, count } of contentPlatforms) {
        for (let i = 0; i < count; i++) {
          const daysAgo = Math.floor(Math.random() * 60) + 1
          allPosts.push({
            clinic_id: clinic.id,
            platform,
            content_id: `seed_${clinic.slug}_${platform}_${i + 1}`,
            title: `[${clinic.name}] ${titles[titleIdx % titles.length]}`,
            url: `https://example.com/${platform}/${clinic.slug}_${i + 1}`,
            published_at: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
            utm_source: utmSources[platform],
            utm_medium: utmMediums[platform],
            utm_campaign: utmCampaigns[platform],
            utm_content: `${clinic.slug}_${platform}_content${i + 1}`,
            budget: budgetByPlatform[platform],
            is_api_synced: false,
          })
          titleIdx++
        }
      }
    }

    const { data: insertedPosts } = await supabase
      .from('content_posts')
      .upsert(allPosts, { onConflict: 'clinic_id,platform,content_id' })
      .select('id, platform')

    contentPostCount = insertedPosts?.length || 0

    if (insertedPosts?.length) {
      const statsRows: any[] = []
      const viewsBase: Record<string, number> = {
        youtube: 5000, instagram_feed: 1500, instagram_reels: 8000, tiktok: 12000, naver_blog: 800,
      }
      const likesBase: Record<string, number> = {
        youtube: 200, instagram_feed: 300, instagram_reels: 600, tiktok: 900, naver_blog: 20,
      }
      for (const post of insertedPosts) {
        const base = viewsBase[post.platform] || 1000
        const likeBase = likesBase[post.platform] || 100
        for (let d = 0; d < 7; d++) {
          const date = new Date(Date.now() - d * 24 * 60 * 60 * 1000)
          statsRows.push({
            post_id: post.id,
            stat_date: date.toISOString().split('T')[0],
            views: Math.floor(base * (1 - d * 0.04) * (0.8 + Math.random() * 0.4)),
            likes: Math.floor(likeBase * (1 - d * 0.04) * (0.8 + Math.random() * 0.4)),
            comments: Math.floor(likeBase * 0.1 * (1 - d * 0.04)),
            shares: Math.floor(likeBase * 0.05 * (1 - d * 0.04)),
            saves: Math.floor(likeBase * 0.08 * (1 - d * 0.04)),
          })
        }
      }
      await supabase.from('content_stats').upsert(statsRows, { onConflict: 'post_id,stat_date' })
      contentStatCount = statsRows.length
    }
  } catch (e) {
    console.warn('[Seed] content 테이블 오류:', e)
  }

  return NextResponse.json({
    success: true,
    message: '더미데이터 생성 완료',
    counts: {
      clinics: 3, users: 4,
      adCustomers: adCustomers.length,
      contentCustomers: contentCustomers?.length || 0,
      bookings: bookingsData.length,
      consultations: consultData.length,
      payments: adPayments.length + contentPayments.length,
      adStats: adStats.length,
      contentPosts: contentPostCount,
      contentStats: contentStatCount,
    },
  })
}

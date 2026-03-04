// SQL to create content_audits table in Supabase:
// CREATE TABLE content_audits (
//   id bigserial primary key,
//   clinic_id int references clinics(id),
//   post_id bigint references content_posts(id) on delete cascade,
//   risk_score int default 0,
//   risk_level text default 'safe',   -- safe | caution | danger
//   findings jsonb default '[]',
//   summary text,
//   analyzed_at timestamptz default now(),
//   unique(post_id)
// );

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serverSupabase } from '@/lib/supabase'
import { getClinicId } from '@/lib/session'

// GET /api/content/audit  — list posts with their latest audit
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = serverSupabase()
  const clinicId = await getClinicId(req.url)

  // 텍스트 기반 콘텐츠만 분석 대상: 네이버 블로그, 인스타그램 피드 (reels 제외)
  let query = supabase
    .from('content_posts')
    .select('*, audit:content_audits(risk_score, risk_level, findings, summary, analyzed_at)')
    .in('platform', ['Naver', 'Instagram'])
    .not('utm_campaign', 'like', '%reels%')
    .order('published_at', { ascending: false })
    .limit(100)

  if (clinicId) query = query.eq('clinic_id', clinicId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flatten latest audit
  const posts = (data || []).map((p: any) => {
    const audits = Array.isArray(p.audit) ? p.audit : []
    const latest = audits[audits.length - 1] || null
    return { ...p, audit: latest }
  })

  return NextResponse.json(posts)
}

// POST /api/content/audit  — analyze a single post
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { post_id } = await req.json()
  if (!post_id) return NextResponse.json({ error: 'post_id required' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })

  const supabase = serverSupabase()

  // Fetch post details
  const { data: post, error: postError } = await supabase
    .from('content_posts')
    .select('*')
    .eq('id', post_id)
    .single()

  if (postError || !post) return NextResponse.json({ error: '포스트를 찾을 수 없습니다.' }, { status: 404 })

  const prompt = `당신은 한국 의료광고법 전문가입니다. 다음 의료 마케팅 콘텐츠를 분석해주세요.

플랫폼: ${post.platform}
콘텐츠 제목: ${post.post_title}
UTM 캠페인: ${post.utm_campaign || '없음'}
URL: ${post.post_url || '없음'}

다음 6가지 항목을 체크하고 JSON으로만 응답하세요 (다른 텍스트 없이):
1. 효과 과장 - 치료 효과나 결과를 과도하게 주장
2. 전후 사진 - before/after 사진 비교 언급
3. 체험담/후기 - 특정인의 경험담이나 후기 인용
4. 비교 광고 - 타 병원 또는 의사와 비교
5. 미인증 기술 - 검증되지 않은 시술이나 기기 언급
6. 가격 과대광고 - 비현실적인 할인가나 최저가 주장

응답 JSON 형식:
{
  "risk_score": 0에서 100사이의 숫자,
  "risk_level": "safe" 또는 "caution" 또는 "danger",
  "findings": [
    { "category": "항목명", "detected": true 또는 false, "detail": "근거 설명" }
  ],
  "summary": "전체 요약 한 줄"
}`

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!aiRes.ok) {
      const err = await aiRes.text()
      return NextResponse.json({ error: `AI 분석 실패: ${err}` }, { status: 500 })
    }

    const aiData = await aiRes.json()
    const text = aiData.content?.[0]?.text || '{}'
    let parsed: any = {}
    try { parsed = JSON.parse(text) } catch { parsed = { risk_score: 0, risk_level: 'safe', findings: [], summary: '분석 실패' } }

    // Upsert to content_audits
    const { data: audit, error: auditError } = await supabase
      .from('content_audits')
      .upsert({
        clinic_id:   post.clinic_id,
        post_id,
        risk_score:  parsed.risk_score  ?? 0,
        risk_level:  parsed.risk_level  ?? 'safe',
        findings:    parsed.findings    ?? [],
        summary:     parsed.summary     ?? '',
        analyzed_at: new Date().toISOString(),
      }, { onConflict: 'post_id' })
      .select()
      .single()

    if (auditError) return NextResponse.json({ error: auditError.message }, { status: 500 })
    return NextResponse.json(audit)

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

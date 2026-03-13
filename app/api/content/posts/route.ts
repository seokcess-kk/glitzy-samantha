import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, apiError } from '@/lib/api-middleware'

// 콘텐츠 목록 조회 (최신 통계 포함)
export const GET = withClinicFilter(async (req: Request, { clinicId }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const platform = url.searchParams.get('platform')

  let query = supabase
    .from('content_posts')
    .select('*, stats:content_stats(views, likes, comments, shares, saves, reach, impressions, stat_date)')
    .order('published_at', { ascending: false })

  if (clinicId) query = query.eq('clinic_id', clinicId)
  if (platform && platform !== 'all') query = query.eq('platform', platform)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
})

// 수기 콘텐츠 추가
export const POST = withClinicFilter(async (req: Request, { clinicId }: ClinicContext) => {
  const supabase = serverSupabase()
  const body = await req.json()

  const { title, url, platform, published_at, thumbnail_url,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    views, likes, comments, shares, saves } = body

  if (!title || !platform) return NextResponse.json({ error: '제목과 플랫폼을 입력해주세요.' }, { status: 400 })

  const { data: post, error: postErr } = await supabase
    .from('content_posts')
    .insert({
      clinic_id: clinicId,
      platform,
      title,
      url,
      thumbnail_url,
      published_at: published_at || null,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      is_api_synced: false,
    })
    .select()
    .single()

  if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 })

  // 초기 통계 입력
  if (views || likes || comments || shares || saves) {
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('content_stats').insert({
      post_id: post.id,
      stat_date: today,
      views: views || 0,
      likes: likes || 0,
      comments: comments || 0,
      shares: shares || 0,
      saves: saves || 0,
    })
  }

  return NextResponse.json(post)
})

// 통계 수기 업데이트
export const PUT = withClinicFilter(async (req: Request, { clinicId, user }: ClinicContext) => {
  const supabase = serverSupabase()
  const { post_id, stat_date, views, likes, comments, shares, saves } = await req.json()

  if (!post_id) return apiError('post_id required')

  // 리소스 소유권 검증: clinic_admin은 자신의 병원 포스트만 수정 가능
  if (user.role === 'clinic_admin') {
    const { data: post } = await supabase.from('content_posts').select('clinic_id').eq('id', post_id).single()
    if (!post || post.clinic_id !== clinicId) {
      return apiError('권한이 없습니다.', 403)
    }
  }

  const date = stat_date || new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('content_stats')
    .upsert({ post_id, stat_date: date, views: views || 0, likes: likes || 0, comments: comments || 0, shares: shares || 0, saves: saves || 0 },
      { onConflict: 'post_id,stat_date' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
})

// 예산 업데이트 (budget 필드만)
export const PATCH = withClinicFilter(async (req: Request, { clinicId, user }: ClinicContext) => {
  const supabase = serverSupabase()
  const { id, budget } = await req.json()
  if (!id) return apiError('id required')

  // 리소스 소유권 검증
  if (user.role === 'clinic_admin') {
    const { data: post } = await supabase.from('content_posts').select('clinic_id').eq('id', id).single()
    if (!post || post.clinic_id !== clinicId) {
      return apiError('권한이 없습니다.', 403)
    }
  }

  const { data, error } = await supabase
    .from('content_posts')
    .update({ budget: budget ?? 0 })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
})

// 콘텐츠 삭제
export const DELETE = withClinicFilter(async (req: Request, { clinicId, user }: ClinicContext) => {
  const supabase = serverSupabase()
  const { id } = await req.json()

  if (!id) return apiError('id required')

  // 리소스 소유권 검증
  if (user.role === 'clinic_admin') {
    const { data: post } = await supabase.from('content_posts').select('clinic_id').eq('id', id).single()
    if (!post || post.clinic_id !== clinicId) {
      return apiError('권한이 없습니다.', 403)
    }
  }

  const { error } = await supabase.from('content_posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
})

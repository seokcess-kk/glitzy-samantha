import { serverSupabase } from '@/lib/supabase'

export async function syncInstagramContent(clinicId: number, accessToken: string, userId: string) {
  const supabase = serverSupabase()
  const today = new Date().toISOString().split('T')[0]

  // 1. 미디어 목록 조회
  const mediaRes = await fetch(
    `https://graph.facebook.com/v19.0/${userId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&limit=50&access_token=${accessToken}`
  )
  if (!mediaRes.ok) throw new Error('Instagram 미디어 조회 실패')

  const mediaData = await mediaRes.json()
  if (mediaData.error) throw new Error(mediaData.error.message)

  let count = 0

  for (const media of mediaData.data || []) {
    const isReel = media.media_type === 'REEL'
    const isVideo = media.media_type === 'VIDEO'
    const platform = isReel ? 'instagram_reels' : 'instagram_feed'
    const thumbnailUrl = media.thumbnail_url || (isVideo ? null : media.media_url)

    // 포스트 upsert
    const { data: post } = await supabase
      .from('content_posts')
      .upsert({
        clinic_id: clinicId,
        platform,
        content_id: media.id,
        title: (media.caption || '').slice(0, 100) || `Instagram ${platform === 'instagram_reels' ? '릴스' : '피드'}`,
        url: `https://www.instagram.com/p/${media.id}/`,
        thumbnail_url: thumbnailUrl,
        published_at: media.timestamp,
        is_api_synced: true,
      }, { onConflict: 'clinic_id,platform,content_id' })
      .select('id')
      .single()

    if (!post) continue

    // 기본 통계 upsert (likes, comments)
    // 상세 인사이트(reach, impressions)는 별도 API 필요 → 기본만 수집
    await supabase.from('content_stats').upsert({
      post_id: post.id,
      stat_date: today,
      likes: media.like_count || 0,
      comments: media.comments_count || 0,
    }, { onConflict: 'post_id,stat_date' })

    count++
  }

  console.log(`[Instagram Content] synced ${count} posts for clinic ${clinicId}`)
  return { platform: 'Instagram', count }
}

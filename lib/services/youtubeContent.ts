import { serverSupabase } from '@/lib/supabase'

export async function syncYoutubeContent(clinicId: number, apiKey: string, channelId: string) {
  const supabase = serverSupabase()
  const today = new Date().toISOString().split('T')[0]

  // 1. 채널의 업로드 재생목록 ID 조회
  const channelRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`
  )
  if (!channelRes.ok) throw new Error('YouTube 채널 조회 실패')

  const channelData = await channelRes.json()
  if (!channelData.items?.length) throw new Error('채널을 찾을 수 없습니다.')
  const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads

  // 2. 최근 업로드 영상 목록 (최대 50개)
  const playlistRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}`
  )
  if (!playlistRes.ok) throw new Error('YouTube 재생목록 조회 실패')

  const playlistData = await playlistRes.json()
  const videoIds = (playlistData.items || [])
    .map((item: any) => item.snippet.resourceId.videoId)
    .join(',')

  if (!videoIds) return { platform: 'YouTube', count: 0 }

  // 3. 영상별 통계 조회
  const statsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${apiKey}`
  )
  if (!statsRes.ok) throw new Error('YouTube 영상 통계 조회 실패')

  const statsData = await statsRes.json()
  let count = 0

  for (const video of statsData.items || []) {
    // 포스트 upsert
    const { data: post } = await supabase
      .from('content_posts')
      .upsert({
        clinic_id: clinicId,
        platform: 'youtube',
        content_id: video.id,
        title: video.snippet.title,
        url: `https://www.youtube.com/watch?v=${video.id}`,
        thumbnail_url: video.snippet.thumbnails?.medium?.url || null,
        published_at: video.snippet.publishedAt,
        is_api_synced: true,
      }, { onConflict: 'clinic_id,platform,content_id' })
      .select('id')
      .single()

    if (!post) continue

    // 통계 upsert
    const s = video.statistics
    await supabase.from('content_stats').upsert({
      post_id: post.id,
      stat_date: today,
      views: parseInt(s.viewCount || '0'),
      likes: parseInt(s.likeCount || '0'),
      comments: parseInt(s.commentCount || '0'),
    }, { onConflict: 'post_id,stat_date' })

    count++
  }

  console.log(`[YouTube Content] synced ${count} videos for clinic ${clinicId}`)
  return { platform: 'YouTube', count }
}

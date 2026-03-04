import { NextResponse } from 'next/server'
import { fetchMetaAds } from '@/lib/services/metaAds'
import { fetchGoogleAds } from '@/lib/services/googleAds'
import { fetchTikTokAds } from '@/lib/services/tiktokAds'

export const maxDuration = 60

// Vercel Cron이 매일 새벽 3시에 호출 (vercel.json 참고)
export async function GET(req: Request) {
  // Vercel Cron 인증 확인
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const [metaResult, googleResult, tiktokResult] = await Promise.allSettled([
    fetchMetaAds(yesterday),
    fetchGoogleAds(yesterday),
    fetchTikTokAds(yesterday),
  ])

  console.log('[CronJob] 광고 데이터 자동 수집 완료')
  return NextResponse.json({
    success: true,
    results: {
      meta: metaResult.status === 'fulfilled' ? metaResult.value.count : 'failed',
      google: googleResult.status === 'fulfilled' ? googleResult.value.count : 'failed',
      tiktok: tiktokResult.status === 'fulfilled' ? tiktokResult.value.count : 'failed',
    },
  })
}

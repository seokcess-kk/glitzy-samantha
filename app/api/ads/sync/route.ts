import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { fetchMetaAds } from '@/lib/services/metaAds'
import { fetchGoogleAds } from '@/lib/services/googleAds'
import { fetchTikTokAds } from '@/lib/services/tiktokAds'

export const maxDuration = 60

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const [metaResult, googleResult, tiktokResult] = await Promise.allSettled([
    fetchMetaAds(yesterday),
    fetchGoogleAds(yesterday),
    fetchTikTokAds(yesterday),
  ])

  return NextResponse.json({
    success: true,
    results: {
      meta: metaResult.status === 'fulfilled' ? metaResult.value.count : 'failed',
      google: googleResult.status === 'fulfilled' ? googleResult.value.count : 'failed',
      tiktok: tiktokResult.status === 'fulfilled' ? tiktokResult.value.count : 'failed',
    },
  })
}

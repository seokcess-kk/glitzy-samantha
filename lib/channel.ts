/**
 * 채널명 정규화 — 다양한 utm_source/platform 값을 통일된 채널명으로 변환
 */
export function normalizeChannel(source: string | null | undefined): string {
  if (!source) return 'Unknown'
  const normalized = source.toLowerCase().trim()
  const channelMap: Record<string, string> = {
    'meta': 'Meta', 'facebook': 'Meta', 'fb': 'Meta',
    'google': 'Google', 'gdn': 'Google',
    'youtube': 'YouTube', 'yt': 'YouTube',
    'tiktok': 'TikTok',
    'naver': 'Naver',
    'kakao': 'Kakao',
    'instagram': 'Instagram', 'ig': 'Instagram',
    'phone': 'Phone',
    'direct': 'Direct',
    'organic': 'Organic',
  }
  return channelMap[normalized] || source
}

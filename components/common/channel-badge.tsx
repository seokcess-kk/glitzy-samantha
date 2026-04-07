import { Badge, type BadgeProps } from '@/components/ui/badge'
import { normalizeChannel } from '@/lib/channel'
import { getSourceLabel } from '@/lib/platform'

type ChannelVariant = NonNullable<BadgeProps['variant']>

interface ChannelBadgeProps {
  channel: string
  className?: string
}

const getChannelVariant = (channel: string): ChannelVariant => {
  const lower = channel?.toLowerCase() || ''
  if (lower.includes('meta') || lower.includes('페이스북') || lower.includes('facebook') || lower.includes('인스타') || lower.includes('instagram')) return 'meta'
  if (lower.includes('google') || lower.includes('구글') || lower.includes('youtube') || lower.includes('유튜브')) return 'google'
  if (lower.includes('tiktok') || lower.includes('틱톡')) return 'tiktok'
  if (lower.includes('naver') || lower.includes('네이버')) return 'naver'
  if (lower.includes('kakao') || lower.includes('카카오')) return 'kakao'
  if (lower.includes('dable') || lower.includes('데이블')) return 'dable'
  return 'secondary'
}

/**
 * source 값 → 라벨 변환
 * 세분화 source(google_search)는 getSourceLabel()로 표시,
 * 기존 값(Meta, Google, phone 등)은 normalizeChannel()로 폴백
 */
function resolveLabel(channel: string): string {
  const sourceLabel = getSourceLabel(channel)
  // getSourceLabel이 원본을 그대로 반환하면 매칭 안 된 것 → normalizeChannel 폴백
  if (sourceLabel !== channel) return sourceLabel
  return normalizeChannel(channel)
}

export function ChannelBadge({ channel, className }: ChannelBadgeProps) {
  return (
    <Badge variant={getChannelVariant(channel)} className={className}>
      {resolveLabel(channel)}
    </Badge>
  )
}

/**
 * 광고비 마크업(관리 수수료 등) — 읽기 시점 가산 헬퍼
 *
 * DB 원본(ad_campaign_stats)은 실집행비 그대로 유지하고, 조회 시점에 합의된 일일 정액을
 * 해당 캠페인의 spend에 가산한다. `buildMarkupStatRows`가 만든 "수수료 전용" 합성 행을
 * 각 라우트가 ad_campaign_stats 행과 합쳐 집계하면, spend에서 파생되는 모든 지표
 * (ROAS·CPL·CPC·CAC 등)가 자동으로 일관되게 가산된다.
 *
 * 가산이 노출되는 화면에는 반드시 `MARKUP_HINT`("관리비 포함") 고지를 함께 표시한다.
 * 정산용 external/ad-spend(실집행비)에는 적용하지 않는다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { applyClinicFilter, type ClinicContext } from '@/lib/api-middleware'
import { getKstDateString } from '@/lib/date'

/** 가산된 광고비가 노출되는 화면의 고지 문구 */
export const MARKUP_HINT = '관리비 포함'

export interface AdMarkup {
  clinic_id: number
  platform: string | null
  campaign_id: string | null
  campaign_name: string | null
  daily_amount: number
  effective_from: string // 'YYYY-MM-DD' (KST)
  effective_to: string | null // 'YYYY-MM-DD' (KST) | null=진행 중
  label: string
}

/** ad_campaign_stats 행과 동일 형태의 "수수료 전용" 합성 행 */
export interface MarkupStatRow {
  clinic_id: number
  platform: string | null
  campaign_id: string | null
  campaign_name: string | null
  campaign_type: string | null
  spend_amount: number
  clicks: number
  impressions: number
  stat_date: string // 'YYYY-MM-DD' (KST)
  __markup: true
}

type ScopeCtx = Pick<ClinicContext, 'clinicId' | 'assignedClinicIds'>

/** 조회 범위(clinic_id 필터) 내 활성 마크업 설정 조회 */
export async function fetchAdMarkups(supabase: SupabaseClient, ctx: ScopeCtx): Promise<AdMarkup[]> {
  const base = supabase
    .from('clinic_ad_markup')
    .select('clinic_id, platform, campaign_id, campaign_name, daily_amount, effective_from, effective_to, label')
    .eq('is_active', true)
  const filtered = applyClinicFilter(base, ctx)
  if (filtered === null) return [] // agency_staff 배정 병원 0개
  const { data, error } = await filtered
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map((d) => ({
    clinic_id: Number(d.clinic_id),
    platform: (d.platform as string) ?? null,
    campaign_id: (d.campaign_id as string) ?? null,
    campaign_name: (d.campaign_name as string) ?? null,
    daily_amount: Number(d.daily_amount) || 0,
    effective_from: String(d.effective_from).slice(0, 10),
    effective_to: d.effective_to ? String(d.effective_to).slice(0, 10) : null,
    label: (d.label as string) || MARKUP_HINT,
  }))
}

/** 마크업이 적용되는 [start, end] 범위 내 KST 날짜 목록 (오늘까지로 상한) */
function eligibleDates(m: AdMarkup, start: string | null, end: string | null, today: string): string[] {
  let from = m.effective_from
  if (start && start > from) from = start
  let to = today
  if (end && end < to) to = end
  if (m.effective_to && m.effective_to < to) to = m.effective_to
  if (from > to) return []

  const dates: string[] = []
  const cursor = new Date(`${from}T00:00:00+09:00`)
  let key = getKstDateString(cursor)
  while (key <= to) {
    dates.push(key)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    key = getKstDateString(cursor)
  }
  return dates
}

/**
 * 수수료 전용 합성 행 생성 (마크업 × 적용일 1행씩).
 * ad_campaign_stats 조회 결과에 concat 후 기존 집계 로직을 그대로 태우면 가산이 반영된다.
 */
export function buildMarkupStatRows(
  markups: AdMarkup[],
  start: string | null,
  end: string | null,
  today: string = getKstDateString(),
): MarkupStatRow[] {
  const rows: MarkupStatRow[] = []
  for (const m of markups) {
    if (m.daily_amount <= 0) continue
    for (const d of eligibleDates(m, start, end, today)) {
      rows.push({
        clinic_id: m.clinic_id,
        platform: m.platform,
        campaign_id: m.campaign_id,
        campaign_name: m.campaign_name,
        campaign_type: null,
        spend_amount: m.daily_amount,
        clicks: 0,
        impressions: 0,
        stat_date: d,
        __markup: true,
      })
    }
  }
  return rows
}

/** [start, end] 범위의 가산 총액 (스칼라) — KPI 등 합계 가산용 */
export function markupTotal(
  markups: AdMarkup[],
  start: string | null,
  end: string | null,
  today: string = getKstDateString(),
): number {
  return markups.reduce((sum, m) => {
    if (m.daily_amount <= 0) return sum
    return sum + m.daily_amount * eligibleDates(m, start, end, today).length
  }, 0)
}

/** [start, end] 범위에서 가산이 적용되는 캠페인 ID 목록 (UI 고지 표시용) */
export function markupCampaignIds(
  markups: AdMarkup[],
  start: string | null,
  end: string | null,
  today: string = getKstDateString(),
): string[] {
  const ids = new Set<string>()
  for (const m of markups) {
    if (m.campaign_id && m.daily_amount > 0 && eligibleDates(m, start, end, today).length > 0) {
      ids.add(m.campaign_id)
    }
  }
  return [...ids]
}

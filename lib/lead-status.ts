/**
 * 리드 처리 상태(lead_status) 공유 설정 — 라벨/색상/유효값.
 * 기존엔 `app/(dashboard)/campaigns/page.tsx`에만 있던 설정을 리드 큐 화면과 공유하기 위해 추출.
 * (API 화이트리스트 `VALID_LEAD_STATUSES`(app/api/leads/[id]/route.ts)와 값 집합 일치 유지)
 */

export interface LeadStatusMeta {
  label: string
  color: string
}

/** 선택 가능한 리드 상태 (신규 설정 가능) */
export const LEAD_STATUS_CONFIG: Record<string, LeadStatusMeta> = {
  new: { label: '신규', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  no_answer: { label: '부재', color: 'bg-muted text-muted-foreground border-border dark:bg-slate-500/20 dark:text-slate-400 dark:border-slate-500/30' },
  consulting: { label: '상담중', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  booked: { label: '예약완료', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  hold: { label: '보류', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  rejected: { label: '거절', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

/** 레거시 상태 (표시 전용, 신규 선택 불가) */
export const LEGACY_LEAD_STATUS: Record<string, LeadStatusMeta> = {
  consulted: { label: '상담완료', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
}

/** 선택 가능한 상태 키 (드롭다운 순서) */
export const SELECTABLE_LEAD_STATUSES = ['new', 'no_answer', 'consulting', 'booked', 'hold', 'rejected'] as const

/** 전체 유효 상태 (레거시 consulted 포함) — API 화이트리스트와 일치 */
export const ALL_LEAD_STATUSES = [...SELECTABLE_LEAD_STATUSES, 'consulted'] as const

export function isValidLeadStatus(status: string): boolean {
  return (ALL_LEAD_STATUSES as readonly string[]).includes(status)
}

/** 상태 키 → 표시 메타 (미지정 값은 원문 라벨 폴백) */
export function getLeadStatusMeta(status: string | null | undefined): LeadStatusMeta {
  if (!status) return { label: '미지정', color: 'bg-muted text-muted-foreground border-border' }
  return (
    LEAD_STATUS_CONFIG[status] ||
    LEGACY_LEAD_STATUS[status] || { label: status, color: 'bg-muted text-muted-foreground border-border' }
  )
}

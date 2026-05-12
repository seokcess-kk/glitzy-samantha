'use client'

import { formatDateTime } from '@/lib/date'

export interface LeadNote {
  id: number
  lead_id?: number
  content: string
  created_by: number | null
  created_at: string
  updated_at: string | null
  author: { id: number; username: string } | null
}

interface Props {
  notes: LeadNote[]
  /** 'compact' = 한 줄에 작성자/시각/내용 나란히, 'comfortable' = 위·아래로 배치 */
  density?: 'compact' | 'comfortable'
}

/**
 * 리드 단계 메모 타임라인 — 읽기 전용 표시용.
 * 데이터는 부모가 prefetch한 결과를 props로 전달한다.
 * 편집/삭제는 캠페인 페이지의 LeadCard에서만 수행한다.
 */
export function LeadNotesTimeline({ notes, density = 'compact' }: Props) {
  if (!notes || notes.length === 0) {
    return <p className="text-[11px] text-muted-foreground/60">리드 단계 메모가 없습니다.</p>
  }

  if (density === 'comfortable') {
    return (
      <ul className="space-y-2">
        {notes.map((n, idx) => (
          <li key={n.id} className="space-y-0.5">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
              <span className="inline-flex items-center justify-center min-w-[28px] h-[18px] rounded-full bg-brand-500/15 text-brand-400 text-[10px] font-semibold">
                {idx + 1}차
              </span>
              <span>{n.author?.username || '?'}</span>
              <span className="text-muted-foreground/50">·</span>
              <span>{formatDateTime(n.created_at)}</span>
              {n.updated_at && <span className="text-muted-foreground/40">(수정됨)</span>}
            </div>
            <p className="text-[11px] text-foreground/90 break-all whitespace-pre-wrap pl-[34px]">
              {n.content}
            </p>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className="space-y-1.5">
      {notes.map((n, idx) => (
        <li key={n.id} className="flex items-start gap-2 text-[11px]">
          <span className="shrink-0 inline-flex items-center justify-center min-w-[28px] h-[18px] rounded-full bg-brand-500/15 text-brand-400 text-[10px] font-semibold">
            {idx + 1}차
          </span>
          <span className="shrink-0 text-muted-foreground/70 min-w-[60px] truncate">
            {n.author?.username || '?'}
          </span>
          <span className="shrink-0 text-muted-foreground/50 min-w-[88px]">
            {formatDateTime(n.created_at)}
          </span>
          <span className="flex-1 text-foreground/90 break-all whitespace-pre-wrap">
            {n.content}
            {n.updated_at && <span className="ml-1 text-muted-foreground/40">(수정됨)</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

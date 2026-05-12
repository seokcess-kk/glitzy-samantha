'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'

interface LeadNote {
  id: number
  lead_id: number
  content: string
  created_by: number | null
  created_at: string
  updated_at: string | null
  author: { id: number; username: string } | null
}

interface Props {
  customerId: number
  clinicId?: number | null
  /** 'card' = 우측 패널처럼 좁은 카드용(기본 펼침), 'accordion' = 아코디언 섹션 본문용(기본 펼침) */
  variant?: 'card' | 'accordion'
}

function shortTime(dateStr: string): string {
  const ts = dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr) ? dateStr : dateStr + 'Z'
  return new Date(ts).toLocaleDateString('ko', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' })
}

export function LeadNotesTimeline({ customerId, clinicId, variant = 'accordion' }: Props) {
  const [notes, setNotes] = useState<LeadNote[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(variant === 'accordion')

  useEffect(() => {
    let aborted = false
    const fetchNotes = async () => {
      setLoading(true)
      try {
        const qs = clinicId ? `?clinic_id=${clinicId}` : ''
        const res = await fetch(`/api/patients/${customerId}/lead-notes${qs}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        const list: LeadNote[] = data?.data?.notes || data?.notes || []
        if (!aborted) setNotes(list)
      } catch {
        if (!aborted) setNotes([])
      } finally {
        if (!aborted) setLoading(false)
      }
    }
    fetchNotes()
    return () => { aborted = true }
  }, [customerId, clinicId])

  if (loading) {
    return <p className="text-[11px] text-muted-foreground">리드 메모 불러오는 중...</p>
  }

  if (!notes || notes.length === 0) {
    return <p className="text-[11px] text-muted-foreground/60">리드 단계 메모가 없습니다.</p>
  }

  const list = (
    <ul className="space-y-1.5">
      {notes.map((n, idx) => (
        <li key={n.id} className="flex items-start gap-2 text-[11px]">
          <span className="shrink-0 inline-flex items-center justify-center min-w-[28px] h-[18px] rounded-full bg-brand-500/15 text-brand-400 text-[10px] font-semibold">
            {idx + 1}차
          </span>
          <span className="shrink-0 text-muted-foreground/70 min-w-[60px] truncate">
            {n.author?.username || '?'}
          </span>
          <span className="shrink-0 text-muted-foreground/50 min-w-[36px]">
            {shortTime(n.created_at)}
          </span>
          <span className="flex-1 text-foreground/90 break-all whitespace-pre-wrap">
            {n.content}
            {n.updated_at && <span className="ml-1 text-muted-foreground/40">(수정됨)</span>}
          </span>
        </li>
      ))}
    </ul>
  )

  // 카드 variant — 접기/펴기 가능, 기본 접힘 (최신 1건만 보임)
  if (variant === 'card') {
    const latest = notes[notes.length - 1]
    return (
      <div className="mt-2 pt-2 border-t border-border dark:border-white/5 space-y-1.5">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground/80 transition-colors w-full text-left"
        >
          <MessageSquare size={10} className="shrink-0" />
          <span className="shrink-0">리드 메모</span>
          <span className="shrink-0 text-brand-400 font-semibold">{notes.length}건</span>
          <span className="ml-auto inline-flex items-center gap-0.5 text-muted-foreground/70 shrink-0">
            {expanded ? <>접기 <ChevronUp size={10} /></> : <>펴기 <ChevronDown size={10} /></>}
          </span>
        </button>
        {!expanded ? (
          <p className="text-[10px] text-muted-foreground/80 line-clamp-2 pl-3.5">
            최신: {latest.content}
            {latest.author && <span className="ml-1 text-muted-foreground/50">· {latest.author.username}</span>}
          </p>
        ) : list}
      </div>
    )
  }

  // accordion variant — 항상 펼친 상태 (아코디언이 이미 펼침/접힘 제어)
  return list
}

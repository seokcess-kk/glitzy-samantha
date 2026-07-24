'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ListTodo, UserPlus, Clock, PhoneCall, PauseCircle, MessageSquareDot, CalendarCheck, CalendarX } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface TaskQueues {
  newLeads: number
  staleNewLeads: number
  holdLeads: number
  consultedNotBooked: number
  todayBookings: number
  todayCancelledNoshow: number
  dueCallbacks: number
  staleHours: number
}

type Tone = 'urgent' | 'warn' | 'info' | 'neutral'

interface QueueTile {
  key: keyof Omit<TaskQueues, 'staleHours'>
  label: string
  icon: LucideIcon
  path: string
  tone: Tone
}

/** count>0일 때 톤별 색상, 0이면 muted */
const TONE_ACTIVE: Record<Tone, string> = {
  urgent: 'text-rose-600 dark:text-rose-400',
  warn: 'text-amber-600 dark:text-amber-400',
  info: 'text-brand-600 dark:text-brand-400',
  neutral: 'text-foreground',
}

/**
 * 실무자 업무 인박스 — "오늘 처리할 업무"를 카운트로 노출.
 * 각 타일은 클릭 시 관련 화면으로 이동(리드 큐→고객관리, 예약 큐→예약관리).
 */
export function TaskInbox({ clinicId }: { clinicId: number | null }) {
  const router = useRouter()
  const [data, setData] = useState<TaskQueues | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const qs = clinicId ? `?clinic_id=${clinicId}` : ''
      const res = await fetch(`/api/dashboard/task-queues${qs}`)
      if (!res.ok) {
        setError(true)
        setData(null)
        return
      }
      setData(await res.json())
      setError(false)
    } catch {
      setError(true)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [clinicId])

  useEffect(() => {
    fetch_()
  }, [fetch_])

  const staleHours = data?.staleHours ?? 24
  const tiles: QueueTile[] = [
    { key: 'newLeads', label: '신규 미처리 리드', icon: UserPlus, path: '/leads/queue?status=new', tone: 'urgent' },
    { key: 'staleNewLeads', label: `${staleHours}시간+ 미연락`, icon: Clock, path: `/leads/queue?status=new&staleHours=${staleHours}`, tone: 'warn' },
    { key: 'dueCallbacks', label: '오늘 재연락 대상', icon: PhoneCall, path: '/leads/queue?callback=due', tone: 'urgent' },
    { key: 'consultedNotBooked', label: '상담 후 미예약', icon: MessageSquareDot, path: '/leads/queue?status=consulting,consulted', tone: 'info' },
    { key: 'holdLeads', label: '보류 리드', icon: PauseCircle, path: '/leads/queue?status=hold', tone: 'info' },
    { key: 'todayBookings', label: '오늘 예약', icon: CalendarCheck, path: '/patients?scope=today', tone: 'neutral' },
    { key: 'todayCancelledNoshow', label: '오늘 취소·노쇼', icon: CalendarX, path: '/patients?scope=today&status=noshow,cancelled', tone: 'warn' },
  ]

  return (
    <Card variant="glass" className="p-5 mb-6 md:mb-8">
      <div className="flex items-center gap-1.5 mb-4">
        <ListTodo size={16} className="text-brand-400" />
        <h2 className="text-sm font-semibold text-foreground">오늘 처리할 업무</h2>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>업무 큐를 불러오지 못했습니다.</span>
          <button onClick={fetch_} className="shrink-0 underline hover:no-underline">
            다시 시도
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {tiles.map(tile => {
            const count = data ? data[tile.key] : 0
            const active = count > 0
            const Icon = tile.icon
            return (
              <button
                key={tile.key}
                onClick={() => router.push(tile.path)}
                aria-label={`${tile.label} ${count}건 — 목록으로 이동`}
                className="flex flex-col items-start gap-1.5 rounded-lg border border-border dark:border-white/5 bg-muted/30 dark:bg-white/[0.02]
                  px-3 py-2.5 text-left transition-all duration-200 hover:bg-muted/60 dark:hover:bg-white/[0.05] hover:border-brand-500/30
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Icon size={14} className={active ? TONE_ACTIVE[tile.tone] : 'text-muted-foreground'} />
                <span className={`text-2xl font-bold tabular-nums ${active ? TONE_ACTIVE[tile.tone] : 'text-muted-foreground/60'}`}>
                  {count.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground leading-tight">{tile.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </Card>
  )
}

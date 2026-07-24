'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Inbox, Phone } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/common'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useClinic } from '@/components/ClinicContext'
import { extractCustomEntries } from '@/lib/lead-custom-data'
import { formatDate, formatDateTime } from '@/lib/date'
import { getLeadStatusMeta, SELECTABLE_LEAD_STATUSES, LEAD_STATUS_CONFIG } from '@/lib/lead-status'

interface QueueLead {
  id: number
  name: string
  phone: string | null
  lead_status: string
  created_at: string
  custom_data: unknown
  next_contact_at: string | null
  last_contacted_at: string | null
  contact_attempt_count: number
}

interface Filter {
  key: string
  label: string
  status: string
  staleHours?: number
  callback?: string
}

const FILTERS: Filter[] = [
  { key: 'new', label: '신규 미처리', status: 'new' },
  { key: 'stale', label: '미연락(오래됨)', status: 'new', staleHours: 24 },
  { key: 'callback', label: '재연락 대상', status: '', callback: 'due' },
  { key: 'no_answer', label: '부재', status: 'no_answer' },
  { key: 'consulting', label: '상담중·완료', status: 'consulting,consulted' },
  { key: 'hold', label: '보류', status: 'hold' },
  { key: 'rejected', label: '거절', status: 'rejected' },
  { key: 'all', label: '전체', status: '' },
]

function QueueInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { selectedClinicId } = useClinic()
  const status = params.get('status') || ''
  const staleHours = params.get('staleHours')
  const callback = params.get('callback')

  const [leads, setLeads] = useState<QueueLead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (status) qs.set('status', status)
      if (staleHours) qs.set('staleHours', staleHours)
      if (callback) qs.set('callback', callback)
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))
      const res = await fetch(`/api/leads/queue?${qs.toString()}`)
      if (!res.ok) {
        setError(true)
        setLeads([])
        setTotal(0)
        return
      }
      const json = await res.json()
      setLeads(json.leads || [])
      setTotal(json.total || 0)
      setError(false)
    } catch {
      setError(true)
      setLeads([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [status, staleHours, callback, selectedClinicId])

  useEffect(() => {
    fetch_()
  }, [fetch_])

  const activeKey =
    FILTERS.find(f =>
      f.status === status &&
      (f.staleHours ? String(f.staleHours) === staleHours : !staleHours) &&
      (f.callback ? f.callback === callback : !callback),
    )?.key || ((status || callback) ? 'custom' : 'all')
  const activeLabel = FILTERS.find(f => f.key === activeKey)?.label || '리드 큐'

  const goFilter = (f: Filter) => {
    const qs = new URLSearchParams()
    if (f.status) qs.set('status', f.status)
    if (f.staleHours) qs.set('staleHours', String(f.staleHours))
    if (f.callback) qs.set('callback', f.callback)
    const str = qs.toString()
    router.push(`/leads/queue${str ? `?${str}` : ''}`)
  }

  const changeStatus = async (id: number, next: string) => {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_status: next }),
      })
      if (!res.ok) throw new Error()
      toast.success('상태가 변경되었습니다.')
      // 변경 후 현재 필터에서 벗어날 수 있어 재조회
      fetch_()
    } catch {
      toast.error('상태 변경에 실패했습니다.')
    } finally {
      setUpdatingId(null)
    }
  }

  const setCallback = async (id: number, dateStr: string) => {
    setUpdatingId(id)
    try {
      // 날짜만 받아 KST 09:00로 저장(해제 시 null)
      const next_contact_at = dateStr ? new Date(`${dateStr}T09:00:00+09:00`).toISOString() : null
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next_contact_at }),
      })
      if (!res.ok) throw new Error()
      toast.success(dateStr ? '재연락일이 설정되었습니다.' : '재연락일이 해제되었습니다.')
      fetch_()
    } catch {
      toast.error('재연락일 설정에 실패했습니다. (재연락 마이그레이션 필요)')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <>
      <PageHeader title="리드 큐" description="상태별 리드를 오래된 순으로 처리 — 업무 인박스 드릴다운 대상" />

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => goFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              activeKey === f.key
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/60 dark:hover:bg-white/5'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="text-xs text-muted-foreground mb-3">
        {loading
          ? '불러오는 중...'
          : `${activeLabel} · 총 ${total.toLocaleString()}건${total > leads.length ? ` (오래된 순 ${leads.length}건 표시)` : ''}`}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>리드 큐를 불러오지 못했습니다.</span>
          <button onClick={fetch_} className="underline hover:no-underline">
            다시 시도
          </button>
        </div>
      ) : leads.length === 0 ? (
        <EmptyState icon={Inbox} title="처리할 리드가 없습니다" description="이 조건에 해당하는 리드가 없습니다." />
      ) : (
        <div className="space-y-2">
          {leads.map(lead => {
            const chips = extractCustomEntries(lead.custom_data).map(e => e.value).slice(0, 4)
            const meta = getLeadStatusMeta(lead.lead_status)
            return (
              <Card key={lead.id} variant="glass" className="p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground truncate">{lead.name}</span>
                      <Badge variant="outline" className={`text-[10px] ${meta.color}`}>
                        {meta.label}
                      </Badge>
                    </div>
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        className="inline-flex items-center gap-1 text-sm text-brand-500 hover:text-brand-400"
                      >
                        <Phone size={12} /> {lead.phone}
                      </a>
                    )}
                    {chips.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {chips.map((c, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1.5">{formatDateTime(lead.created_at)}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px]">
                      {lead.contact_attempt_count > 0 && (
                        <span className="text-muted-foreground">처리 {lead.contact_attempt_count}회</span>
                      )}
                      {lead.next_contact_at && (
                        <span className="text-amber-600 dark:text-amber-400">재연락 {formatDate(lead.next_contact_at)}</span>
                      )}
                      <label className="inline-flex items-center gap-1 text-muted-foreground">
                        재연락일
                        <input
                          type="date"
                          value={lead.next_contact_at ? new Date(lead.next_contact_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) : ''}
                          onChange={e => setCallback(lead.id, e.target.value)}
                          disabled={updatingId === lead.id}
                          className="h-6 rounded border border-border bg-transparent px-1"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="w-28 shrink-0">
                    <Select
                      value={lead.lead_status}
                      onValueChange={v => changeStatus(lead.id, v)}
                      disabled={updatingId === lead.id}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SELECTABLE_LEAD_STATUSES.map(s => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {LEAD_STATUS_CONFIG[s].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}

export default function LeadsQueuePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      }
    >
      <QueueInner />
    </Suspense>
  )
}

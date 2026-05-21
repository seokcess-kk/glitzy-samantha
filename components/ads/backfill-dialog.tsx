'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { API_PLATFORM_LABELS, type ApiPlatform } from '@/lib/platform'
import { getKstDateString } from '@/lib/date'

interface Props {
  clinicId: number
  clinicName: string
  open: boolean
  onClose: () => void
}

interface BackfillResult {
  date: string
  platform: string
  count: number
  error: string | null
}

const today = () => getKstDateString(new Date())

const defaultStartDate = () => {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return getKstDateString(d)
}

export default function BackfillDialog({ clinicId, clinicName, open, onClose }: Props) {
  const [startDate, setStartDate] = useState(defaultStartDate())
  const [endDate, setEndDate] = useState(today())
  const [available, setAvailable] = useState<ApiPlatform[]>([])
  const [selected, setSelected] = useState<Set<ApiPlatform>>(new Set())
  const [loadingPlatforms, setLoadingPlatforms] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<BackfillResult[] | null>(null)

  const fetchPlatforms = useCallback(async () => {
    setLoadingPlatforms(true)
    try {
      const res = await fetch(`/api/ads/configured-platforms?clinic_id=${clinicId}`)
      if (!res.ok) throw new Error('조회 실패')
      const json = await res.json()
      const platforms: ApiPlatform[] = json?.data?.platforms || json?.platforms || []
      setAvailable(platforms)
      setSelected(new Set(platforms)) // 기본값: 모두 선택
    } catch {
      toast.error('활성 매체 목록을 불러올 수 없습니다.')
      setAvailable([])
      setSelected(new Set())
    } finally {
      setLoadingPlatforms(false)
    }
  }, [clinicId])

  useEffect(() => {
    if (open) {
      fetchPlatforms()
      setResults(null)
    }
  }, [open, fetchPlatforms])

  const toggle = (platform: ApiPlatform) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(platform)) next.delete(platform)
      else next.add(platform)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(available))
  const clearAll = () => setSelected(new Set())

  const handleBackfill = async () => {
    if (selected.size === 0) {
      toast.error('백필할 매체를 1개 이상 선택해주세요.')
      return
    }
    if (!startDate || !endDate) {
      toast.error('시작일/종료일을 입력해주세요.')
      return
    }

    setSubmitting(true)
    setResults(null)
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/backfill-ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          platforms: Array.from(selected),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || '백필 실패')
      }
      const payload = json?.data || json
      setResults(payload.results || [])
      const errorCount = payload.errorCount || 0
      if (errorCount > 0) {
        toast.warning(`백필 완료 — 총 ${payload.totalCount}건, 오류 ${errorCount}건`)
      } else {
        toast.success(`백필 완료 — 총 ${payload.totalCount}건 동기화`)
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '백필 실패'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={val => { if (!val) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>광고 데이터 백필 &mdash; {clinicName}</DialogTitle>
          <DialogDescription>
            선택한 매체의 광고 통계를 지정 기간만큼 재동기화합니다. (최대 90일)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">시작일</Label>
              <Input
                type="date"
                value={startDate}
                max={endDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">종료일</Label>
              <Input
                type="date"
                value={endDate}
                min={startDate}
                max={today()}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">백필 대상 매체</Label>
              {available.length > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-xs text-brand-500 hover:text-brand-400 transition-colors"
                  >
                    전체 선택
                  </button>
                  <span className="text-xs text-muted-foreground/40">|</span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    전체 해제
                  </button>
                </div>
              )}
            </div>

            {loadingPlatforms ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 size={14} className="animate-spin" />
                활성 매체 조회 중...
              </div>
            ) : available.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                활성 연동된 매체가 없습니다. 먼저 API 설정에서 매체를 활성화하세요.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {available.map(p => {
                  const checked = selected.has(p)
                  return (
                    <label
                      key={p}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-pointer transition-colors ${
                        checked
                          ? 'border-brand-500 bg-brand-500/10 text-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(p)}
                        className="accent-brand-500"
                      />
                      {API_PLATFORM_LABELS[p]}
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {results && results.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto border border-border rounded-md p-2">
              <p className="text-xs text-muted-foreground sticky top-0 bg-background pb-1">
                결과 ({results.length}건)
              </p>
              {results.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-muted/30"
                >
                  <span className="text-muted-foreground font-mono">{r.date}</span>
                  <span className="flex-1 mx-2 text-foreground">{r.platform}</span>
                  {r.error ? (
                    <span className="text-red-400" title={r.error}>실패</span>
                  ) : (
                    <span className="text-emerald-400">{r.count}건</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            닫기
          </Button>
          <Button
            onClick={handleBackfill}
            disabled={submitting || loadingPlatforms || available.length === 0}
            className="bg-brand-600 hover:bg-brand-700"
          >
            {submitting ? (
              <><Loader2 size={14} className="animate-spin" /> 백필 중...</>
            ) : (
              '백필 실행'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useClinic } from '@/components/ClinicContext'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChannelBadge, EmptyState } from '@/components/common'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getKstDateString } from '@/lib/date'
import { BarChart2 } from 'lucide-react'

interface PlatformRow {
  channel: string
  spend: number
  clicks: number
  impressions: number
  leads: number
  revenue: number
  payingCustomers: number
  cpl: number
  cpc: number
  ctr: number
  roas: number
  conversionRate: number
}

interface Props {
  days: string
}

export default function PlatformComparisonTable({ days }: Props) {
  const { selectedClinicId } = useClinic()
  const [rows, setRows] = useState<PlatformRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const endDate = getKstDateString()
      const startDate = getKstDateString(new Date(Date.now() - Number(days) * 86400000))
      const qs = new URLSearchParams({ startDate, endDate })
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))

      const res = await fetch(`/api/ads/platform-summary?${qs}`)
      if (!res.ok) {
        setRows([])
        return
      }
      const json = await res.json()
      setRows(Array.isArray(json) ? json : [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [days, selectedClinicId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 최저 CPL 채널 (리드 > 0인 것만)
  const bestCplChannel = useMemo(() => {
    const candidates = rows.filter(r => r.leads > 0 && r.cpl > 0)
    if (candidates.length === 0) return null
    return candidates.reduce((best, r) => (r.cpl < best.cpl ? r : best))
  }, [rows])

  // 최저 CPL 값을 가진 채널 식별 (표에서 하이라이트 용도)
  const minCpl = bestCplChannel?.cpl ?? null

  const thClass = 'text-[11px] text-muted-foreground font-medium whitespace-nowrap'

  return (
    <Card variant="glass" className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">매체별 성과 비교</h2>
        <span className="text-xs text-muted-foreground">최근 {days}일</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={BarChart2}
          title="매체 데이터가 없습니다"
          description="광고 데이터가 동기화되면 매체별 성과를 확인할 수 있습니다."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="border-b border-border dark:border-white/5 hover:bg-transparent">
                  <TableHead className={thClass}>매체</TableHead>
                  <TableHead className={`${thClass} text-right`}>광고비</TableHead>
                  <TableHead className={`${thClass} text-right`}>리드</TableHead>
                  <TableHead className={`${thClass} text-right`}>CPC</TableHead>
                  <TableHead className={`${thClass} text-right`}>CTR</TableHead>
                  <TableHead className={`${thClass} text-right`}>CPL</TableHead>
                  <TableHead className={`${thClass} text-right`}>ROAS</TableHead>
                  <TableHead className={`${thClass} text-right`}>전환율</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => {
                  const isLowestCpl = minCpl !== null && row.cpl === minCpl && row.leads > 0
                  const roasGood = row.roas >= 1

                  return (
                    <TableRow
                      key={row.channel}
                      className={`border-b border-border/50 dark:border-white/[0.03] ${
                        idx % 2 === 1 ? 'bg-muted/30 dark:bg-white/[0.01]' : ''
                      }`}
                    >
                      <TableCell className="py-2.5">
                        <ChannelBadge channel={row.channel} />
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                        ₩{row.spend.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                        {row.leads.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                        {row.cpc > 0 ? `₩${row.cpc.toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                        {row.ctr > 0 ? `${row.ctr.toFixed(2)}%` : '-'}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm font-medium">
                        <span className={isLowestCpl ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground/80'}>
                          {row.cpl > 0 ? `₩${row.cpl.toLocaleString()}` : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm font-medium">
                        <span className={roasGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                          {row.roas > 0 ? `${(row.roas * 100).toFixed(0)}%` : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                        {row.conversionRate > 0 ? `${row.conversionRate.toFixed(1)}%` : '-'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {bestCplChannel && (
            <p className="mt-4 text-xs text-muted-foreground">
              💡 <span className="font-medium text-foreground/80">{bestCplChannel.channel}</span>이(가) CPL{' '}
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                ₩{bestCplChannel.cpl.toLocaleString()}
              </span>
              로 가장 효율적입니다. ROAS는{' '}
              <span className="font-medium">{(bestCplChannel.roas * 100).toFixed(0)}%</span>입니다.
            </p>
          )}
        </>
      )}
    </Card>
  )
}

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useClinic } from '@/components/ClinicContext'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChannelBadge, EmptyState } from '@/components/common'
import { getChannelColor } from '@/lib/channel-colors'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ImageOff, Film, Image } from 'lucide-react'
import { getKstDateString } from '@/lib/date'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

function getCreativeUrl(fileName: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/creatives/${fileName}`
}

interface CreativeData {
  utm_content: string
  name: string
  platform: string | null
  leads: number
  customers: number
  revenue: number
  conversionRate: number
  registered: boolean
  file_name: string | null
  file_type: string | null
}

interface CreativePerformanceResponse {
  creatives: CreativeData[]
}

interface Props {
  parentDays?: string
}

export default function CreativePerformance({ parentDays }: Props) {
  const { selectedClinicId } = useClinic()
  const [data, setData] = useState<CreativePerformanceResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const days = parentDays || '30'

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const endDate = getKstDateString()
      const startDate = getKstDateString(new Date(Date.now() - Number(days) * 86400000))
      const qs = new URLSearchParams({ startDate, endDate })
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))

      const res = await fetch(`/api/ads/creatives-performance?${qs}`)
      if (!res.ok) {
        setData(null)
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [days, selectedClinicId])

  useEffect(() => { fetchData() }, [fetchData])

  const creatives = useMemo(() => data?.creatives || [], [data])
  const maxLeads = useMemo(() => Math.max(...creatives.map(c => c.leads), 1), [creatives])

  return (
    <Card variant="glass" className="p-5 md:p-6 mt-6">
      <div className="flex items-center justify-between mb-5 gap-4">
        <h2 className="font-semibold text-foreground shrink-0">소재별 성과</h2>
        <span className="text-xs text-muted-foreground">최근 {days}일</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
        </div>
      ) : creatives.length === 0 ? (
        <EmptyState
          icon={ImageOff}
          title="소재별 성과 데이터가 없습니다"
          description="광고 소재 관리에서 소재를 등록하고 utm_content가 포함된 리드가 유입되면 성과를 확인할 수 있습니다."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[750px]">
            <TableHeader>
              <TableRow className="border-b border-border dark:border-white/5 hover:bg-transparent">
                <TableHead className="text-[11px] text-muted-foreground font-medium w-[52px]">소재</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium w-[180px]">소재명</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium w-[70px]">플랫폼</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium">리드</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium text-right w-[60px]">결제</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium text-right w-[70px]">전환율</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium text-right w-[100px]">매출</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creatives.map((row, idx) => {
                const barWidth = maxLeads > 0 ? (row.leads / maxLeads) * 100 : 0
                const barColor = row.registered ? getChannelColor(row.platform || '') : 'hsl(var(--muted-foreground))'

                return (
                  <TableRow
                    key={row.utm_content}
                    className={`border-b border-border/50 dark:border-white/[0.03] ${idx % 2 === 1 ? 'bg-muted/30 dark:bg-white/[0.01]' : ''}`}
                  >
                    <TableCell className="py-2">
                      {row.file_name ? (
                        row.file_type?.startsWith('video/') ? (
                          <div className="w-10 h-10 rounded-md bg-muted dark:bg-white/5 overflow-hidden relative shrink-0">
                            <video src={getCreativeUrl(row.file_name)} className="w-full h-full object-cover" muted preload="metadata" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Film size={12} className="text-white/80" />
                            </div>
                          </div>
                        ) : (
                          <img src={getCreativeUrl(row.file_name)} alt={row.name} className="w-10 h-10 rounded-md object-cover bg-muted dark:bg-white/5 shrink-0" />
                        )
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-muted dark:bg-white/5 flex items-center justify-center text-muted-foreground/40 shrink-0">
                          <Image size={14} />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-3 max-w-[180px]" title={row.utm_content}>
                      <span className={`text-sm truncate block ${row.registered ? 'text-foreground/90' : 'text-muted-foreground italic'}`}>
                        {row.name}
                      </span>
                      {!row.registered && (
                        <span className="text-[10px] text-muted-foreground/60">미등록</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      {row.platform ? <ChannelBadge channel={row.platform} /> : <span className="text-muted-foreground text-xs">-</span>}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground font-medium tabular-nums text-sm w-8 shrink-0">{row.leads}</span>
                        <div className="flex-1 h-4 bg-muted/50 dark:bg-white/[0.03] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${barWidth}%`, backgroundColor: barColor, opacity: row.registered ? 0.7 : 0.3 }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-foreground/80 tabular-nums py-3 text-sm">{row.customers}</TableCell>
                    <TableCell className="text-right py-3">
                      <span className={`font-semibold tabular-nums text-sm ${row.conversionRate >= 10 ? 'text-emerald-600 dark:text-emerald-400' : row.conversionRate > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {row.conversionRate.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground tabular-nums py-3 text-sm">
                      ₩{row.revenue.toLocaleString()}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  )
}

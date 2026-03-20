'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useClinic } from '@/components/ClinicContext'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
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
import { BarChart2, ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react'

interface AdStatRecord {
  campaign_name: string | null
  platform: string | null
  spend_amount: number
  clicks: number
  impressions: number
}

interface CampaignRow {
  campaign_name: string
  platform: string | null
  spend: number
  clicks: number
  impressions: number
  cpc: number
  ctr: number
}

type SortField = 'campaign_name' | 'spend' | 'clicks' | 'impressions' | 'cpc' | 'ctr'
type SortDir = 'asc' | 'desc'

interface Props {
  days: string
  platformFilter?: string
}

const PAGE_SIZE = 10

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <ChevronsUpDown size={12} className="ml-1 text-muted-foreground/50 inline" />
  if (sortDir === 'asc') return <ChevronUp size={12} className="ml-1 text-primary inline" />
  return <ChevronDown size={12} className="ml-1 text-primary inline" />
}

function StatusDot({ cpc, avgCpc }: { cpc: number; avgCpc: number }) {
  if (avgCpc === 0) return null
  if (cpc < avgCpc * 0.8) return <span className="text-emerald-500" title="평균 대비 우수">🟢</span>
  if (cpc > avgCpc * 1.2) return <span className="text-rose-500" title="평균 대비 부진">🔴</span>
  return <span className="text-amber-400" title="평균 수준">🟡</span>
}

export default function CampaignRankingTable({ days, platformFilter }: Props) {
  const { selectedClinicId } = useClinic()
  const [rawData, setRawData] = useState<AdStatRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('spend')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expanded, setExpanded] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ days })
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))
      if (platformFilter) qs.set('platform', platformFilter)

      const res = await fetch(`/api/ads/stats?${qs}`)
      if (!res.ok) {
        setRawData([])
        return
      }
      const json = await res.json()
      setRawData(Array.isArray(json) ? json : [])
    } catch {
      setRawData([])
    } finally {
      setLoading(false)
    }
  }, [days, selectedClinicId, platformFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // Aggregate by campaign_name across all dates
  const aggregated = useMemo<CampaignRow[]>(() => {
    const map = new Map<string, CampaignRow>()

    for (const record of rawData) {
      const key = record.campaign_name || '(미설정)'
      const existing = map.get(key)
      if (existing) {
        existing.spend += Number(record.spend_amount) || 0
        existing.clicks += record.clicks || 0
        existing.impressions += record.impressions || 0
        // Keep latest platform if not set
        if (!existing.platform && record.platform) existing.platform = record.platform
      } else {
        map.set(key, {
          campaign_name: key,
          platform: record.platform || null,
          spend: Number(record.spend_amount) || 0,
          clicks: record.clicks || 0,
          impressions: record.impressions || 0,
          cpc: 0,
          ctr: 0,
        })
      }
    }

    // Compute derived metrics
    return Array.from(map.values()).map(row => ({
      ...row,
      cpc: row.clicks > 0 ? row.spend / row.clicks : 0,
      ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
    }))
  }, [rawData])

  const avgCpc = useMemo(() => {
    const withClicks = aggregated.filter(r => r.clicks > 0)
    if (withClicks.length === 0) return 0
    return withClicks.reduce((sum, r) => sum + r.cpc, 0) / withClicks.length
  }, [aggregated])

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return aggregated
    const q = search.toLowerCase()
    return aggregated.filter(r => r.campaign_name.toLowerCase().includes(q))
  }, [aggregated, search])

  // Sort
  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      const aNum = aVal as number
      const bNum = bVal as number
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum
    })
    return copy
  }, [filtered, sortField, sortDir])

  const displayed = expanded ? sorted : sorted.slice(0, PAGE_SIZE)
  const hasMore = sorted.length > PAGE_SIZE

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const thClass = 'text-[11px] text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap'

  return (
    <Card variant="glass" className="p-5 md:p-6">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h2 className="font-semibold text-foreground shrink-0">캠페인 성과 순위</h2>
        <span className="text-xs text-muted-foreground">최근 {days}일</span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="캠페인명 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm bg-background/50"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-xl" />
          ))}
        </div>
      ) : aggregated.length === 0 ? (
        <EmptyState
          icon={BarChart2}
          title="캠페인 데이터가 없습니다"
          description="광고 데이터가 동기화되면 캠페인별 성과를 확인할 수 있습니다."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="border-b border-border dark:border-white/5 hover:bg-transparent">
                  <TableHead className={thClass} onClick={() => handleSort('campaign_name')}>
                    캠페인명 <SortIcon field="campaign_name" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead className={`${thClass} w-[80px]`}>매체</TableHead>
                  <TableHead className={`${thClass} text-right`} onClick={() => handleSort('spend')}>
                    지출 <SortIcon field="spend" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead className={`${thClass} text-right`} onClick={() => handleSort('clicks')}>
                    클릭 <SortIcon field="clicks" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead className={`${thClass} text-right`} onClick={() => handleSort('impressions')}>
                    노출 <SortIcon field="impressions" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead className={`${thClass} text-right`} onClick={() => handleSort('cpc')}>
                    CPC <SortIcon field="cpc" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead className={`${thClass} text-right`} onClick={() => handleSort('ctr')}>
                    CTR <SortIcon field="ctr" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead className={`${thClass} text-right`}>CPL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">
                      검색 결과가 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  displayed.map((row, idx) => (
                    <TableRow
                      key={row.campaign_name}
                      className={`border-b border-border/50 dark:border-white/[0.03] ${idx % 2 === 1 ? 'bg-muted/30 dark:bg-white/[0.01]' : ''}`}
                    >
                      <TableCell className="py-2.5 max-w-[200px]">
                        <div className="flex items-center gap-1.5">
                          <StatusDot cpc={row.cpc} avgCpc={avgCpc} />
                          <span className="text-sm text-foreground/90 truncate block" title={row.campaign_name}>
                            {row.campaign_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        {row.platform ? (
                          <ChannelBadge channel={row.platform} />
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                        ₩{row.spend.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                        {row.clicks.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                        {row.impressions.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm">
                        <span className={
                          row.cpc > 0 && avgCpc > 0
                            ? row.cpc < avgCpc * 0.8
                              ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                              : row.cpc > avgCpc * 1.2
                              ? 'text-rose-600 dark:text-rose-400 font-medium'
                              : 'text-foreground/80'
                            : 'text-muted-foreground'
                        }>
                          {row.cpc > 0 ? `₩${Math.round(row.cpc).toLocaleString()}` : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                        {row.ctr > 0 ? `${row.ctr.toFixed(2)}%` : '-'}
                      </TableCell>
                      <TableCell className="py-2.5 text-right text-sm text-muted-foreground">
                        -
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {hasMore && (
            <div className="mt-3 text-center">
              <button
                onClick={() => setExpanded(prev => !prev)}
                className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
              >
                {expanded
                  ? '접기'
                  : `전체 ${sorted.length}건 보기`}
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { DollarSign, TrendingUp, Users, ArrowUpRight, ArrowDownRight, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useClinic } from '@/components/ClinicContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import CustomerJourneySheet from './CustomerJourneySheet'

const fmtKrw = (v: number) => v >= 10000 ? `₩${(v / 10000).toFixed(0)}만` : `₩${v.toLocaleString()}`

interface ChannelRow {
  channel: string; leads: number; spend: number; revenue: number; customers: number; roi: number; roas: number; cpl: number
}
interface CampaignRow {
  campaign: string; channel: string; leads: number; spend: number; revenue: number; customers: number; roi: number; roas: number
}
interface CustomerRow {
  customerId: number; name: string; phone: string; channel: string; campaign: string
  firstLeadDate: string; totalRevenue: number; payments: any[]; journey: any
}

export default function AttributionView() {
  const { selectedClinicId } = useClinic()
  const [days, setDays] = useState('30')
  const [loading, setLoading] = useState(true)
  const [byChannel, setByChannel] = useState<ChannelRow[]>([])
  const [byCampaign, setByCampaign] = useState<CampaignRow[]>([])
  const [totals, setTotals] = useState({ totalSpend: 0, totalRevenue: 0, totalCustomers: 0 })
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [channelFilter, setChannelFilter] = useState<string | null>(null)
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null)

  const [customersLoading, setCustomersLoading] = useState(true)

  // summary는 기간/병원 변경 시에만 재요청
  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      const startDate = new Date(Date.now() - Number(days) * 86400000).toISOString()
      const qs = new URLSearchParams({ startDate })
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))

      const res = await fetch(`/api/attribution/summary?${qs}`)
      const data = await res.json()
      setByChannel(data.byChannel || [])
      setByCampaign(data.byCampaign || [])
      setTotals(data.totals || { totalSpend: 0, totalRevenue: 0, totalCustomers: 0 })
    } catch {
      toast.error('매출 귀속 요약 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [days, selectedClinicId])

  // customers는 필터 변경 시에도 재요청
  const fetchCustomers = useCallback(async () => {
    setCustomersLoading(true)
    try {
      const startDate = new Date(Date.now() - Number(days) * 86400000).toISOString()
      const qs = new URLSearchParams({ startDate })
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))
      if (channelFilter) qs.set('channel', channelFilter)
      if (campaignFilter) qs.set('campaign', campaignFilter)

      const res = await fetch(`/api/attribution/customers?${qs}`)
      const data = await res.json()
      setCustomers(Array.isArray(data) ? data : [])
    } catch {
      toast.error('결제 고객 데이터 로드 실패')
    } finally {
      setCustomersLoading(false)
    }
  }, [days, selectedClinicId, channelFilter, campaignFilter])

  useEffect(() => { fetchSummary() }, [fetchSummary])
  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  const handleChannelClick = (channel: string) => {
    setCampaignFilter(null)
    setChannelFilter(prev => prev === channel ? null : channel)
  }

  const handleCampaignClick = (campaign: string) => {
    setChannelFilter(null)
    setCampaignFilter(prev => prev === campaign ? null : campaign)
  }

  const formatDate = (iso: string) => {
    if (!iso) return '-'
    return new Date(iso).toLocaleDateString('ko', { month: 'short', day: 'numeric' })
  }

  const maskName = (name: string | null) => {
    if (!name || name.length < 2) return name || '-'
    return name[0] + '*' + name.slice(-1)
  }

  return (
    <div className="space-y-6">
      {/* 기간 선택 + 필터 상태 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={v => { setDays(v); setChannelFilter(null); setCampaignFilter(null) }}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[7, 14, 30, 90].map(d => (
                <SelectItem key={d} value={String(d)}>최근 {d}일</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(channelFilter || campaignFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setChannelFilter(null); setCampaignFilter(null) }} className="text-xs text-slate-400">
              필터 해제
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500">퍼스트터치 귀속 (첫 유입 채널 기준)</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <Card variant="glass" className="p-4">
          <p className="text-[11px] text-slate-400 font-medium mb-2">총 귀속 매출</p>
          {loading ? <Skeleton className="h-7" /> : (
            <p className="text-xl font-bold text-white tabular-nums">{fmtKrw(totals.totalRevenue)}</p>
          )}
        </Card>
        <Card variant="glass" className="p-4">
          <p className="text-[11px] text-slate-400 font-medium mb-2">총 광고비</p>
          {loading ? <Skeleton className="h-7" /> : (
            <p className="text-xl font-bold text-white tabular-nums">{fmtKrw(totals.totalSpend)}</p>
          )}
        </Card>
        <Card variant="glass" className="p-4">
          <p className="text-[11px] text-slate-400 font-medium mb-2">결제 고객</p>
          {loading ? <Skeleton className="h-7" /> : (
            <p className="text-xl font-bold text-white tabular-nums">{totals.totalCustomers}명</p>
          )}
        </Card>
      </div>

      {/* 채널별 귀속표 */}
      <Card variant="glass" className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4">채널별 매출 귀속</h3>
        {loading ? (
          <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : byChannel.length > 0 ? (
          <div className="overflow-x-auto -mx-2">
            <Table className="min-w-[650px]">
              <TableHeader>
                <TableRow className="border-b border-white/5 hover:bg-transparent">
                  {['채널', '리드', '광고비', '귀속 매출', '결제 고객', 'ROI', 'ROAS'].map(h => (
                    <TableHead key={h} className={`text-[11px] text-slate-500 font-medium ${h !== '채널' ? 'text-right' : ''}`}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {byChannel.map(row => (
                  <TableRow
                    key={row.channel}
                    className={`border-b border-white/[0.03] cursor-pointer transition-colors ${
                      channelFilter === row.channel ? 'bg-brand-600/10' : 'hover:bg-white/[0.02]'
                    }`}
                    onClick={() => handleChannelClick(row.channel)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-200 font-medium text-sm">{row.channel}</span>
                        {channelFilter === row.channel && <ChevronRight size={12} className="text-brand-400" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-slate-400 tabular-nums">{row.leads}</TableCell>
                    <TableCell className="text-right text-slate-400 tabular-nums">{fmtKrw(row.spend)}</TableCell>
                    <TableCell className="text-right text-white font-semibold tabular-nums">{fmtKrw(row.revenue)}</TableCell>
                    <TableCell className="text-right text-slate-300 tabular-nums">{row.customers}명</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={`inline-flex items-center gap-0.5 font-semibold ${row.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {row.roi >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {Math.abs(row.roi)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-slate-300 tabular-nums">{row.roas > 0 ? `${(row.roas * 100).toFixed(0)}%` : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-center text-slate-500 py-6 text-sm">귀속할 데이터가 없습니다.</p>
        )}
      </Card>

      {/* 캠페인별 귀속표 */}
      <Card variant="glass" className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4">캠페인별 매출 귀속</h3>
        {loading ? (
          <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : byCampaign.length > 0 ? (
          <div className="overflow-x-auto -mx-2">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow className="border-b border-white/5 hover:bg-transparent">
                  {['캠페인', '채널', '리드', '광고비', '귀속 매출', '결제', 'ROI'].map(h => (
                    <TableHead key={h} className={`text-[11px] text-slate-500 font-medium ${!['캠페인', '채널'].includes(h) ? 'text-right' : ''}`}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {byCampaign.map(row => (
                  <TableRow
                    key={row.campaign}
                    className={`border-b border-white/[0.03] cursor-pointer transition-colors ${
                      campaignFilter === row.campaign ? 'bg-brand-600/10' : 'hover:bg-white/[0.02]'
                    }`}
                    onClick={() => handleCampaignClick(row.campaign)}
                  >
                    <TableCell className="font-medium text-slate-200 truncate max-w-[180px]" title={row.campaign}>
                      {row.campaign}
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs">{row.channel}</TableCell>
                    <TableCell className="text-right text-slate-400 tabular-nums">{row.leads}</TableCell>
                    <TableCell className="text-right text-slate-400 tabular-nums">
                      {row.spend > 0 ? fmtKrw(row.spend) : <span className="text-slate-600">오가닉</span>}
                    </TableCell>
                    <TableCell className="text-right text-white font-semibold tabular-nums">{fmtKrw(row.revenue)}</TableCell>
                    <TableCell className="text-right text-slate-300 tabular-nums">{row.customers}명</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.spend > 0 ? (
                        <span className={`font-semibold ${row.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {row.roi >= 0 ? '+' : ''}{row.roi}%
                        </span>
                      ) : <span className="text-slate-600">-</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-center text-slate-500 py-6 text-sm">캠페인 귀속 데이터가 없습니다.</p>
        )}
      </Card>

      {/* 결제 고객 여정 */}
      <Card variant="glass" className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">
            결제 고객 여정
            {channelFilter && <span className="ml-2 text-xs text-brand-400 font-normal">— {channelFilter}</span>}
            {campaignFilter && <span className="ml-2 text-xs text-brand-400 font-normal">— {campaignFilter}</span>}
          </h3>
          <span className="text-xs text-slate-500">{customers.length}명</span>
        </div>
        {customersLoading ? (
          <div className="space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : customers.length > 0 ? (
          <div className="overflow-x-auto -mx-2">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow className="border-b border-white/5 hover:bg-transparent">
                  {['고객명', '유입 채널', '캠페인', '첫 유입일', '결제액', '시술'].map(h => (
                    <TableHead key={h} className="text-[11px] text-slate-500 font-medium">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map(c => (
                  <TableRow
                    key={c.customerId}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer transition-colors"
                    onClick={() => setSelectedCustomer(c)}
                  >
                    <TableCell className="font-medium text-white">{maskName(c.name)}</TableCell>
                    <TableCell className="text-slate-400 text-xs">{c.channel}</TableCell>
                    <TableCell className="text-slate-400 text-xs truncate max-w-[120px]">{c.campaign || '-'}</TableCell>
                    <TableCell className="text-slate-400 text-xs">{formatDate(c.firstLeadDate)}</TableCell>
                    <TableCell className="text-white font-semibold tabular-nums">{fmtKrw(c.totalRevenue)}</TableCell>
                    <TableCell className="text-slate-400 text-xs">{c.payments[0]?.treatment || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-center text-slate-500 py-6 text-sm">
            {channelFilter || campaignFilter ? '해당 조건의 결제 고객이 없습니다.' : '결제 고객 데이터가 없습니다.'}
          </p>
        )}
      </Card>

      {/* 고객 여정 시트 */}
      <CustomerJourneySheet
        customer={selectedCustomer}
        open={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
      />
    </div>
  )
}

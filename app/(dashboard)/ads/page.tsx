'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from '@/components/charts'
import { RefreshCw, Play, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { useClinic } from '@/components/ClinicContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
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
import { PageHeader, StatsCard, ChannelBadge } from '@/components/common'

const PLATFORM_COLORS: Record<string, string> = {
  Meta: '#6366f1',
  Google: '#10b981',
  TikTok: '#f59e0b',
}

export default function AdsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as any

  useEffect(() => {
    if (user?.role === 'clinic_staff') router.replace('/patients')
  }, [user, router])

  const { selectedClinicId } = useClinic()
  const [stats, setStats] = useState<any[]>([])
  const [channelData, setChannelData] = useState<any[]>([])
  const [kpi, setKpi] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [days, setDays] = useState('30')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ days })
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))
      const clinicQs = selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''
      const [statsRes, channelRes, kpiRes] = await Promise.allSettled([
        fetch(`/api/ads/stats?${qs}`).then(r => r.json()),
        fetch(`/api/dashboard/channel${clinicQs}`).then(r => r.json()),
        fetch(`/api/dashboard/kpi${clinicQs}`).then(r => r.json()),
      ])
      if (statsRes.status === 'fulfilled') setStats(Array.isArray(statsRes.value) ? statsRes.value : [])
      if (channelRes.status === 'fulfilled') setChannelData(Array.isArray(channelRes.value) ? channelRes.value : [])
      if (kpiRes.status === 'fulfilled') setKpi(kpiRes.value)
    } finally {
      setLoading(false)
    }
  }, [days, selectedClinicId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/ads/sync', { method: 'POST' })
      const data = await res.json()
      toast.success(`데이터 수집 완료 (Meta: ${data.results?.meta ?? 0}, Google: ${data.results?.google ?? 0}, TikTok: ${data.results?.tiktok ?? 0})`)
      await fetchData()
    } catch {
      toast.error('동기화 실패')
    } finally {
      setSyncing(false)
    }
  }

  const platforms = ['all', ...([...new Set(stats.map(s => s.platform))] as string[])]
  const filteredStats = stats
    .filter(s => platformFilter === 'all' || s.platform === platformFilter)
    .filter(s => !searchQuery || (s.campaign_name || s.campaign_id || '').toLowerCase().includes(searchQuery.toLowerCase()))
  const filteredChannel = platformFilter === 'all' ? channelData : channelData.filter(c => c.channel === platformFilter)

  const totalSpend = filteredStats.reduce((s, r) => s + Number(r.spend_amount), 0)
  const totalClicks = filteredStats.reduce((s, r) => s + (r.clicks || 0), 0)
  const totalImpressions = filteredStats.reduce((s, r) => s + (r.impressions || 0), 0)

  return (
    <>
      <PageHeader
        title="광고 성과 분석"
        description="Meta / Google / TikTok 광고 지출 및 성과 데이터."
        actions={
          <>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[130px] glass-card border-0 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[7, 14, 30, 90].map(d => (
                  <SelectItem key={d} value={String(d)}>최근 {d}일</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="glass" size="icon" onClick={fetchData} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </Button>
            <Button onClick={handleSync} disabled={syncing} className="bg-brand-600 hover:bg-brand-700">
              <Play size={14} /> {syncing ? '수집 중...' : '지금 데이터 수집'}
            </Button>
          </>
        }
      />

      {/* 매체 필터 버튼 */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {platforms.map(p => (
          <Button
            key={p}
            variant={platformFilter === p ? 'default' : 'glass'}
            onClick={() => setPlatformFilter(p)}
            className={platformFilter === p ? 'bg-brand-600 border-brand-600' : ''}
          >
            {p === 'all' ? '전체 매체' : p}
            {p !== 'all' && (
              <span className="ml-2 text-xs opacity-60">
                {stats.filter(s => s.platform === p).length}건
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
        {[
          { label: '총 광고비',   value: `₩${Math.round(totalSpend).toLocaleString()}` },
          { label: 'ROAS',        value: kpi ? `${(kpi.roas * 100).toFixed(0)}%` : '-' },
          { label: '총 결제 금액', value: kpi ? `₩${kpi.totalRevenue?.toLocaleString()}` : '-' },
          { label: 'CAC',         value: kpi ? `₩${kpi.cac?.toLocaleString()}` : '-' },
          { label: 'ARPC',        value: kpi ? `₩${kpi.arpc?.toLocaleString()}` : '-' },
          { label: '총 클릭',     value: totalClicks.toLocaleString() },
          { label: '총 노출',     value: totalImpressions.toLocaleString() },
          { label: platformFilter === 'all' ? '활성 매체' : '캠페인 수', value: platformFilter === 'all' ? `${platforms.length - 1}개` : `${filteredStats.length}건` },
        ].map(({ label, value }) => (
          <Card key={label} variant="glass" className="p-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 leading-tight">{label}</p>
            {loading ? <Skeleton className="h-6 mt-1" /> : <p className="text-lg font-bold text-white truncate">{value}</p>}
          </Card>
        ))}
      </div>

      {/* 매체별 CPL / ROAS 차트 */}
      {(filteredChannel.length > 0 || channelData.length > 0) && (
        <Card variant="glass" className="p-6 mb-6">
          <h2 className="font-semibold text-white mb-5">
            매체별 CPL / ROAS 비교
            {platformFilter !== 'all' && <span className="ml-2 text-sm text-brand-400">— {platformFilter}</span>}
          </h2>
          <div className="overflow-x-auto -mx-2 px-2">
            <div className="min-w-[360px]">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={platformFilter === 'all' ? channelData : filteredChannel} barGap={6}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
                  <XAxis dataKey="channel" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tickFormatter={(v: number) => `₩${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a2e', border: 'none', borderRadius: 8, fontSize: 12 }}
                    formatter={(value: any, name: string) =>
                      name === 'ROAS (%)' ? [`${(value * 100).toFixed(0)}%`, name] : [`₩${Number(value).toLocaleString()}`, name]
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  <Bar yAxisId="left" dataKey="cpl" name="CPL (₩)" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  <Bar yAxisId="right" dataKey="roas" name="ROAS (%)" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 매체별 수치 요약 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-white/5">
            {(platformFilter === 'all' ? channelData : filteredChannel).map(c => (
              <div key={c.channel} className="flex sm:flex-col sm:text-center items-center sm:items-center gap-3 sm:gap-1">
                <p className="text-xs text-slate-500 w-16 sm:w-auto">{c.channel}</p>
                <div className="flex gap-4 text-sm flex-wrap">
                  <span className="whitespace-nowrap">
                    <span className="text-slate-500 text-xs">CPL </span>
                    <span className="font-semibold text-white">₩{c.cpl.toLocaleString()}</span>
                  </span>
                  <span className="whitespace-nowrap">
                    <span className="text-slate-500 text-xs">ROAS </span>
                    <span className={`font-semibold ${c.roas >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(c.roas * 100).toFixed(0)}%
                    </span>
                  </span>
                  <span className="whitespace-nowrap">
                    <span className="text-slate-500 text-xs">DB </span>
                    <span className="font-semibold text-slate-300">{c.leads}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 캠페인별 상세 */}
      <Card variant="glass" className="p-6">
        <div className="flex items-center justify-between mb-5 gap-4">
          <h2 className="font-semibold text-white shrink-0">
            캠페인별 상세 지출 내역
            {platformFilter !== 'all' && <span className="ml-2 text-sm text-slate-500">({platformFilter})</span>}
          </h2>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="캠페인명 검색..."
              className="w-48"
            />
            <span className="text-xs text-slate-500 shrink-0">{filteredStats.length}건</span>
          </div>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : filteredStats.length > 0 ? (
          <div className="overflow-x-auto">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow className="border-b border-white/5 hover:bg-transparent">
                  {['매체', '캠페인명', '날짜', '지출', '클릭', '노출'].map(h => (
                    <TableHead key={h} className="text-xs text-slate-500 uppercase tracking-wider font-medium">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStats.map((row: any) => (
                  <TableRow key={row.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <TableCell>
                      <ChannelBadge channel={row.platform} />
                    </TableCell>
                    <TableCell className="text-slate-300 max-w-[200px] truncate">{row.campaign_name || row.campaign_id}</TableCell>
                    <TableCell className="text-slate-400 text-xs">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />{new Date(row.stat_date).toLocaleDateString('ko')}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-white">₩{Number(row.spend_amount).toLocaleString()}</TableCell>
                    <TableCell className="text-slate-400">{(row.clicks || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-slate-400">{(row.impressions || 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-500">
            <p className="text-sm mb-2">광고 데이터가 없습니다.</p>
            <p className="text-xs">'.env.local'에 API 키를 입력 후 '지금 데이터 수집' 버튼을 눌러주세요.</p>
          </div>
        )}
      </Card>
    </>
  )
}

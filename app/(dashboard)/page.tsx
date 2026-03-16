'use client'
import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from '@/components/charts'
import { RefreshCw, Users, ArrowRight, TrendingUp, PieChart as PieChartIcon, Filter, Inbox, BarChart3 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
import { PageHeader, StatsCard } from '@/components/common'

// 팔레트: brand 단색 기반 + 의미 있는 2색 (긍정/부정)
const BRAND = '#6366f1'
const BRAND_LIGHT = '#818cf8'
const POSITIVE = '#34d399'  // emerald-400
const NEGATIVE = '#fb7185'  // rose-400
const PIE_SHADES = [BRAND, BRAND_LIGHT, '#a5b4fc', '#c7d2fe']
const FUNNEL_SHADES = [BRAND, BRAND_LIGHT, '#a5b4fc', '#c7d2fe', '#e0e7ff']
const fmtKrw = (v: number) => `₩${(v / 10000).toFixed(0)}만`

// 채널 아이콘 문자 (컬러 뱃지 대신)
const CHANNEL_PREFIX: Record<string, string> = {
  Meta: 'M', Google: 'G', TikTok: 'T',
  유튜브: 'Y', '인스타 피드': 'IG', '인스타 릴스': 'IG',
  틱톡: 'T', '네이버 블로그': 'N',
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900/95 border border-slate-700/50 rounded-lg p-3 text-xs shadow-xl backdrop-blur-sm">
      <p className="font-medium text-slate-300 mb-1.5">{label}주차</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-slate-400">{p.name}: <span className="text-white font-medium">{fmtKrw(p.value)}</span></p>
      ))}
    </div>
  )
}

const BarTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-slate-900/95 border border-slate-700/50 rounded-lg px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      <span className="text-slate-400">{d.payload.name}: </span>
      <span className="text-white font-medium">
        {d.dataKey === 'cpl' ? `₩${Number(d.value).toLocaleString()}` : `${d.value}%`}
      </span>
    </div>
  )
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const sessionUser = session?.user as any

  useEffect(() => {
    if (sessionUser?.role === 'clinic_staff') router.replace('/patients')
  }, [sessionUser, router])

  const [kpi, setKpi] = useState<any>(null)
  const [trend, setTrend] = useState<any[]>([])
  const [channel, setChannel] = useState<any[]>([])
  const [contentPlatform, setContentPlatform] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [funnel, setFunnel] = useState<any>(null)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [days, setDays] = useState('30')

  const fetchAll = async (selectedDays?: string) => {
    const daysValue = selectedDays || days
    setLoading(true)
    try {
      const startDate = new Date(Date.now() - Number(daysValue) * 24 * 60 * 60 * 1000).toISOString()
      const [kpiRes, trendRes, channelRes, contentRes, leadsRes, funnelRes, campaignRes] = await Promise.allSettled([
        fetch(`/api/dashboard/kpi?startDate=${startDate}&compare=true`).then(r => r.json()),
        fetch(`/api/dashboard/trend?startDate=${startDate}`).then(r => r.json()),
        fetch(`/api/dashboard/channel?startDate=${startDate}`).then(r => r.json()),
        fetch(`/api/content/analytics?groupBy=platform&startDate=${startDate}`).then(r => r.json()),
        fetch(`/api/leads?startDate=${startDate}`).then(r => r.json()),
        fetch(`/api/dashboard/funnel?startDate=${startDate}`).then(r => r.json()),
        fetch(`/api/dashboard/campaign?startDate=${startDate}`).then(r => r.json()),
      ])
      if (kpiRes.status === 'fulfilled') setKpi(kpiRes.value)
      if (trendRes.status === 'fulfilled') {
        setTrend(trendRes.value.map((r: any) => ({
          date: new Date(r.week).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' }),
          spend: r.spend || 0,
        })))
      }
      if (channelRes.status === 'fulfilled') setChannel(Array.isArray(channelRes.value) ? channelRes.value : [])
      if (contentRes.status === 'fulfilled') setContentPlatform(Array.isArray(contentRes.value) ? contentRes.value : [])
      if (leadsRes.status === 'fulfilled') setLeads(Array.isArray(leadsRes.value) ? leadsRes.value.slice(0, 10) : [])
      if (funnelRes.status === 'fulfilled') setFunnel(funnelRes.value)
      if (campaignRes.status === 'fulfilled') setCampaigns(Array.isArray(campaignRes.value) ? campaignRes.value : [])
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }

  const handleDaysChange = (value: string) => {
    setDays(value)
    fetchAll(value)
  }

  useEffect(() => { fetchAll() }, [])

  const kpiCards = kpi ? [
    {
      label: 'CPL (DB 1건당 광고비)',
      value: `₩${kpi.cpl?.toLocaleString()}`,
      trend: kpi.comparison?.cpl !== undefined ? { value: Math.abs(kpi.comparison.cpl), isPositive: kpi.comparison.cpl < 0 } : undefined
    },
    {
      label: 'ROAS (광고비 대비 매출)',
      value: `${((kpi.roas || 0) * 100).toFixed(0)}%`,
      trend: kpi.comparison?.roas !== undefined ? { value: Math.abs(kpi.comparison.roas), isPositive: kpi.comparison.roas > 0 } : undefined
    },
    {
      label: '예약 전환율',
      value: `${kpi.bookingRate}%`,
      trend: kpi.comparison?.bookingRate !== undefined ? { value: Math.abs(kpi.comparison.bookingRate), isPositive: kpi.comparison.bookingRate > 0 } : undefined
    },
    {
      label: '총 결제 매출',
      value: `₩${kpi.totalRevenue?.toLocaleString()}`,
      trend: kpi.comparison?.totalRevenue !== undefined ? { value: Math.abs(kpi.comparison.totalRevenue), isPositive: kpi.comparison.totalRevenue > 0 } : undefined
    },
    {
      label: 'CAC (고객 획득 비용)',
      value: `₩${kpi.cac?.toLocaleString()}`,
      trend: kpi.comparison?.cac !== undefined ? { value: Math.abs(kpi.comparison.cac), isPositive: kpi.comparison.cac < 0 } : undefined
    },
    {
      label: 'ARPC (결제 고객 평균 매출)',
      value: `₩${kpi.arpc?.toLocaleString()}`,
      trend: kpi.comparison?.arpc !== undefined ? { value: Math.abs(kpi.comparison.arpc), isPositive: kpi.comparison.arpc > 0 } : undefined
    },
  ] : Array(6).fill({ label: '로딩 중...', value: '-' })

  // 시술 비중
  const treatmentPie = leads
    .filter(l => l.customer?.payments?.length)
    .flatMap((l: any) => l.customer.payments)
    .reduce((acc: Record<string, number>, p: any) => {
      acc[p.treatment_name] = (acc[p.treatment_name] || 0) + 1
      return acc
    }, {})
  const pieData = Object.entries(treatmentPie as Record<string, number>).map(([name, value]) => ({ name, value: value as number }))

  // CPL / ROAS
  const adCplData = channel.filter(c => c.cpl > 0).map(c => ({ name: c.channel, cpl: c.cpl }))
  const contentCplData = contentPlatform.filter(c => c.cpl > 0).map(c => ({ name: c.label, cpl: c.cpl }))
  const allCplData = [...adCplData, ...contentCplData]
  const adRoasData = channel.filter(c => c.roas > 0).map(c => ({ name: c.channel, roas: Math.round(c.roas * 100) }))
  const contentRoasData = contentPlatform.filter(c => c.roas > 0).map(c => ({ name: c.label, roas: c.roas }))
  const allRoasData = [...adRoasData, ...contentRoasData]

  return (
    <>
      {/* Header */}
      <PageHeader
        title="마케팅 성과 대시보드"
        description={lastUpdated ? `마지막 업데이트: ${lastUpdated.toLocaleTimeString('ko')}` : '데이터 로딩 중...'}
        actions={
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={handleDaysChange}>
              <SelectTrigger className="w-[120px] bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[7, 14, 30, 90].map(d => (
                  <SelectItem key={d} value={String(d)}>최근 {d}일</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => fetchAll()} disabled={loading} className="text-slate-400 hover:text-white">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        {kpiCards.map((d, i) => (
          <StatsCard key={i} label={d.label} value={d.value} loading={loading} trend={d.trend} />
        ))}
      </div>

      {/* 광고비 추이 + 시술 비중 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-8">
        <Card variant="glass" className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">광고비 추이</h2>
            <span className="text-xs text-slate-500">최근 8주</span>
          </div>
          {loading ? (
            <Skeleton className="h-[200px] rounded-lg" />
          ) : trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtKrw} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="spend" name="광고비" stroke={BRAND} fill="url(#spendGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex flex-col gap-2 items-center justify-center text-slate-500 text-sm">
              <TrendingUp size={28} className="text-slate-600 mb-1" />
              <span>진행 중인 광고 캠페인이 없습니다.</span>
            </div>
          )}
        </Card>

        <Card variant="glass" className="p-5">
          <h2 className="text-sm font-semibold text-white mb-4">결제 시술 비중</h2>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={62} paddingAngle={2} dataKey="value" stroke="none">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_SHADES[i % PIE_SHADES.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="space-y-1.5 mt-3">
                {pieData.map((d, i) => (
                  <li key={i} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: PIE_SHADES[i % PIE_SHADES.length] }} />
                      <span className="text-slate-400">{d.name}</span>
                    </span>
                    <span className="font-semibold text-white tabular-nums">{d.value}건</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="h-[150px] flex flex-col gap-2 items-center justify-center text-slate-500 text-xs text-center">
              <PieChartIcon size={24} className="text-slate-600 mb-1" />
              <span>결제 데이터가 없습니다.</span>
            </div>
          )}
        </Card>
      </div>

      {/* 퍼널 분석 */}
      <Card variant="glass" className="p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-white">전환 퍼널</h2>
          </div>
          <span className="text-xs text-slate-500">리드 → 결제 전환율</span>
        </div>
        {loading ? (
          <Skeleton className="h-[100px] rounded-lg" />
        ) : funnel?.funnel?.stages ? (
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
            {funnel.funnel.stages.map((stage: any, i: number) => (
              <div key={stage.stage} className="flex items-center gap-2 min-w-0">
                <div className="text-center min-w-[80px]">
                  <div
                    className="mx-auto rounded-lg flex items-center justify-center font-bold text-white mb-2"
                    style={{
                      width: Math.max(48, 72 - i * 5),
                      height: Math.max(48, 72 - i * 5),
                      background: FUNNEL_SHADES[i],
                    }}
                  >
                    {stage.count}
                  </div>
                  <p className="text-xs font-medium text-slate-300">{stage.label}</p>
                  <p className="text-[11px] text-slate-500 tabular-nums">{stage.rate}%</p>
                </div>
                {i < funnel.funnel.stages.length - 1 && (
                  <div className="flex flex-col items-center text-slate-600 shrink-0">
                    <ArrowRight size={14} />
                    <span className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                      {stage.dropoff > 0 ? `-${stage.dropoff}%` : ''}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="h-[100px] flex flex-col gap-2 items-center justify-center text-slate-500 text-sm">
            <Filter size={24} className="text-slate-600 mb-1" />
            <span>퍼널을 분석할 리드 데이터가 부족합니다.</span>
          </div>
        )}
        {funnel?.funnel?.totalConversionRate > 0 && (
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-slate-500">전체 전환율 (리드 → 결제)</span>
            <span className="text-lg font-bold text-emerald-400 tabular-nums">{funnel.funnel.totalConversionRate}%</span>
          </div>
        )}
      </Card>

      {/* 채널별 성과 */}
      {channel.length > 0 && (
        <Card variant="glass" className="p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">채널별 성과</h2>
            <span className="text-xs text-slate-500">최근 {days}일</span>
          </div>
          <div className="overflow-x-auto -mx-2">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow className="border-b border-white/5 hover:bg-transparent">
                  {['채널', '리드', '광고비', '결제액', 'CPL', 'ROAS', '전환율'].map(h => (
                    <TableHead key={h} className={`text-[11px] text-slate-500 font-medium ${h !== '채널' ? 'text-right' : ''}`}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {channel.map((c: any) => (
                  <TableRow key={c.channel} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded bg-brand-600/20 text-brand-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {CHANNEL_PREFIX[c.channel] || c.channel[0]}
                        </span>
                        <span className="text-slate-200 font-medium text-sm">{c.channel}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-slate-300 tabular-nums">{c.leads}</TableCell>
                    <TableCell className="text-right text-slate-400 tabular-nums">₩{c.spend?.toLocaleString() || 0}</TableCell>
                    <TableCell className="text-right text-white font-semibold tabular-nums">₩{c.revenue?.toLocaleString() || 0}</TableCell>
                    <TableCell className="text-right text-slate-300 tabular-nums">{c.cpl > 0 ? `₩${c.cpl.toLocaleString()}` : '-'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={c.roas >= 1 ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>
                        {c.roas > 0 ? `${(c.roas * 100).toFixed(0)}%` : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-slate-300 tabular-nums">{c.conversionRate || 0}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* 캠페인별 성과 */}
      {campaigns.length > 0 && (
        <Card variant="glass" className="p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">캠페인별 성과</h2>
            <span className="text-xs text-slate-500">Top {Math.min(campaigns.length, 5)}</span>
          </div>
          <div className="overflow-x-auto -mx-2">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow className="border-b border-white/5 hover:bg-transparent">
                  {['캠페인', '채널', '리드', '결제', 'CPL', 'ROAS', '전환율'].map(h => (
                    <TableHead key={h} className={`text-[11px] text-slate-500 font-medium ${!['캠페인', '채널'].includes(h) ? 'text-right' : ''}`}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.slice(0, 5).map((c: any) => (
                  <TableRow key={c.campaign} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <TableCell className="font-medium text-slate-200 truncate max-w-[160px]" title={c.campaign}>{c.campaign}</TableCell>
                    <TableCell>
                      <span className="text-slate-400 text-xs">{c.channel}</span>
                    </TableCell>
                    <TableCell className="text-right text-slate-300 tabular-nums">{c.leads}</TableCell>
                    <TableCell className="text-right text-white font-semibold tabular-nums">{c.payingCustomers}</TableCell>
                    <TableCell className="text-right text-slate-300 tabular-nums">{c.cpl > 0 ? `₩${c.cpl.toLocaleString()}` : '-'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={c.roasPercent >= 100 ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>
                        {c.roasPercent > 0 ? `${c.roasPercent}%` : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-slate-300 tabular-nums">{c.conversionRate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* CPL / ROAS 비교 차트 */}
      {(allCplData.length > 0 || allRoasData.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          <Card variant="glass" className="p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">매체별 CPL</h2>
              <span className="text-[11px] text-slate-500">광고 + 콘텐츠</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">DB 1건 획득 비용 (낮을수록 효율적)</p>
            {allCplData.length > 0 ? (
              <>
                <div className="block md:hidden">
                  <ResponsiveContainer width="100%" height={allCplData.length * 40 + 20}>
                    <BarChart layout="vertical" data={allCplData} barSize={18}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis type="number" tickFormatter={(v: number) => `₩${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                      <Tooltip content={<BarTooltip />} />
                      <Bar dataKey="cpl" radius={[0, 4, 4, 0]} fill={BRAND} fillOpacity={0.75} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="hidden md:block">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={allCplData} barSize={24}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v: number) => `₩${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<BarTooltip />} />
                      <Bar dataKey="cpl" radius={[4, 4, 0, 0]} fill={BRAND} fillOpacity={0.75} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="h-[180px] flex flex-col gap-2 items-center justify-center text-slate-500 text-xs">
                <BarChart3 size={22} className="text-slate-600" />
                <span>CPL 데이터 없음</span>
              </div>
            )}
          </Card>

          <Card variant="glass" className="p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">매체별 ROAS</h2>
              <span className="text-[11px] text-slate-500">광고 + 콘텐츠</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">예산 대비 매출 (100% 이상 = 흑자)</p>
            {allRoasData.length > 0 ? (
              <>
                <div className="block md:hidden">
                  <ResponsiveContainer width="100%" height={allRoasData.length * 40 + 20}>
                    <BarChart layout="vertical" data={allRoasData} barSize={18}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis type="number" tickFormatter={(v: number) => `${v}%`} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                      <Tooltip content={<BarTooltip />} />
                      <Bar dataKey="roas" radius={[0, 4, 4, 0]}>
                        {allRoasData.map((entry, i) => (
                          <Cell key={i} fill={entry.roas >= 100 ? POSITIVE : NEGATIVE} fillOpacity={0.7} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="hidden md:block">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={allRoasData} barSize={24}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<BarTooltip />} />
                      <Bar dataKey="roas" radius={[4, 4, 0, 0]}>
                        {allRoasData.map((entry, i) => (
                          <Cell key={i} fill={entry.roas >= 100 ? POSITIVE : NEGATIVE} fillOpacity={0.7} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="h-[180px] flex flex-col gap-2 items-center justify-center text-slate-500 text-xs">
                <BarChart3 size={22} className="text-slate-600" />
                <span>ROAS 데이터 없음</span>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 최근 인입 고객 */}
      <Card variant="glass" className="p-5">
        <h2 className="text-sm font-semibold text-white mb-4">최근 인입 고객</h2>
        {loading ? (
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
          </div>
        ) : leads.length > 0 ? (
          <div className="overflow-x-auto -mx-2">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow className="border-b border-white/5 hover:bg-transparent">
                  {['고객명', '유입 채널', '챗봇', '상담 상태', '결제 금액', '시술명'].map(h => (
                    <TableHead key={h} className="text-[11px] text-slate-500 font-medium">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead: any) => {
                  const c = lead.customer
                  const consult = c?.consultations?.[0]
                  const payment = c?.payments?.[0]
                  return (
                    <TableRow key={lead.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <TableCell className="font-medium text-white">{c?.name ? c.name.slice(0, 1) + '*' + c.name.slice(-1) : '-'}</TableCell>
                      <TableCell>
                        <span className="text-slate-400 text-xs">{c?.first_source || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs ${lead.chatbot_sent ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {lead.chatbot_sent ? '발송' : '대기'}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-300 text-xs">{consult?.status || '-'}</TableCell>
                      <TableCell className="font-semibold text-white tabular-nums">
                        {payment ? `₩${Number(payment.payment_amount).toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="text-slate-400 text-xs">{payment?.treatment_name || '-'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500 gap-2">
            <Inbox size={28} className="text-slate-600 mb-1" />
            <p className="text-sm">인입된 고객 데이터가 없습니다.</p>
          </div>
        )}
      </Card>
    </>
  )
}

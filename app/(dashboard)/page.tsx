'use client'
import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from '@/components/charts'
import { TrendingUp, Bell, Settings, Search, RefreshCw, Users, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader, StatsCard, ChannelBadge, StatusBadge } from '@/components/common'

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd']
const FUNNEL_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#10b981']
const fmtKrw = (v: number) => `₩${(v / 10000).toFixed(0)}만`

// 매체별 색상
const MEDIA_COLORS: Record<string, string> = {
  Meta: '#6366f1', Google: '#10b981', TikTok: '#f59e0b',
  유튜브: '#ef4444', '인스타 피드': '#ec4899', '인스타 릴스': '#a855f7',
  틱톡: '#64748b', '네이버 블로그': '#22c55e',
}


const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs shadow-xl">
      <p className="font-semibold text-slate-300 mb-1">{label}주차</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {fmtKrw(p.value)}</p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const [kpi, setKpi] = useState<any>(null)
  const [trend, setTrend] = useState<any[]>([])
  const [channel, setChannel] = useState<any[]>([])
  const [contentPlatform, setContentPlatform] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [funnel, setFunnel] = useState<any>(null)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [kpiRes, trendRes, channelRes, contentRes, leadsRes, funnelRes, campaignRes] = await Promise.allSettled([
        fetch('/api/dashboard/kpi').then(r => r.json()),
        fetch('/api/dashboard/trend').then(r => r.json()),
        fetch('/api/dashboard/channel').then(r => r.json()),
        fetch('/api/content/analytics?groupBy=platform').then(r => r.json()),
        fetch('/api/leads').then(r => r.json()),
        fetch('/api/dashboard/funnel').then(r => r.json()),
        fetch('/api/dashboard/campaign').then(r => r.json()),
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

  useEffect(() => { fetchAll() }, [])

  const kpiCards = kpi ? [
    { label: 'CPL (DB 1건당 광고비)', value: `₩${kpi.cpl?.toLocaleString()}` },
    { label: 'ROAS (광고비 대비 매출)', value: `${(kpi.roas * 100).toFixed(0)}%` },
    { label: '예약 전환율', value: `${kpi.bookingRate}%` },
    { label: '총 결제 매출', value: `₩${kpi.totalRevenue?.toLocaleString()}` },
    { label: 'CAC (고객 획득 비용)', value: `₩${kpi.cac?.toLocaleString()}` },
    { label: 'ARPC (결제 고객 평균 매출)', value: `₩${kpi.arpc?.toLocaleString()}` },
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

  // 광고 매체 + 콘텐츠 매체 통합 CPL/ROAS 데이터
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
          <>
            <Button variant="glass" size="icon" onClick={fetchAll} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </Button>
            <Button variant="glass" size="icon"><Search size={16} /></Button>
            <Button variant="glass" size="icon"><Bell size={16} /></Button>
            <Button variant="glass" size="icon"><Settings size={16} /></Button>
          </>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
        {kpiCards.map((d, i) => <StatsCard key={i} label={d.label} value={d.value} loading={loading} />)}
      </div>

      {/* 광고비 추이 + 시술 비중 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card variant="glass" className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-white">광고비 추이</h2>
            <Badge variant="default" className="bg-brand-600/20 text-brand-500 border-0">최근 8주</Badge>
          </div>
          {loading ? (
            <Skeleton className="h-[220px] rounded-xl" />
          ) : trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="spend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtKrw} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="spend" name="광고비" stroke="#6366f1" fill="url(#spend)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-500 text-sm">
              광고 데이터를 수집하면 추이 그래프가 표시됩니다.
            </div>
          )}
        </Card>

        <Card variant="glass" className="p-6">
          <h2 className="font-semibold text-white mb-5">결제 시술 비중</h2>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: 'none', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="space-y-1.5 mt-3">
                {pieData.map((d, i) => (
                  <li key={i} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-slate-400">{d.name}</span>
                    </span>
                    <span className="font-semibold text-white">{d.value}건</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="h-[160px] flex items-center justify-center text-slate-500 text-xs text-center">
              병원 데이터 입력 후<br />시술 비중이 표시됩니다.
            </div>
          )}
        </Card>
      </div>

      {/* 퍼널 분석 */}
      <Card variant="glass" className="p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-brand-400" />
            <h2 className="font-semibold text-white">전환 퍼널</h2>
          </div>
          <span className="text-xs text-slate-500">리드 → 결제 전환율</span>
        </div>
        {loading ? (
          <Skeleton className="h-[120px] rounded-xl" />
        ) : funnel?.funnel?.stages ? (
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
            {funnel.funnel.stages.map((stage: any, i: number) => (
              <div key={stage.stage} className="flex items-center gap-2 min-w-0">
                <div className="text-center min-w-[80px]">
                  <div
                    className="mx-auto rounded-lg flex items-center justify-center font-bold text-white mb-2"
                    style={{
                      width: Math.max(50, 80 - i * 6),
                      height: Math.max(50, 80 - i * 6),
                      background: `linear-gradient(135deg, ${FUNNEL_COLORS[i]}, ${FUNNEL_COLORS[i]}88)`,
                    }}
                  >
                    {stage.count}
                  </div>
                  <p className="text-xs font-medium text-slate-300">{stage.label}</p>
                  <p className="text-[10px] text-slate-500">{stage.rate}%</p>
                </div>
                {i < funnel.funnel.stages.length - 1 && (
                  <div className="flex flex-col items-center text-slate-600 shrink-0">
                    <ArrowRight size={16} />
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      {stage.dropoff > 0 ? `-${stage.dropoff}%` : ''}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="h-[120px] flex items-center justify-center text-slate-500 text-sm">
            리드 데이터가 쌓이면 퍼널이 표시됩니다.
          </div>
        )}
        {funnel?.funnel?.totalConversionRate > 0 && (
          <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-slate-500">전체 전환율 (리드 → 결제)</span>
            <span className="text-lg font-bold text-emerald-400">{funnel.funnel.totalConversionRate}%</span>
          </div>
        )}
      </Card>

      {/* 캠페인별 성과 */}
      {campaigns.length > 0 && (
        <Card variant="glass" className="p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-white">캠페인별 성과</h2>
            <Badge variant="default" className="bg-brand-600/20 text-brand-500 border-0">Top {Math.min(campaigns.length, 5)}</Badge>
          </div>
          <div className="overflow-x-auto -mx-2">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow className="border-b border-white/5 hover:bg-transparent">
                  <TableHead className="text-xs text-slate-500 uppercase tracking-wider font-medium">캠페인</TableHead>
                  <TableHead className="text-xs text-slate-500 uppercase tracking-wider font-medium">채널</TableHead>
                  <TableHead className="text-xs text-slate-500 uppercase tracking-wider font-medium text-right">리드</TableHead>
                  <TableHead className="text-xs text-slate-500 uppercase tracking-wider font-medium text-right">결제</TableHead>
                  <TableHead className="text-xs text-slate-500 uppercase tracking-wider font-medium text-right">CPL</TableHead>
                  <TableHead className="text-xs text-slate-500 uppercase tracking-wider font-medium text-right">ROAS</TableHead>
                  <TableHead className="text-xs text-slate-500 uppercase tracking-wider font-medium text-right">전환율</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.slice(0, 5).map((c: any) => (
                  <TableRow key={c.campaign} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <TableCell className="font-medium text-white truncate max-w-[150px]" title={c.campaign}>{c.campaign}</TableCell>
                    <TableCell>
                      <ChannelBadge channel={c.channel} />
                    </TableCell>
                    <TableCell className="text-right text-slate-300">{c.leads}</TableCell>
                    <TableCell className="text-right text-emerald-400 font-semibold">{c.payingCustomers}</TableCell>
                    <TableCell className="text-right text-slate-300">{c.cpl > 0 ? `₩${c.cpl.toLocaleString()}` : '-'}</TableCell>
                    <TableCell className="text-right">
                      <span className={c.roasPercent >= 100 ? 'text-emerald-400' : 'text-red-400'}>
                        {c.roasPercent > 0 ? `${c.roasPercent}%` : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-slate-300">{c.conversionRate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* CPL / ROAS 차트 */}
      {(allCplData.length > 0 || allRoasData.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* CPL 차트 */}
          <Card variant="glass" className="p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-white text-sm">매체별 CPL 비교</h2>
              <span className="text-[10px] text-slate-500">광고 + 콘텐츠</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">DB 1건 획득 비용</p>
            {allCplData.length > 0 ? (
              <>
                {/* 모바일: 가로 막대 */}
                <div className="block md:hidden">
                  <ResponsiveContainer width="100%" height={allCplData.length * 44 + 20}>
                    <BarChart layout="vertical" data={allCplData} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" vertical={false} />
                      <XAxis type="number" tickFormatter={(v: number) => `₩${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: 'none', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`₩${Number(v).toLocaleString()}`, 'CPL']} />
                      <Bar dataKey="cpl" radius={[0, 4, 4, 0]}>
                        {allCplData.map((entry, i) => <Cell key={i} fill={MEDIA_COLORS[entry.name] || '#6366f1'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* 데스크탑: 세로 막대 */}
                <div className="hidden md:block">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={allCplData} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v: number) => `₩${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: 'none', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`₩${Number(v).toLocaleString()}`, 'CPL']} />
                      <Bar dataKey="cpl" radius={[4, 4, 0, 0]}>
                        {allCplData.map((entry, i) => <Cell key={i} fill={MEDIA_COLORS[entry.name] || '#6366f1'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-600 text-xs">CPL 데이터 없음</div>
            )}
          </Card>

          {/* ROAS 차트 */}
          <Card variant="glass" className="p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-white text-sm">매체별 ROAS 비교</h2>
              <span className="text-[10px] text-slate-500">광고 + 콘텐츠</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">예산 대비 매출 (100% 이상 = 흑자)</p>
            {allRoasData.length > 0 ? (
              <>
                {/* 모바일: 가로 막대 */}
                <div className="block md:hidden">
                  <ResponsiveContainer width="100%" height={allRoasData.length * 44 + 20}>
                    <BarChart layout="vertical" data={allRoasData} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" vertical={false} />
                      <XAxis type="number" tickFormatter={(v: number) => `${v}%`} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: 'none', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`${v}%`, 'ROAS']} />
                      <Bar dataKey="roas" radius={[0, 4, 4, 0]}>
                        {allRoasData.map((entry, i) => <Cell key={i} fill={entry.roas >= 100 ? (MEDIA_COLORS[entry.name] || '#10b981') : '#ef4444'} fillOpacity={entry.roas >= 100 ? 1 : 0.7} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* 데스크탑: 세로 막대 */}
                <div className="hidden md:block">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={allRoasData} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: 'none', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`${v}%`, 'ROAS']} />
                      <Bar dataKey="roas" radius={[4, 4, 0, 0]}>
                        {allRoasData.map((entry, i) => (
                          <Cell key={i} fill={entry.roas >= 100 ? (MEDIA_COLORS[entry.name] || '#10b981') : '#ef4444'} fillOpacity={entry.roas >= 100 ? 1 : 0.7} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-600 text-xs">ROAS 데이터 없음</div>
            )}
          </Card>
        </div>
      )}

      {/* 최근 인입 고객 */}
      <Card variant="glass" className="p-6">
        <h2 className="font-semibold text-white mb-5">최근 인입 고객 & 챗봇 현황</h2>
        {loading ? (
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
          </div>
        ) : leads.length > 0 ? (
          <div className="overflow-x-auto -mx-2">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow className="border-b border-white/5 hover:bg-transparent">
                  {['고객명', '유입 채널', '챗봇 발송', '상담 상태', '결제 금액', '시술명'].map(h => (
                    <TableHead key={h} className="text-xs text-slate-500 uppercase tracking-wider font-medium">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead: any) => {
                  const c = lead.customer
                  const consult = c?.consultations?.[0]
                  const payment = c?.payments?.[0]
                  return (
                    <TableRow key={lead.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <TableCell className="font-medium text-white">{c?.name ? c.name.slice(0, 1) + '*' + c.name.slice(-1) : '-'}</TableCell>
                      <TableCell>
                        <ChannelBadge channel={c?.first_source || '-'} />
                      </TableCell>
                      <TableCell className="text-slate-300">{lead.chatbot_sent ? '발송' : '대기중'}</TableCell>
                      <TableCell>
                        <StatusBadge status={consult?.status || '미응답'} />
                      </TableCell>
                      <TableCell className="font-semibold text-emerald-400">
                        {payment ? `₩${Number(payment.payment_amount).toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="text-slate-400">{payment?.treatment_name || '-'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-slate-500 text-sm text-center py-8">인입된 고객 데이터가 없습니다.</p>
        )}
      </Card>
    </>
  )
}

'use client'
import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts'
import { TrendingUp, TrendingDown, Bell, Settings, Search, RefreshCw } from 'lucide-react'

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd']
const fmtKrw = (v: number) => `₩${(v / 10000).toFixed(0)}만`

function KpiCard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="glass-card p-5 animate-fade-in-up">
      <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      {loading
        ? <div className="h-9 bg-white/5 rounded-lg animate-pulse mt-2 mb-3" />
        : <p className="text-3xl font-bold text-white mt-2 mb-3">{value}</p>
      }
    </div>
  )
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
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [kpiRes, trendRes, channelRes, leadsRes] = await Promise.allSettled([
        fetch('/api/dashboard/kpi').then(r => r.json()),
        fetch('/api/dashboard/trend').then(r => r.json()),
        fetch('/api/dashboard/channel').then(r => r.json()),
        fetch('/api/leads').then(r => r.json()),
      ])
      if (kpiRes.status === 'fulfilled') setKpi(kpiRes.value)
      if (trendRes.status === 'fulfilled') {
        const d = trendRes.value.map((r: any) => ({
          date: new Date(r.week).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' }),
          spend: r.spend || 0,
        }))
        setTrend(d)
      }
      if (channelRes.status === 'fulfilled') setChannel(channelRes.value)
      if (leadsRes.status === 'fulfilled') setLeads(Array.isArray(leadsRes.value) ? leadsRes.value.slice(0, 10) : [])
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const kpiCards = kpi ? [
    { label: 'CPL (DB 1건당 광고비)', value: `₩${kpi.cpl?.toLocaleString()}` },
    { label: 'ROAS (광고비 대비 매출)', value: `${kpi.roas}x` },
    { label: '예약 전환율', value: `${kpi.bookingRate}%` },
    { label: '총 결제 매출', value: `₩${kpi.totalRevenue?.toLocaleString()}` },
  ] : Array(4).fill({ label: '로딩 중...', value: '-' })

  // 시술 비중 (payments에서 파생)
  const treatmentPie = leads
    .filter(l => l.customer?.payments?.length)
    .flatMap((l: any) => l.customer.payments)
    .reduce((acc: Record<string, number>, p: any) => {
      const name = p.treatment_name
      acc[name] = (acc[name] || 0) + 1
      return acc
    }, {})
  const pieData = Object.entries(treatmentPie as Record<string, number>).map(([name, value]) => ({ name, value: value as number }))

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">마케팅 성과 대시보드</h1>
          <p className="text-sm text-slate-400 mt-1">
            {lastUpdated ? `마지막 업데이트: ${lastUpdated.toLocaleTimeString('ko')}` : '데이터 로딩 중...'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchAll} disabled={loading} className="glass-card p-2.5 hover:bg-white/10 transition-all disabled:opacity-50">
            <RefreshCw size={16} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className="glass-card p-2.5 hover:bg-white/10 transition-all"><Search size={16} className="text-slate-400" /></button>
          <button className="glass-card p-2.5 hover:bg-white/10 transition-all"><Bell size={16} className="text-slate-400" /></button>
          <button className="glass-card p-2.5 hover:bg-white/10 transition-all"><Settings size={16} className="text-slate-400" /></button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {kpiCards.map((d, i) => <KpiCard key={i} {...d} loading={loading} />)}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-white">광고비 추이</h2>
            <span className="text-xs bg-brand-600/20 text-brand-500 px-3 py-1 rounded-full">최근 8주</span>
          </div>
          {loading ? (
            <div className="h-[220px] bg-white/5 rounded-xl animate-pulse" />
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
        </div>

        <div className="glass-card p-6">
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
        </div>
      </div>

      {channel.length > 0 && (
        <div className="glass-card p-6 mb-6">
          <h2 className="font-semibold text-white mb-5">매체별 CPL / ROAS 비교</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={channel} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
              <XAxis dataKey="channel" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tickFormatter={v => `₩${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}x`} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: 'none', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Bar yAxisId="left" dataKey="cpl" name="CPL (₩)" fill="#6366f1" radius={[6, 6, 0, 0]} />
              <Bar yAxisId="right" dataKey="roas" name="ROAS (x)" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="glass-card p-6">
        <h2 className="font-semibold text-white mb-5">최근 인입 고객 & 챗봇 현황</h2>
        {loading ? (
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => <div key={i} className="h-10 bg-white/5 rounded-xl animate-pulse" />)}
          </div>
        ) : leads.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                {['고객명', '유입 채널', '챗봇 발송', '상담 상태', '결제 금액', '시술명'].map(h => (
                  <th key={h} className="text-left py-2 px-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead: any) => {
                const c = lead.customer
                const consult = c?.consultations?.[0]
                const payment = c?.payments?.[0]
                return (
                  <tr key={lead.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                    <td className="py-3 px-3 font-medium text-white">{c?.name ? c.name.slice(0, 1) + '*' + c.name.slice(-1) : '-'}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-600/20 text-brand-400">{c?.first_source || '-'}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-300">{lead.chatbot_sent ? '✅ 발송' : '⏳ 대기중'}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${consult?.status === '예약완료' || consult?.status === '방문완료' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
                        {consult?.status || '미응답'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-emerald-400">
                      {payment ? `₩${Number(payment.payment_amount).toLocaleString()}` : '-'}
                    </td>
                    <td className="py-3 px-3 text-slate-400">{payment?.treatment_name || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-slate-500 text-sm text-center py-8">인입된 고객 데이터가 없습니다.</p>
        )}
      </div>
    </>
  )
}

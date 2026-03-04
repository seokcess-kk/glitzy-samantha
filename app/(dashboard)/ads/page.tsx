'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { RefreshCw, Play, Calendar } from 'lucide-react'
import { useClinic } from '@/components/ClinicContext'

const PLATFORM_COLORS: Record<string, string> = {
  Meta: '#6366f1',
  Google: '#10b981',
  TikTok: '#f59e0b',
}

export default function AdsPage() {
  const { selectedClinicId } = useClinic()
  const [stats, setStats] = useState<any[]>([])
  const [channelData, setChannelData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<any>(null)
  const [days, setDays] = useState(30)
  const [platformFilter, setPlatformFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ days: String(days) })
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))
      const [statsRes, channelRes] = await Promise.allSettled([
        fetch(`/api/ads/stats?${qs}`).then(r => r.json()),
        fetch(`/api/dashboard/channel${selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''}`).then(r => r.json()),
      ])
      if (statsRes.status === 'fulfilled') setStats(Array.isArray(statsRes.value) ? statsRes.value : [])
      if (channelRes.status === 'fulfilled') setChannelData(Array.isArray(channelRes.value) ? channelRes.value : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [days, selectedClinicId])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/ads/sync', { method: 'POST' })
      const data = await res.json()
      setSyncResult({ ok: true, data })
      await fetchData()
    } catch {
      setSyncResult({ ok: false, msg: '동기화 실패' })
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">광고 성과 분석</h1>
          <p className="text-sm text-slate-400 mt-1">Meta / Google / TikTok 광고 지출 및 성과 데이터.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="glass-card px-3 py-2 text-sm text-white bg-transparent focus:outline-none"
          >
            {[7, 14, 30, 90].map(d => <option key={d} value={d} className="bg-slate-900">최근 {d}일</option>)}
          </select>
          <button onClick={fetchData} disabled={loading} className="glass-card p-2.5 hover:bg-white/10 transition-all">
            <RefreshCw size={16} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all"
          >
            <Play size={14} /> {syncing ? '수집 중...' : '지금 데이터 수집'}
          </button>
        </div>
      </div>

      {syncResult && (
        <div className={`mb-6 px-4 py-3 rounded-xl text-sm ${syncResult.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {syncResult.ok
            ? `✅ 데이터 수집 완료 (Meta: ${syncResult.data?.results?.meta}, Google: ${syncResult.data?.results?.google}, TikTok: ${syncResult.data?.results?.tiktok})`
            : `❌ ${syncResult.msg}`}
        </div>
      )}

      {/* 매체 필터 버튼 */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {platforms.map(p => (
          <button
            key={p}
            onClick={() => setPlatformFilter(p)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              platformFilter === p
                ? 'bg-brand-600 text-white border-brand-600'
                : 'glass-card border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {p === 'all' ? '전체 매체' : p}
            {p !== 'all' && (
              <span className="ml-2 text-xs opacity-60">
                {stats.filter(s => s.platform === p).length}건
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: '총 광고비', value: `₩${Math.round(totalSpend).toLocaleString()}` },
          { label: '총 클릭', value: totalClicks.toLocaleString() },
          { label: '총 노출', value: totalImpressions.toLocaleString() },
          { label: platformFilter === 'all' ? '활성 매체' : '캠페인 수', value: platformFilter === 'all' ? `${platforms.length - 1}개` : `${filteredStats.length}건` },
        ].map(({ label, value }) => (
          <div key={label} className="glass-card p-5">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">{label}</p>
            <p className="text-2xl font-bold text-white">{loading ? '-' : value}</p>
          </div>
        ))}
      </div>

      {/* 매체별 CPL / ROAS 차트 */}
      {(filteredChannel.length > 0 || channelData.length > 0) && (
        <div className="glass-card p-6 mb-6">
          <h2 className="font-semibold text-white mb-5">
            매체별 CPL / ROAS 비교
            {platformFilter !== 'all' && <span className="ml-2 text-sm text-brand-400">— {platformFilter}</span>}
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={platformFilter === 'all' ? channelData : filteredChannel} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
              <XAxis dataKey="channel" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tickFormatter={v => `₩${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
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

          {/* 매체별 수치 요약 */}
          <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-white/5">
            {(platformFilter === 'all' ? channelData : filteredChannel).map(c => (
              <div key={c.channel} className="text-center">
                <p className="text-xs text-slate-500 mb-1">{c.channel}</p>
                <div className="flex justify-center gap-4 text-sm">
                  <span>
                    <span className="text-slate-500 text-xs">CPL </span>
                    <span className="font-semibold text-white">₩{c.cpl.toLocaleString()}</span>
                  </span>
                  <span>
                    <span className="text-slate-500 text-xs">ROAS </span>
                    <span className={`font-semibold ${c.roas >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(c.roas * 100).toFixed(0)}%
                    </span>
                  </span>
                  <span>
                    <span className="text-slate-500 text-xs">DB </span>
                    <span className="font-semibold text-slate-300">{c.leads}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-5 gap-4">
          <h2 className="font-semibold text-white shrink-0">
            캠페인별 상세 지출 내역
            {platformFilter !== 'all' && <span className="ml-2 text-sm text-slate-500">({platformFilter})</span>}
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="캠페인명 검색..."
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 w-48"
            />
            <span className="text-xs text-slate-500 shrink-0">{filteredStats.length}건</span>
          </div>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />)}
          </div>
        ) : filteredStats.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                {['매체', '캠페인명', '날짜', '지출', '클릭', '노출'].map(h => (
                  <th key={h} className="text-left py-2 px-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStats.map((row: any) => {
                const color = PLATFORM_COLORS[row.platform] || '#6366f1'
                return (
                  <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                    <td className="py-3 px-3">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: `${color}22`, color }}
                      >
                        {row.platform}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300 max-w-[200px] truncate">{row.campaign_name || row.campaign_id}</td>
                    <td className="py-3 px-3 text-slate-400 text-xs">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />{new Date(row.stat_date).toLocaleDateString('ko')}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-white">₩{Number(row.spend_amount).toLocaleString()}</td>
                    <td className="py-3 px-3 text-slate-400">{(row.clicks || 0).toLocaleString()}</td>
                    <td className="py-3 px-3 text-slate-400">{(row.impressions || 0).toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="py-12 text-center text-slate-500">
            <p className="text-sm mb-2">광고 데이터가 없습니다.</p>
            <p className="text-xs">'.env.local'에 API 키를 입력 후 '지금 데이터 수집' 버튼을 눌러주세요.</p>
          </div>
        )}
      </div>
    </>
  )
}

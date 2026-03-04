'use client'
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Plus, Trash2, Eye, Heart, MessageCircle, Share2, Bookmark, ExternalLink, Check, AlertCircle, X, Search } from 'lucide-react'
import { useClinic } from '@/components/ClinicContext'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// ─── 상수 ─────────────────────────────────────────────────
const PLATFORM_CONFIG: Record<string, { label: string; color: string; hasApi: boolean; statFields: string[]; chartColor: string }> = {
  youtube:          { label: '유튜브',        color: 'bg-red-500/20 text-red-400 border-red-500/30',           hasApi: true,  statFields: ['views', 'likes', 'comments'],          chartColor: '#ef4444' },
  instagram_feed:   { label: '인스타 피드',   color: 'bg-pink-500/20 text-pink-400 border-pink-500/30',        hasApi: true,  statFields: ['likes', 'comments', 'saves', 'reach'], chartColor: '#ec4899' },
  instagram_reels:  { label: '인스타 릴스',   color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',  hasApi: true,  statFields: ['views', 'likes', 'comments', 'shares'], chartColor: '#a855f7' },
  tiktok:           { label: '틱톡',          color: 'bg-slate-400/20 text-slate-300 border-slate-400/30',     hasApi: false, statFields: ['views', 'likes', 'comments', 'shares'], chartColor: '#64748b' },
  naver_blog:       { label: '네이버 블로그', color: 'bg-green-500/20 text-green-400 border-green-500/30',     hasApi: false, statFields: ['views', 'likes', 'comments'],          chartColor: '#22c55e' },
}

const STAT_LABEL: Record<string, string> = {
  views: '조회수', likes: '좋아요', comments: '댓글', shares: '공유', saves: '저장', reach: '도달', impressions: '노출',
}

// ─── Toast ────────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium z-50 ${type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
      {type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />} {message}
    </div>
  )
}

// ─── 콘텐츠 추가 모달 ─────────────────────────────────────
function AddContentModal({ onClose, onSaved, clinicId }: { onClose: () => void; onSaved: () => void; clinicId: number | null }) {
  const [form, setForm] = useState({
    platform: 'youtube', title: '', url: '', published_at: '', thumbnail_url: '',
    utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '', utm_term: '',
    budget: '', views: '', likes: '', comments: '', shares: '', saves: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.title || !form.platform) return
    setSaving(true)
    try {
      const qs = clinicId ? `?clinic_id=${clinicId}` : ''
      const res = await fetch(`/api/content/posts${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          budget: Number(form.budget) || 0,
          views: Number(form.views) || 0,
          likes: Number(form.likes) || 0,
          comments: Number(form.comments) || 0,
          shares: Number(form.shares) || 0,
          saves: Number(form.saves) || 0,
        }),
      })
      if (!res.ok) throw new Error()
      onSaved()
      onClose()
    } catch {
      alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const platCfg = PLATFORM_CONFIG[form.platform]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="font-semibold text-white">콘텐츠 수기 추가</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-slate-500 mb-2 block">플랫폼 *</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => (
                <button key={key} onClick={() => setForm(f => ({ ...f, platform: key }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.platform === key ? `${cfg.color} border-current` : 'border-white/10 text-slate-400 hover:text-white'}`}>
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-slate-500 mb-1 block">제목 *</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="콘텐츠 제목" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">URL</label>
              <input type="url" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://..." className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">발행일</label>
              <input type="date" value={form.published_at} onChange={e => setForm(f => ({ ...f, published_at: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">예산 (₩)</label>
              <input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                placeholder="0" min="0" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-2 block">현재 통계</label>
            <div className="grid grid-cols-5 gap-2">
              {platCfg.statFields.map(field => (
                <div key={field}>
                  <label className="text-[10px] text-slate-600 mb-1 block">{STAT_LABEL[field]}</label>
                  <input type="number" value={(form as any)[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder="0" min="0" className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500" />
                </div>
              ))}
            </div>
          </div>
          <details>
            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300">UTM 파라미터 (선택)</summary>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {[['utm_source', 'Source'], ['utm_medium', 'Medium'], ['utm_campaign', 'Campaign'], ['utm_content', 'Content'], ['utm_term', 'Term']].map(([key, label]) => (
                <div key={key}>
                  <label className="text-[10px] text-slate-600 mb-1 block">{label}</label>
                  <input type="text" value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500" />
                </div>
              ))}
            </div>
          </details>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-white/5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">취소</button>
          <button onClick={handleSave} disabled={saving || !form.title}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
            {saving ? '저장 중...' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 통계 + 예산 수기 수정 ────────────────────────────────
function StatEditRow({ post, onSaved }: { post: any; onSaved: () => void }) {
  const platCfg = PLATFORM_CONFIG[post.platform]
  const latestStat = (post.stats || []).sort((a: any, b: any) => b.stat_date?.localeCompare(a.stat_date))[0] || {}
  const [form, setForm] = useState<Record<string, number>>({
    views: latestStat.views || 0, likes: latestStat.likes || 0,
    comments: latestStat.comments || 0, shares: latestStat.shares || 0, saves: latestStat.saves || 0,
  })
  const [budget, setBudget] = useState(post.budget || 0)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await Promise.all([
      fetch('/api/content/posts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_id: post.id, ...form }) }),
      fetch('/api/content/posts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: post.id, budget }) }),
    ])
    setSaving(false)
    onSaved()
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-end gap-2">
        {platCfg.statFields.map(field => (
          <div key={field} className="flex-1">
            <label className="text-[10px] text-slate-500 mb-1 block">{STAT_LABEL[field]}</label>
            <input type="number" value={form[field] || 0} onChange={e => setForm(f => ({ ...f, [field]: Number(e.target.value) }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500" />
          </div>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-slate-500 mb-1 block">예산 (₩)</label>
          <input type="number" value={budget} onChange={e => setBudget(Number(e.target.value))} min="0"
            placeholder="제작비 / 운영 예산"
            className="w-full bg-white/5 border border-amber-500/20 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500" />
        </div>
        <button onClick={handleSave} disabled={saving}
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap">
          {saving ? '저장' : '업데이트'}
        </button>
      </div>
    </div>
  )
}

// ─── 콘텐츠 테이블 행 ─────────────────────────────────────
function ContentRow({ post, onDelete, onRefresh }: { post: any; onDelete: (id: number) => void; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const platCfg = PLATFORM_CONFIG[post.platform] || { label: post.platform, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', statFields: [], hasApi: false, chartColor: '#64748b' }
  const latestStat = (post.stats || []).sort((a: any, b: any) => b.stat_date?.localeCompare(a.stat_date))[0] || {}
  const engagement = (latestStat.likes || 0) + (latestStat.comments || 0) + (latestStat.shares || 0) + (latestStat.saves || 0)

  return (
    <>
      <tr className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
        <td className="py-3 px-4">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${platCfg.color}`}>{platCfg.label}</span>
        </td>
        <td className="py-3 px-4 max-w-[280px]">
          <p className="text-white text-sm font-medium truncate">{post.title}</p>
          {post.utm_campaign && <span className="text-[10px] text-brand-400">{post.utm_campaign}</span>}
        </td>
        <td className="py-3 px-4 text-slate-400 text-xs whitespace-nowrap">
          {post.published_at ? new Date(post.published_at).toLocaleDateString('ko') : '-'}
        </td>
        <td className="py-3 px-4 text-slate-300 text-xs text-right">
          {latestStat.views > 0 ? latestStat.views.toLocaleString() : <span className="text-slate-600">-</span>}
        </td>
        <td className="py-3 px-4 text-slate-300 text-xs text-right">
          {engagement > 0 ? engagement.toLocaleString() : <span className="text-slate-600">-</span>}
        </td>
        <td className="py-3 px-4 text-xs text-right">
          {post.budget > 0
            ? <span className="text-amber-400 font-medium">₩{Number(post.budget).toLocaleString()}</span>
            : <span className="text-slate-600">-</span>}
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center justify-end gap-1">
            {post.url && (
              <a href={post.url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white">
                <ExternalLink size={13} />
              </a>
            )}
            <button onClick={() => setExpanded(v => !v)} className="px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all">
              {expanded ? '닫기' : '수정'}
            </button>
            <button onClick={() => onDelete(post.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-600 hover:text-red-400 transition-all">
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-white/5 bg-white/[0.02]">
          <td colSpan={7} className="px-4 pt-2 pb-4">
            <StatEditRow post={post} onSaved={() => { setExpanded(false); onRefresh() }} />
          </td>
        </tr>
      )}
    </>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────
export default function ContentPage() {
  const { selectedClinicId } = useClinic()
  const [posts, setPosts] = useState<any[]>([])
  const [analytics, setAnalytics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [platformFilter, setPlatformFilter] = useState('all')
  const [groupBy, setGroupBy] = useState<'campaign' | 'month' | 'post'>('campaign')
  const [showAddModal, setShowAddModal] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [syncResult, setSyncResult] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))
      const [postsRes, analyticsRes] = await Promise.allSettled([
        fetch(`/api/content/posts?${qs}`).then(r => r.json()),
        fetch(`/api/content/analytics?groupBy=platform${selectedClinicId ? `&clinic_id=${selectedClinicId}` : ''}`).then(r => r.json()),
      ])
      if (postsRes.status === 'fulfilled') setPosts(Array.isArray(postsRes.value) ? postsRes.value : [])
      if (analyticsRes.status === 'fulfilled') setAnalytics(Array.isArray(analyticsRes.value) ? analyticsRes.value : [])
    } finally {
      setLoading(false)
    }
  }, [selectedClinicId])

  const [detailAnalytics, setDetailAnalytics] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchDetailAnalytics = useCallback(async () => {
    setDetailLoading(true)
    try {
      const qs = new URLSearchParams({ groupBy })
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))
      const res = await fetch(`/api/content/analytics?${qs}`)
      const json = await res.json()
      setDetailAnalytics(Array.isArray(json) ? json : [])
    } finally {
      setDetailLoading(false)
    }
  }, [groupBy, selectedClinicId])

  useEffect(() => { fetchPosts() }, [fetchPosts])
  useEffect(() => { fetchDetailAnalytics() }, [fetchDetailAnalytics])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const qs = selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''
      const res = await fetch(`/api/content/sync${qs}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: 'all' }) })
      const data = await res.json()
      setSyncResult(data)
      setToast({ msg: data.success ? 'API 동기화 완료' : (data.message || '동기화 실패'), type: data.success ? 'success' : 'error' })
      if (data.success) fetchPosts()
    } catch {
      setToast({ msg: '동기화 요청 실패', type: 'error' })
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('콘텐츠를 삭제하시겠습니까?')) return
    await fetch('/api/content/posts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    fetchPosts()
  }

  const getLatestStat = (p: any) => (p.stats || []).sort((a: any, b: any) => b.stat_date?.localeCompare(a.stat_date))[0] || {}

  // 상단 KPI 집계
  const allPosts = platformFilter === 'all' ? posts : posts.filter(p => p.platform === platformFilter)
  const totalViews = allPosts.reduce((s, p) => s + (getLatestStat(p).views || 0), 0)
  const totalEngagement = allPosts.reduce((s, p) => { const st = getLatestStat(p); return s + (st.likes || 0) + (st.comments || 0) + (st.shares || 0) + (st.saves || 0) }, 0)
  const filteredAnalytics = platformFilter === 'all' ? analytics : analytics.filter(a => a.key === platformFilter)
  const totalBudget = filteredAnalytics.reduce((s, a) => s + (a.budget || 0), 0)
  const totalLeads = filteredAnalytics.reduce((s, a) => s + (a.leads || 0), 0)
  const totalRevenue = filteredAnalytics.reduce((s, a) => s + (a.revenue || 0), 0)
  const overallCpl = totalLeads > 0 && totalBudget > 0 ? Math.round(totalBudget / totalLeads) : 0
  const overallRoas = totalBudget > 0 ? Math.round((totalRevenue / totalBudget) * 100) : 0

  // 차트 데이터 (플랫폼별 CPL/ROAS)
  const cplChartData = analytics.filter(a => a.cpl > 0)
  const roasChartData = analytics.filter(a => a.roas > 0)

  // 콘텐츠 목록 필터
  const filteredPosts = posts
    .filter(p => platformFilter === 'all' || p.platform === platformFilter)
    .filter(p => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {showAddModal && <AddContentModal onClose={() => setShowAddModal(false)} onSaved={fetchPosts} clinicId={selectedClinicId} />}

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">브랜드 콘텐츠 분석</h1>
          <p className="text-sm text-slate-400 mt-1">유튜브 · 인스타그램 · 틱톡 · 네이버 블로그 콘텐츠 성과 통합 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 glass-card px-4 py-2 text-sm text-slate-300 hover:text-white disabled:opacity-50">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'API 동기화 중...' : 'API 동기화'}
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-xl">
            <Plus size={14} /> 콘텐츠 추가
          </button>
        </div>
      </div>

      {/* 플랫폼 필터 — 전체 페이지에 적용 */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={() => setPlatformFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${platformFilter === 'all' ? 'bg-brand-600 text-white' : 'glass-card text-slate-400 hover:text-white'}`}>
          전체 <span className="ml-1 opacity-60">{posts.length}</span>
        </button>
        {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => {
          const count = posts.filter(p => p.platform === key).length
          return (
            <button key={key} onClick={() => setPlatformFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${platformFilter === key ? `${cfg.color} border-current` : 'glass-card border-transparent text-slate-400 hover:text-white'}`}>
              {cfg.label} <span className="ml-1 opacity-60">{count}</span>
            </button>
          )
        })}
      </div>

      {/* ── 대시보드 영역 ── */}

      {/* KPI 카드 */}
      <div className="grid grid-cols-7 gap-3 mb-5">
        {[
          { label: '총 조회수',    value: totalViews.toLocaleString(),                                                    color: 'text-white' },
          { label: '총 참여수',    value: totalEngagement.toLocaleString(),                                               color: 'text-white' },
          { label: '총 예산',      value: totalBudget > 0 ? `₩${totalBudget.toLocaleString()}` : '-',                    color: 'text-amber-400' },
          { label: 'DB 유입',      value: totalLeads > 0 ? `${totalLeads}건` : '-',                                      color: 'text-blue-400' },
          { label: '총 결제 금액', value: totalRevenue > 0 ? `₩${totalRevenue.toLocaleString()}` : '-',                  color: 'text-emerald-400' },
          { label: 'CPL',          value: overallCpl > 0 ? `₩${overallCpl.toLocaleString()}` : '-',                     color: 'text-white' },
          { label: 'ROAS',         value: overallRoas > 0 ? `${overallRoas}%` : '-',                                    color: overallRoas >= 100 ? 'text-emerald-400' : overallRoas > 0 ? 'text-red-400' : 'text-slate-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass-card p-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 leading-tight">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{loading ? '-' : value}</p>
          </div>
        ))}
      </div>

      {/* CPL / ROAS 차트 */}
      {(cplChartData.length > 0 || roasChartData.length > 0) && (
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-1">플랫폼별 CPL</h3>
            <p className="text-xs text-slate-500 mb-4">DB 1건 획득 비용</p>
            {cplChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={cplChartData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `₩${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: 'none', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => [`₩${Number(v).toLocaleString()}`, 'CPL']} />
                  <Bar dataKey="cpl" radius={[4, 4, 0, 0]}>
                    {cplChartData.map((entry, i) => (
                      <Cell key={i} fill={PLATFORM_CONFIG[entry.key]?.chartColor || '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[180px] flex items-center justify-center text-slate-600 text-xs">예산 입력 후 표시</div>}
          </div>
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-1">플랫폼별 ROAS</h3>
            <p className="text-xs text-slate-500 mb-4">예산 대비 매출 (100% 이상 = 흑자)</p>
            {roasChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={roasChartData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${v}%`} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: 'none', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => [`${v}%`, 'ROAS']} />
                  <Bar dataKey="roas" radius={[4, 4, 0, 0]}>
                    {roasChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.roas >= 100 ? (PLATFORM_CONFIG[entry.key]?.chartColor || '#10b981') : '#ef4444'} fillOpacity={entry.roas >= 100 ? 1 : 0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[180px] flex items-center justify-center text-slate-600 text-xs">예산 입력 후 표시</div>}
          </div>
        </div>
      )}

      {/* 분석 상세 테이블 */}
      <div className="glass-card mb-5 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">상세 분석</h3>
          <div className="flex gap-1">
            {([['campaign', '캠페인별'], ['month', '월별'], ['post', '콘텐츠별']] as const).map(([val, label]) => (
              <button key={val} onClick={() => setGroupBy(val)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${groupBy === val ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {detailLoading ? (
          <div className="p-4 space-y-2">{Array(3).fill(0).map((_, i) => <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />)}</div>
        ) : detailAnalytics.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">분석 데이터가 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-white/5">
                {['구분', '포스트', '예산', 'DB 유입', '결제 매출', 'CPL', 'ROAS'].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detailAnalytics.map(row => (
                <tr key={row.key} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-3 px-4">
                    <p className="text-white text-xs font-medium truncate max-w-[200px]">{row.label}</p>
                    {row.platform && <span className={`text-[10px] ${PLATFORM_CONFIG[row.platform]?.color?.split(' ')[1] || 'text-slate-400'}`}>{PLATFORM_CONFIG[row.platform]?.label || row.platform}</span>}
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-xs">{row.postCount}개</td>
                  <td className="py-3 px-4 text-xs">{row.budget > 0 ? <span className="text-amber-400 font-medium">₩{row.budget.toLocaleString()}</span> : <span className="text-slate-600">-</span>}</td>
                  <td className="py-3 px-4 text-xs">{row.leads > 0 ? <span className="text-blue-400">{row.leads}건</span> : <span className="text-slate-600">-</span>}</td>
                  <td className="py-3 px-4 text-xs">{row.revenue > 0 ? <span className="text-emerald-400">₩{row.revenue.toLocaleString()}</span> : <span className="text-slate-600">-</span>}</td>
                  <td className="py-3 px-4 text-xs">{row.cpl > 0 ? <span className="text-white font-semibold">₩{row.cpl.toLocaleString()}</span> : <span className="text-slate-600">-</span>}</td>
                  <td className="py-3 px-4 text-xs">{row.roas > 0 ? <span className={`font-semibold ${row.roas >= 100 ? 'text-emerald-400' : 'text-red-400'}`}>{row.roas}%</span> : <span className="text-slate-600">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── 콘텐츠 목록 ── */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h3 className="text-sm font-semibold text-slate-300">콘텐츠 목록 <span className="text-slate-500 font-normal">({filteredPosts.length})</span></h3>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="콘텐츠명 검색..."
              className="bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 w-52"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">{Array(4).fill(0).map((_, i) => <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />)}</div>
        ) : filteredPosts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400 text-sm">{searchQuery ? '검색 결과가 없습니다.' : '콘텐츠 데이터가 없습니다.'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                {['플랫폼', '제목 / UTM', '발행일', '조회수', '참여수', '예산', ''].map((h, i) => (
                  <th key={i} className={`py-3 px-4 font-medium ${i >= 3 && i <= 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPosts.map(p => <ContentRow key={p.id} post={p} onDelete={handleDelete} onRefresh={fetchPosts} />)}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

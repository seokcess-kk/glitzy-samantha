'use client'
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Scan, AlertTriangle, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useClinic } from '@/components/ClinicContext'

const RISK_CONFIG = {
  safe:    { label: '안전',  color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle,    bar: 'bg-emerald-500' },
  caution: { label: '주의',  color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',   icon: AlertCircle,    bar: 'bg-yellow-500'  },
  danger:  { label: '위험',  color: 'bg-red-500/20 text-red-400 border-red-500/30',             icon: AlertTriangle,  bar: 'bg-red-500'     },
}

const PLATFORM_COLORS: Record<string, string> = {
  Instagram: 'bg-purple-500/20 text-purple-400',
  YouTube:   'bg-red-500/20 text-red-400',
  TikTok:    'bg-pink-500/20 text-pink-400',
  Naver:     'bg-green-500/20 text-green-400',
}

function AuditRow({ post, onAnalyze }: { post: any; onAnalyze: (id: number) => Promise<void> }) {
  const [expanded, setExpanded] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const audit = post.audit

  const handleAnalyze = async () => {
    setAnalyzing(true)
    await onAnalyze(post.id)
    setAnalyzing(false)
  }

  const riskCfg = audit ? (RISK_CONFIG[audit.risk_level as keyof typeof RISK_CONFIG] || RISK_CONFIG.safe) : null

  return (
    <>
      <tr className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
        <td className="py-3 px-4">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLATFORM_COLORS[post.platform] || 'bg-slate-500/20 text-slate-400'}`}>
            {post.platform}
          </span>
        </td>
        <td className="py-3 px-4">
          <p className="text-sm text-slate-200 truncate max-w-[280px]">{post.post_title}</p>
          {post.utm_campaign && (
            <p className="text-xs text-slate-600 mt-0.5">{post.utm_campaign}</p>
          )}
        </td>
        <td className="py-3 px-4">
          {riskCfg ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden w-20">
                <div
                  className={`h-full rounded-full ${riskCfg.bar}`}
                  style={{ width: `${audit.risk_score}%` }}
                />
              </div>
              <span className="text-xs font-mono text-slate-400 w-8">{audit.risk_score}</span>
            </div>
          ) : (
            <span className="text-xs text-slate-600">미분석</span>
          )}
        </td>
        <td className="py-3 px-4">
          {riskCfg ? (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${riskCfg.color}`}>
              {riskCfg.label}
            </span>
          ) : (
            <span className="text-xs text-slate-600">—</span>
          )}
        </td>
        <td className="py-3 px-4 text-xs text-slate-500">
          {audit?.analyzed_at ? new Date(audit.analyzed_at).toLocaleDateString('ko') : '—'}
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-brand-600/20 text-brand-400 hover:bg-brand-600/30 disabled:opacity-50 transition-all flex items-center gap-1"
            >
              {analyzing ? <RefreshCw size={11} className="animate-spin" /> : <Scan size={11} />}
              {analyzing ? '분석 중...' : '분석'}
            </button>
            {audit?.findings?.length > 0 && (
              <button onClick={() => setExpanded(!expanded)} className="text-slate-500 hover:text-white transition-colors">
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && audit && (
        <tr className="border-b border-white/5 bg-white/[0.02]">
          <td colSpan={6} className="px-4 py-4">
            {audit.summary && (
              <p className="text-sm text-slate-300 mb-3 italic">"{audit.summary}"</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {(audit.findings || []).map((f: any, i: number) => (
                <div key={i} className={`flex items-start gap-2 p-3 rounded-lg ${f.detected ? 'bg-red-500/10 border border-red-500/20' : 'bg-white/[0.02] border border-white/5'}`}>
                  <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${f.detected ? 'bg-red-400' : 'bg-emerald-500'}`} />
                  <div>
                    <p className={`text-xs font-semibold mb-0.5 ${f.detected ? 'text-red-400' : 'text-slate-400'}`}>{f.category}</p>
                    <p className="text-xs text-slate-500">{f.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function MonitorPage() {
  const { selectedClinicId } = useClinic()
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterRisk, setFilterRisk] = useState<string>('all')

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const qs = selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''
      const data = await fetch(`/api/content/audit${qs}`).then(r => r.json())
      setPosts(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [selectedClinicId])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const handleAnalyze = async (postId: number) => {
    await fetch('/api/content/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId }),
    })
    await fetchPosts()
  }

  const analyzed   = posts.filter(p => p.audit)
  const dangerPosts = posts.filter(p => p.audit?.risk_level === 'danger')
  const cautionPosts = posts.filter(p => p.audit?.risk_level === 'caution')
  const safePosts  = posts.filter(p => p.audit?.risk_level === 'safe')

  const filtered = filterRisk === 'all' ? posts
    : filterRisk === 'unanalyzed' ? posts.filter(p => !p.audit)
    : posts.filter(p => p.audit?.risk_level === filterRisk)

  const FILTERS = [
    { key: 'all',        label: '전체',     count: posts.length },
    { key: 'danger',     label: '위험',     count: dangerPosts.length },
    { key: 'caution',    label: '주의',     count: cautionPosts.length },
    { key: 'safe',       label: '안전',     count: safePosts.length },
    { key: 'unanalyzed', label: '미분석',   count: posts.filter(p => !p.audit).length },
  ]

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">콘텐츠 모니터링</h1>
          <p className="text-sm text-slate-400 mt-1">네이버 블로그 · 인스타그램 피드 텍스트의 의료광고법 저촉 여부를 AI로 분석합니다.</p>
        </div>
        <button
          onClick={fetchPosts}
          disabled={loading}
          className="glass-card p-2.5 hover:bg-white/10 transition-all"
        >
          <RefreshCw size={16} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: '총 콘텐츠',  value: posts.length,         color: 'text-white' },
          { label: '위험',       value: dangerPosts.length,   color: 'text-red-400' },
          { label: '주의',       value: cautionPosts.length,  color: 'text-yellow-400' },
          { label: '안전',       value: safePosts.length,     color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass-card p-4">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{loading ? '-' : value}</p>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-5">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilterRisk(f.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              filterRisk === f.key
                ? 'bg-brand-600 text-white border-brand-600'
                : 'glass-card border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {f.label}
            <span className={`ml-1.5 ${filterRisk === f.key ? 'opacity-70' : 'text-slate-600'}`}>({f.count})</span>
          </button>
        ))}
      </div>

      {/* 포스트 테이블 */}
      <div className="glass-card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array(5).fill(0).map((_, i) => <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Scan size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-1">콘텐츠가 없습니다.</p>
            <p className="text-xs">브랜드 콘텐츠 분석 메뉴에서 포스트를 먼저 등록하세요.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                {['플랫폼', '콘텐츠 제목', '위험도 점수', '등급', '마지막 분석', '액션'].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(post => (
                <AuditRow key={post.id} post={post} onAnalyze={handleAnalyze} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* API 키 안내 */}
      {!process.env.NEXT_PUBLIC_HAS_ANTHROPIC && analyzed.length === 0 && posts.length > 0 && (
        <div className="mt-4 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
          💡 분석 기능을 사용하려면 <code className="bg-white/10 px-1 rounded">.env.local</code>에{' '}
          <code className="bg-white/10 px-1 rounded">ANTHROPIC_API_KEY</code>를 설정하세요.
        </div>
      )}
    </>
  )
}

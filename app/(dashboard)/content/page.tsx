'use client'
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Plus, Trash2, Eye, Heart, MessageCircle, Share2, Bookmark, ExternalLink, Check, AlertCircle, X } from 'lucide-react'
import { useClinic } from '@/components/ClinicContext'

// ─── 상수 ─────────────────────────────────────────────────
const PLATFORM_CONFIG: Record<string, { label: string; color: string; hasApi: boolean; statFields: string[] }> = {
  youtube:          { label: '유튜브',        color: 'bg-red-500/20 text-red-400 border-red-500/30',      hasApi: true,  statFields: ['views', 'likes', 'comments'] },
  instagram_feed:   { label: '인스타 피드',   color: 'bg-pink-500/20 text-pink-400 border-pink-500/30',   hasApi: true,  statFields: ['likes', 'comments', 'saves', 'reach'] },
  instagram_reels:  { label: '인스타 릴스',   color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', hasApi: true, statFields: ['views', 'likes', 'comments', 'shares'] },
  tiktok:           { label: '틱톡',          color: 'bg-slate-400/20 text-slate-300 border-slate-400/30', hasApi: false, statFields: ['views', 'likes', 'comments', 'shares'] },
  naver_blog:       { label: '네이버 블로그', color: 'bg-green-500/20 text-green-400 border-green-500/30', hasApi: false, statFields: ['views', 'likes', 'comments'] },
}

const STAT_ICON: Record<string, any> = {
  views: Eye, likes: Heart, comments: MessageCircle, shares: Share2, saves: Bookmark, reach: Eye, impressions: Eye,
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
    views: '', likes: '', comments: '', shares: '', saves: '',
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
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* 플랫폼 선택 */}
          <div>
            <label className="text-xs text-slate-500 mb-2 block">플랫폼 *</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setForm(f => ({ ...f, platform: key }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.platform === key ? `${cfg.color} border-current` : 'border-white/10 text-slate-400 hover:text-white'}`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-slate-500 mb-1 block">제목 *</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="콘텐츠 제목"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">URL</label>
              <input type="url" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">발행일</label>
              <input type="date" value={form.published_at} onChange={e => setForm(f => ({ ...f, published_at: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
            </div>
          </div>

          {/* 통계 입력 */}
          <div>
            <label className="text-xs text-slate-500 mb-2 block">현재 통계</label>
            <div className="grid grid-cols-5 gap-2">
              {platCfg.statFields.map(field => (
                <div key={field}>
                  <label className="text-[10px] text-slate-600 mb-1 block">{STAT_LABEL[field]}</label>
                  <input type="number" value={(form as any)[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder="0" min="0"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500" />
                </div>
              ))}
            </div>
          </div>

          {/* UTM 파라미터 */}
          <details className="group">
            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors">UTM 파라미터 (선택)</summary>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {[
                { key: 'utm_source', label: 'Source (소스)' },
                { key: 'utm_medium', label: 'Medium (채널)' },
                { key: 'utm_campaign', label: 'Campaign (캠페인)' },
                { key: 'utm_content', label: 'Content (소재)' },
                { key: 'utm_term', label: 'Term (키워드)' },
              ].map(({ key, label }) => (
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
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">취소</button>
          <button onClick={handleSave} disabled={saving || !form.title}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-all">
            {saving ? '저장 중...' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 통계 수기 수정 인라인 폼 ─────────────────────────────
function StatEditRow({ post, onSaved }: { post: any; onSaved: () => void }) {
  const platCfg = PLATFORM_CONFIG[post.platform]
  const latestStat = (post.stats || []).sort((a: any, b: any) => b.stat_date?.localeCompare(a.stat_date))[0] || {}
  const [form, setForm] = useState<Record<string, number>>({
    views: latestStat.views || 0, likes: latestStat.likes || 0,
    comments: latestStat.comments || 0, shares: latestStat.shares || 0, saves: latestStat.saves || 0,
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/content/posts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: post.id, ...form }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="mt-3 flex items-end gap-2">
      {platCfg.statFields.map(field => (
        <div key={field} className="flex-1">
          <label className="text-[10px] text-slate-500 mb-1 block">{STAT_LABEL[field]}</label>
          <input type="number" value={form[field] || 0}
            onChange={e => setForm(f => ({ ...f, [field]: Number(e.target.value) }))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500" />
        </div>
      ))}
      <button onClick={handleSave} disabled={saving}
        className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all whitespace-nowrap">
        {saving ? '저장' : '업데이트'}
      </button>
    </div>
  )
}

// ─── 콘텐츠 카드 ──────────────────────────────────────────
function ContentCard({ post, onDelete, onRefresh }: { post: any; onDelete: (id: number) => void; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const platCfg = PLATFORM_CONFIG[post.platform] || { label: post.platform, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', statFields: [], hasApi: false }
  const latestStat = (post.stats || []).sort((a: any, b: any) => b.stat_date?.localeCompare(a.stat_date))[0] || {}

  const engagement = (latestStat.likes || 0) + (latestStat.comments || 0) + (latestStat.shares || 0) + (latestStat.saves || 0)

  return (
    <div className="glass-card p-4">
      <div className="flex items-start gap-4">
        {/* 썸네일 */}
        {post.thumbnail_url ? (
          <img src={post.thumbnail_url} alt={post.title} className="w-20 h-14 object-cover rounded-lg shrink-0" />
        ) : (
          <div className="w-20 h-14 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
            <span className="text-slate-600 text-xs">{platCfg.label[0]}</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${platCfg.color}`}>{platCfg.label}</span>
                {post.is_api_synced && <span className="text-[10px] text-slate-500">API</span>}
                {(post.utm_campaign || post.utm_source) && (
                  <span className="text-[10px] text-brand-400 bg-brand-600/10 px-1.5 py-0.5 rounded">UTM</span>
                )}
              </div>
              <p className="text-white text-sm font-medium truncate">{post.title}</p>
              {post.published_at && (
                <p className="text-xs text-slate-500 mt-0.5">{new Date(post.published_at).toLocaleDateString('ko')}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {post.url && (
                <a href={post.url} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-slate-500 hover:text-white">
                  <ExternalLink size={13} />
                </a>
              )}
              {!post.is_api_synced && (
                <button onClick={() => setExpanded(v => !v)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-slate-500 hover:text-white text-xs">
                  수정
                </button>
              )}
              <button onClick={() => onDelete(post.id)}
                className="p-1.5 hover:bg-red-500/10 rounded-lg transition-all text-slate-600 hover:text-red-400">
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* 통계 */}
          <div className="flex items-center gap-4 mt-2">
            {latestStat.views != null && latestStat.views > 0 && (
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Eye size={11} /> {latestStat.views.toLocaleString()}
              </div>
            )}
            {latestStat.likes != null && latestStat.likes > 0 && (
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Heart size={11} /> {latestStat.likes.toLocaleString()}
              </div>
            )}
            {latestStat.comments != null && latestStat.comments > 0 && (
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <MessageCircle size={11} /> {latestStat.comments.toLocaleString()}
              </div>
            )}
            {latestStat.shares != null && latestStat.shares > 0 && (
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Share2 size={11} /> {latestStat.shares.toLocaleString()}
              </div>
            )}
            {engagement > 0 && (
              <div className="ml-auto text-xs text-slate-500">참여 {engagement.toLocaleString()}</div>
            )}
          </div>
        </div>
      </div>

      {/* 수기 통계 수정 */}
      {expanded && !post.is_api_synced && (
        <div className="border-t border-white/5 mt-3 pt-3">
          <StatEditRow post={post} onSaved={() => { setExpanded(false); onRefresh() }} />
        </div>
      )}
    </div>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────
export default function ContentPage() {
  const { selectedClinicId } = useClinic()
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [platformFilter, setPlatformFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [syncResult, setSyncResult] = useState<any>(null)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))
      if (platformFilter !== 'all') qs.set('platform', platformFilter)
      const res = await fetch(`/api/content/posts?${qs}`)
      const data = await res.json()
      setPosts(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [selectedClinicId, platformFilter])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const qs = selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''
      const res = await fetch(`/api/content/sync${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'all' }),
      })
      const data = await res.json()
      setSyncResult(data)
      if (data.success) {
        setToast({ msg: 'API 동기화 완료', type: 'success' })
        fetchPosts()
      } else {
        setToast({ msg: data.message || '동기화 실패', type: 'error' })
      }
    } catch {
      setToast({ msg: '동기화 요청 실패', type: 'error' })
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('콘텐츠를 삭제하시겠습니까?')) return
    await fetch('/api/content/posts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    fetchPosts()
  }

  // 집계 통계
  const getLatestStat = (post: any) =>
    (post.stats || []).sort((a: any, b: any) => b.stat_date?.localeCompare(a.stat_date))[0] || {}

  const totalViews = posts.reduce((s, p) => s + (getLatestStat(p).views || 0), 0)
  const totalLikes = posts.reduce((s, p) => s + (getLatestStat(p).likes || 0), 0)
  const totalComments = posts.reduce((s, p) => s + (getLatestStat(p).comments || 0), 0)
  const totalEngagement = posts.reduce((s, p) => {
    const st = getLatestStat(p)
    return s + (st.likes || 0) + (st.comments || 0) + (st.shares || 0) + (st.saves || 0)
  }, 0)

  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {showAddModal && <AddContentModal onClose={() => setShowAddModal(false)} onSaved={fetchPosts} clinicId={selectedClinicId} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">브랜드 콘텐츠 성과</h1>
          <p className="text-sm text-slate-400 mt-1">유튜브 · 인스타그램 · 틱톡 · 네이버 블로그 콘텐츠 성과 통합 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 glass-card px-4 py-2 text-sm text-slate-300 hover:text-white transition-all disabled:opacity-50">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'API 동기화 중...' : 'API 동기화'}
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all">
            <Plus size={14} /> 콘텐츠 추가
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: '총 조회수', value: totalViews.toLocaleString() },
          { label: '총 좋아요', value: totalLikes.toLocaleString() },
          { label: '총 댓글', value: totalComments.toLocaleString() },
          { label: '총 참여수', value: totalEngagement.toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} className="glass-card p-4">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-xl font-bold text-white">{loading ? '-' : value}</p>
          </div>
        ))}
      </div>

      {/* 동기화 결과 */}
      {syncResult && (
        <div className="glass-card p-4 mb-6 text-sm">
          {syncResult.results?.youtube && (
            <p className="text-slate-300">유튜브: {syncResult.results.youtube.error ? `❌ ${syncResult.results.youtube.error}` : `✅ ${syncResult.results.youtube.count}개 동기화`}</p>
          )}
          {syncResult.results?.instagram && (
            <p className="text-slate-300">인스타그램: {syncResult.results.instagram.error ? `❌ ${syncResult.results.instagram.error}` : `✅ ${syncResult.results.instagram.count}개 동기화`}</p>
          )}
          {syncResult.message && <p className="text-slate-400">{syncResult.message}</p>}
        </div>
      )}

      {/* 플랫폼 필터 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setPlatformFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${platformFilter === 'all' ? 'bg-brand-600 text-white' : 'glass-card text-slate-400 hover:text-white'}`}>
          전체 <span className="ml-1 opacity-60">{posts.length}</span>
        </button>
        {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => {
          const count = posts.filter(p => p.platform === key).length
          return (
            <button key={key} onClick={() => setPlatformFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${platformFilter === key ? `${cfg.color} border-current` : 'glass-card border-transparent text-slate-400 hover:text-white'}`}>
              {cfg.label} {cfg.hasApi && <span className="ml-1 text-[9px] opacity-50">API</span>}
              <span className="ml-1 opacity-60">{count}</span>
            </button>
          )
        })}
      </div>

      {/* 콘텐츠 목록 */}
      {loading ? (
        <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="glass-card h-24 animate-pulse" />)}</div>
      ) : posts.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <p className="text-slate-400 text-sm mb-2">콘텐츠 데이터가 없습니다.</p>
          <p className="text-slate-600 text-xs">API 동기화 또는 수동으로 콘텐츠를 추가해주세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(p => (
            <ContentCard key={p.id} post={p} onDelete={handleDelete} onRefresh={fetchPosts} />
          ))}
        </div>
      )}
    </>
  )
}

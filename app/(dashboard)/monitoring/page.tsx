'use client'
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { TrendingUp, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useClinic } from '@/components/ClinicContext'
import { LineChart, ResponsiveContainer, Line, XAxis, YAxis, CartesianGrid, Tooltip } from '@/components/charts'

const CATEGORY_LABELS: Record<string, string> = {
  place: '네이버 플레이스',
  website: '웹사이트',
  smartblock: '스마트블록',
}

const CATEGORY_LIST = ['place', 'website', 'smartblock']

function getRankColor(rank: number | null | undefined): string {
  if (rank == null) return ''
  if (rank <= 3) return 'bg-emerald-500/20 text-emerald-400'
  if (rank <= 10) return 'bg-yellow-500/20 text-yellow-400'
  return 'bg-red-500/20 text-red-400'
}

export default function MonitoringPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as any
  const { selectedClinicId, setSelectedClinicId, clinics } = useClinic()

  const [category, setCategory] = useState('place')
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [keywords, setKeywords] = useState<any[]>([])
  const [rankings, setRankings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.role === 'clinic_staff') router.replace('/patients')
  }, [user, router])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ month, category })
        if (selectedClinicId) params.set('clinic_id', String(selectedClinicId))
        const res = await fetch(`/api/monitoring/rankings?${params}`)
        const data = await res.json()
        if (res.ok) {
          setKeywords(data.keywords || [])
          setRankings(data.rankings || [])
        } else {
          toast.error(data.error || '데이터 로드 실패')
        }
      } catch {
        toast.error('데이터 로드 실패')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [month, category, selectedClinicId])

  const changeMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const [year, mon] = month.split('-').map(Number)
  const daysInMonth = new Date(year, mon, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  // 오늘 날짜 (현재 월인지 확인용)
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === mon
  const todayDay = today.getDate()

  // 순위 맵: keyword_id -> { day: ranking } — 문자열 파싱으로 UTC 이슈 방지
  const rankMap = useMemo(() => {
    const map: Record<number, Record<number, { rank: number | null; url?: string }>> = {}
    for (const r of rankings) {
      const day = parseInt(r.rank_date.split('-')[2], 10)
      if (!map[r.keyword_id]) map[r.keyword_id] = {}
      map[r.keyword_id][day] = { rank: r.rank_position, url: r.url }
    }
    return map
  }, [rankings])

  // 요약 지표 계산
  const summary = useMemo(() => {
    if (keywords.length === 0) return null

    // 최신 순위 (가장 마지막 입력 날짜 기준)
    let latestDay = 0
    for (const r of rankings) {
      const day = parseInt(r.rank_date.split('-')[2], 10)
      if (day > latestDay) latestDay = day
    }

    let top3Count = 0
    let top10Count = 0
    let totalRank = 0
    let rankedCount = 0

    for (const kw of keywords) {
      const rd = rankMap[kw.id]?.[latestDay]
      if (rd?.rank != null) {
        if (rd.rank <= 3) top3Count++
        if (rd.rank <= 10) top10Count++
        totalRank += rd.rank
        rankedCount++
      }
    }

    // 전월 마지막 날 대비 변동
    const firstDay = Math.min(...rankings.map(r => parseInt(r.rank_date.split('-')[2], 10)))
    let improvedCount = 0
    let declinedCount = 0
    for (const kw of keywords) {
      const first = rankMap[kw.id]?.[firstDay]?.rank
      const latest = rankMap[kw.id]?.[latestDay]?.rank
      if (first != null && latest != null) {
        if (latest < first) improvedCount++
        else if (latest > first) declinedCount++
      }
    }

    return {
      avgRank: rankedCount > 0 ? (totalRank / rankedCount).toFixed(1) : '-',
      top3Count,
      top10Count,
      totalKeywords: keywords.length,
      improvedCount,
      declinedCount,
      latestDay,
    }
  }, [keywords, rankings, rankMap])

  // 차트 데이터
  const chartData = useMemo(() => {
    if (keywords.length === 0) return []
    return days.map(day => {
      const entry: Record<string, any> = { day: `${day}일` }
      for (const kw of keywords) {
        const rd = rankMap[kw.id]?.[day]
        entry[kw.keyword] = rd?.rank ?? null
      }
      return entry
    })
  }, [keywords, rankMap, days])

  const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#3b82f6', '#f97316']

  if (user?.role === 'clinic_staff') return null

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="text-brand-400" size={24} />
          <h1 className="text-2xl font-bold text-white">순위 모니터링</h1>
        </div>
        <p className="text-sm text-slate-400">네이버 플레이스 · 웹사이트 · 스마트블록 순위 추적</p>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">병원</Label>
          <Select
            value={selectedClinicId ? String(selectedClinicId) : '_none'}
            onValueChange={v => setSelectedClinicId(v === '_none' ? null : Number(v))}
          >
            <SelectTrigger className="w-[200px] bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">전체 병원</SelectItem>
              {clinics.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">월</Label>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)} className="h-10 w-8">
              <ChevronLeft size={16} />
            </Button>
            <span className="text-white font-medium min-w-[100px] text-center text-sm">{year}년 {mon}월</span>
            <Button variant="ghost" size="icon" onClick={() => changeMonth(1)} className="h-10 w-8">
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">카테고리</Label>
          <div className="flex gap-1">
            {CATEGORY_LIST.map(c => (
              <Button
                key={c}
                variant={category === c ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCategory(c)}
                className={category === c ? 'bg-brand-600 hover:bg-brand-700 text-white' : 'text-slate-400 hover:text-white'}
              >
                {CATEGORY_LABELS[c]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <Card variant="glass" className="p-6">
          <Skeleton className="h-[300px] w-full" />
        </Card>
      ) : keywords.length === 0 ? (
        <Card variant="glass" className="p-12 text-center">
          <p className="text-slate-500">등록된 키워드가 없습니다.</p>
        </Card>
      ) : (
        <>
          {/* 요약 카드 */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Card variant="glass" className="p-4 text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">평균 순위</p>
                <p className="text-2xl font-bold text-white">{summary.avgRank}<span className="text-sm text-slate-500 font-normal">위</span></p>
              </Card>
              <Card variant="glass" className="p-4 text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">TOP 3</p>
                <p className="text-2xl font-bold text-emerald-400">{summary.top3Count}<span className="text-sm text-slate-500 font-normal"> / {summary.totalKeywords}</span></p>
              </Card>
              <Card variant="glass" className="p-4 text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">TOP 10</p>
                <p className="text-2xl font-bold text-yellow-400">{summary.top10Count}<span className="text-sm text-slate-500 font-normal"> / {summary.totalKeywords}</span></p>
              </Card>
              <Card variant="glass" className="p-4 text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">월간 변동</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-emerald-400 font-bold">{summary.improvedCount}</span>
                  <span className="text-slate-600 text-xs">상승</span>
                  <span className="text-red-400 font-bold">{summary.declinedCount}</span>
                  <span className="text-slate-600 text-xs">하락</span>
                </div>
              </Card>
            </div>
          )}

          {/* 월간 순위 테이블 */}
          <Card variant="glass" className="p-4 mb-6 overflow-x-auto">
            <h3 className="text-sm font-semibold text-white mb-3">월간 순위 테이블</h3>
            <table className="w-full text-xs border-collapse min-w-[800px]">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-[#0f0f23] text-left px-2 py-2 text-slate-500 font-medium border-b border-white/5 min-w-[120px] z-10">키워드</th>
                  {days.map(d => (
                    <th
                      key={d}
                      className={`text-center px-1 py-2 font-medium border-b border-white/5 min-w-[36px] ${
                        isCurrentMonth && d === todayDay ? 'text-brand-400' : isCurrentMonth && d > todayDay ? 'text-slate-700' : 'text-slate-500'
                      }`}
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keywords.map(kw => (
                  <tr key={kw.id} className="border-b border-white/5">
                    <td className="sticky left-0 bg-[#0f0f23] px-2 py-2 text-slate-300 font-medium z-10">{kw.keyword}</td>
                    {days.map(d => {
                      const rd = rankMap[kw.id]?.[d]
                      const rank = rd?.rank
                      const isFuture = isCurrentMonth && d > todayDay
                      return (
                        <td key={d} className={`text-center px-1 py-2 ${isFuture ? 'opacity-20' : ''}`}>
                          {rank != null ? (
                            <span
                              className={`inline-flex items-center justify-center w-7 h-6 rounded text-[10px] font-bold ${getRankColor(rank)} ${rd?.url ? 'cursor-pointer' : ''}`}
                              title={rd?.url || undefined}
                              onClick={() => rd?.url && window.open(rd.url, '_blank')}
                            >
                              {rank}
                            </span>
                          ) : (
                            <span className="text-slate-700">-</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* 추이 차트 */}
          <Card variant="glass" className="p-6">
            <h3 className="text-sm font-semibold text-white mb-4">순위 추이 차트</h3>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis reversed domain={['auto', 1]} allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value: any) => value != null ? [`${value}위`] : ['-']}
                  />
                  {keywords.map((kw, i) => (
                    <Line
                      key={kw.id}
                      type="monotone"
                      dataKey={kw.keyword}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-3">
              {keywords.map((kw, i) => (
                <div key={kw.id} className="flex items-center gap-1.5 text-xs text-slate-400">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  {kw.keyword}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </>
  )
}

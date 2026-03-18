'use client'
import React, { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react'
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
import { PageHeader } from '@/components/common'
// 차트 숨김 처리 — 필요 시 복원
// import { LineChart, ResponsiveContainer, Line, XAxis, YAxis, CartesianGrid, Tooltip } from '@/components/charts'

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

  const [category, setCategory] = useState('all')
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
        const params = new URLSearchParams({ month })
        if (category !== 'all') params.set('category', category)
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

    // 월초 대비 변동
    const allDays = rankings.map(r => parseInt(r.rank_date.split('-')[2], 10))
    const firstDay = allDays.length > 0 ? Math.min(...allDays) : latestDay
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

  // 차트 숨김 처리 — 필요 시 복원

  if (user?.role === 'clinic_staff') return null

  return (
    <>
      <PageHeader icon={TrendingUp} title="순위 모니터링" description="네이버 플레이스 · 웹사이트 · 스마트블록 순위 추적" />

      {/* 필터 */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">병원</Label>
          <Select
            value={selectedClinicId ? String(selectedClinicId) : '_none'}
            onValueChange={v => setSelectedClinicId(v === '_none' ? null : Number(v))}
          >
            <SelectTrigger className="w-[200px] bg-muted dark:bg-white/5 border-border dark:border-white/10 text-foreground">
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
          <Label className="text-xs text-muted-foreground">월</Label>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)} className="h-10 w-8">
              <ChevronLeft size={16} />
            </Button>
            <span className="text-foreground font-medium min-w-[100px] text-center text-sm">{year}년 {mon}월</span>
            <Button variant="ghost" size="icon" onClick={() => changeMonth(1)} className="h-10 w-8">
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">카테고리</Label>
          <div className="flex gap-1">
            <Button
              variant={category === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCategory('all')}
              className={category === 'all' ? 'bg-brand-600 hover:bg-brand-700 text-white' : 'text-muted-foreground hover:text-foreground'}
            >
              전체
            </Button>
            {CATEGORY_LIST.map(c => (
              <Button
                key={c}
                variant={category === c ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCategory(c)}
                className={category === c ? 'bg-brand-600 hover:bg-brand-700 text-white' : 'text-muted-foreground hover:text-foreground'}
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
          <p className="text-muted-foreground">등록된 키워드가 없습니다.</p>
        </Card>
      ) : (
        <>
          {/* 요약 카드 */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Card variant="glass" className="p-5 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">평균 순위</p>
                <p className="text-3xl font-bold text-foreground">{summary.avgRank}<span className="text-base text-muted-foreground font-normal ml-0.5">위</span></p>
              </Card>
              <Card variant="glass" className="p-5 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">TOP 3</p>
                <p className="text-3xl font-bold text-emerald-400">{summary.top3Count}<span className="text-base text-muted-foreground font-normal ml-1">/ {summary.totalKeywords}</span></p>
              </Card>
              <Card variant="glass" className="p-5 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">TOP 10</p>
                <p className="text-3xl font-bold text-yellow-400">{summary.top10Count}<span className="text-base text-muted-foreground font-normal ml-1">/ {summary.totalKeywords}</span></p>
              </Card>
              <Card variant="glass" className="p-5 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">월간 변동</p>
                <div className="flex items-center justify-center gap-3 mt-1">
                  <div className="text-center">
                    <span className="text-2xl font-bold text-emerald-400">{summary.improvedCount}</span>
                    <span className="text-xs text-muted-foreground ml-1">상승</span>
                  </div>
                  <div className="text-center">
                    <span className="text-2xl font-bold text-red-400">{summary.declinedCount}</span>
                    <span className="text-xs text-muted-foreground ml-1">하락</span>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* 월간 순위 테이블 */}
          <Card variant="glass" className="p-4 mb-6 overflow-x-auto">
            <h3 className="text-sm font-semibold text-foreground mb-3">월간 순위 테이블</h3>
            <table className="w-full text-xs border-collapse min-w-[800px]">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-card text-left px-3 py-2.5 text-muted-foreground font-semibold border-b border-border dark:border-white/10 min-w-[140px] z-10">키워드</th>
                  {days.map(d => (
                    <th
                      key={d}
                      className={`text-center px-1 py-2 font-medium border-b border-border dark:border-white/10 min-w-[36px] ${
                        isCurrentMonth && d === todayDay ? 'text-brand-400' : isCurrentMonth && d > todayDay ? 'text-muted-foreground/40' : 'text-muted-foreground'
                      }`}
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keywords.map((kw, kwIdx) => {
                  // 전체 보기에서 카테고리 구분 헤더
                  const prevCategory = kwIdx > 0 ? keywords[kwIdx - 1].category : null
                  const showCategoryHeader = category === 'all' && kw.category !== prevCategory
                  return (
                    <React.Fragment key={kw.id}>
                      {showCategoryHeader && (
                        <tr>
                          <td colSpan={days.length + 1} className="sticky left-0 bg-muted/50 dark:bg-card px-2 pt-4 pb-1 text-[10px] text-muted-foreground uppercase tracking-wider font-medium z-10">
                            {CATEGORY_LABELS[kw.category] || kw.category}
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-border dark:border-white/5">
                        <td className="sticky left-0 bg-card px-3 py-2.5 font-medium z-10">
                          <span className={kw.is_active === false ? 'text-muted-foreground/60 line-through' : 'text-foreground/80'}>{kw.keyword}</span>
                          {kw.is_active === false && <span className="ml-1 text-[9px] text-muted-foreground/60">(비활성)</span>}
                        </td>
                    {days.map(d => {
                      const rd = rankMap[kw.id]?.[d]
                      const rank = rd?.rank
                      const isFuture = isCurrentMonth && d > todayDay
                      return (
                        <td key={d} className={`text-center px-1 py-2 ${isFuture ? 'opacity-20' : ''}`}>
                          {rank != null ? (
                            rd?.url ? (
                              <a
                                href={rd.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center justify-center w-7 h-6 rounded text-[10px] font-bold ${getRankColor(rank)} cursor-pointer hover:opacity-80`}
                              >
                                {rank}
                              </a>
                            ) : (
                              <span className={`inline-flex items-center justify-center w-7 h-6 rounded text-[10px] font-bold ${getRankColor(rank)}`}>
                                {rank}
                              </span>
                            )
                          ) : (
                            <span className="text-muted-foreground/40">-</span>
                          )}
                        </td>
                      )
                    })}
                      </tr>
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </Card>

          {/* 추이 차트 — 현재 숨김 처리 */}
        </>
      )}
    </>
  )
}

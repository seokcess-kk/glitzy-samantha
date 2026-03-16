'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { FileEdit, Save, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useClinic } from '@/components/ClinicContext'

const CATEGORY_LABELS: Record<string, string> = {
  place: '네이버 플레이스',
  website: '웹사이트',
  smartblock: '스마트블록',
}

interface KeywordEntry {
  keyword_id: number
  keyword: string
  category: string
  rank_position: string
  url: string
  prev_rank: number | null // 전일 순위
}

export default function MonitoringInputPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as any
  const { selectedClinicId, setSelectedClinicId, clinics } = useClinic()

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState<KeywordEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user && user.role !== 'superadmin' && user.role !== 'agency_staff') {
      router.replace('/monitoring')
    }
  }, [user, router])

  // 날짜 이동
  const changeDate = (delta: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    setDate(d.toISOString().split('T')[0])
  }

  // 키워드 + 기존 순위 로드
  useEffect(() => {
    if (!selectedClinicId) {
      setEntries([])
      setLoading(false)
      return
    }

    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ clinic_id: String(selectedClinicId), active_only: 'true' })
        const kwRes = await fetch(`/api/monitoring/keywords?${params}`)
        const kwData = await kwRes.json()
        const keywords = Array.isArray(kwData) ? kwData : []

        // 기존 순위 조회 (해당 월 전체)
        const month = date.slice(0, 7)
        const rankParams = new URLSearchParams({ clinic_id: String(selectedClinicId), month })
        const rankRes = await fetch(`/api/monitoring/rankings?${rankParams}`)
        const rankData = await rankRes.json()
        const existingRankings = rankData.rankings || []

        // 선택 날짜 및 전일 데이터 매핑
        const prevDate = new Date(date)
        prevDate.setDate(prevDate.getDate() - 1)
        const prevDateStr = prevDate.toISOString().split('T')[0]

        const rankMap: Record<number, { rank: number | null; url?: string }> = {}
        const prevRankMap: Record<number, number | null> = {}
        for (const r of existingRankings) {
          if (r.rank_date === date) {
            rankMap[r.keyword_id] = { rank: r.rank_position, url: r.url }
          }
          if (r.rank_date === prevDateStr) {
            prevRankMap[r.keyword_id] = r.rank_position
          }
        }

        const newEntries: KeywordEntry[] = keywords.map((kw: any) => ({
          keyword_id: kw.id,
          keyword: kw.keyword,
          category: kw.category,
          rank_position: rankMap[kw.id]?.rank?.toString() || '',
          url: rankMap[kw.id]?.url || '',
          prev_rank: prevRankMap[kw.id] ?? null,
        }))

        setEntries(newEntries)
      } catch {
        toast.error('키워드 로드 실패')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [selectedClinicId, date])

  const updateEntry = (idx: number, field: 'rank_position' | 'url', value: string) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const handleSave = async () => {
    const rankings = entries
      .filter(e => e.rank_position !== '')
      .map(e => ({
        keyword_id: e.keyword_id,
        rank_date: date,
        rank_position: parseInt(e.rank_position, 10) || null,
        url: e.url || null,
      }))

    if (rankings.length === 0) {
      toast.error('순위를 최소 1개 이상 입력해주세요.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/monitoring/rankings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rankings }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '저장 실패')
      }
      toast.success(`${data.count}개 순위가 저장되었습니다.`)
      // 저장 후 데이터 refetch — prev_rank 등 최신 상태 반영
      setDate(d => d) // trigger re-fetch via useEffect
      // force re-fetch by toggling a dep
      const month = date.slice(0, 7)
      const rankParams = new URLSearchParams({ clinic_id: String(selectedClinicId!), month })
      const rankRes = await fetch(`/api/monitoring/rankings?${rankParams}`)
      const rankData = await rankRes.json()
      const existingRankings = rankData.rankings || []

      const rankMap: Record<number, { rank: number | null; url?: string }> = {}
      for (const r of existingRankings) {
        if (r.rank_date === date) {
          rankMap[r.keyword_id] = { rank: r.rank_position, url: r.url }
        }
      }
      setEntries(prev => prev.map(e => ({
        ...e,
        rank_position: rankMap[e.keyword_id]?.rank?.toString() || e.rank_position,
        url: rankMap[e.keyword_id]?.url || e.url,
      })))
    } catch (e: any) {
      toast.error(e.message || '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  // 카테고리별 그룹핑
  const groupedEntries = entries.reduce((acc, entry, idx) => {
    if (!acc[entry.category]) acc[entry.category] = []
    acc[entry.category].push({ ...entry, _idx: idx })
    return acc
  }, {} as Record<string, (KeywordEntry & { _idx: number })[]>)

  // 날짜 포맷
  const dateObj = new Date(date + 'T00:00:00')
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()]

  if (user && user.role !== 'superadmin' && user.role !== 'agency_staff') return null

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FileEdit className="text-brand-400" size={24} />
          <h1 className="text-2xl font-bold text-white">순위 입력</h1>
        </div>
        <p className="text-sm text-slate-400">일별 순위를 입력하세요</p>
      </div>

      {/* 병원 + 날짜 선택 */}
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
              <SelectItem value="_none" disabled className="text-slate-500">병원 선택</SelectItem>
              {clinics.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">날짜</Label>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => changeDate(-1)} className="h-10 w-8">
              <ChevronLeft size={16} />
            </Button>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-[160px] bg-white/5 border-white/10 text-white text-center"
            />
            <Button variant="ghost" size="icon" onClick={() => changeDate(1)} className="h-10 w-8">
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
        <div className="mt-5">
          <span className="text-sm text-slate-400">({dayOfWeek})</span>
        </div>
      </div>

      {loading ? (
        <Card variant="glass" className="p-6">
          <Skeleton className="h-[200px] w-full" />
        </Card>
      ) : entries.length === 0 ? (
        <Card variant="glass" className="p-12 text-center">
          <p className="text-slate-500">{selectedClinicId ? '등록된 키워드가 없습니다.' : '병원을 선택해주세요.'}</p>
        </Card>
      ) : (
        <>
          {Object.entries(groupedEntries).map(([cat, items]) => (
            <Card key={cat} variant="glass" className="p-5 mb-4">
              <h3 className="text-sm font-semibold text-white mb-4">{CATEGORY_LABELS[cat] || cat}</h3>
              <div className="space-y-3">
                {/* 헤더 */}
                <div className="flex items-center gap-3 text-[10px] text-slate-600 uppercase tracking-wider flex-wrap">
                  <span className="min-w-[140px] shrink-0">키워드</span>
                  <span className="w-[50px] text-center">전일</span>
                  <span className="w-[90px] text-center">순위</span>
                  {cat === 'smartblock' && <span className="flex-1 min-w-[200px]">URL</span>}
                </div>
                {items.map((entry) => (
                  <div key={entry.keyword_id} className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-slate-300 min-w-[140px] shrink-0">{entry.keyword}</span>
                    <span className={`w-[50px] text-center text-xs font-medium ${
                      entry.prev_rank == null ? 'text-slate-700' :
                      entry.prev_rank <= 3 ? 'text-emerald-400' :
                      entry.prev_rank <= 10 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {entry.prev_rank ?? '-'}
                    </span>
                    <Input
                      type="number"
                      min="1"
                      value={entry.rank_position}
                      onChange={e => updateEntry(entry._idx, 'rank_position', e.target.value)}
                      placeholder="순위"
                      className="w-[90px] bg-white/5 border-white/10 text-white text-center"
                    />
                    {cat === 'smartblock' && (
                      <Input
                        type="text"
                        value={entry.url}
                        onChange={e => updateEntry(entry._idx, 'url', e.target.value)}
                        placeholder="URL"
                        className="flex-1 min-w-[200px] bg-white/5 border-white/10 text-white"
                      />
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}

          <div className="flex justify-end mt-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-brand-600 hover:bg-brand-700"
            >
              <Save size={16} />
              {saving ? '저장 중...' : '전체 저장'}
            </Button>
          </div>
        </>
      )}
    </>
  )
}

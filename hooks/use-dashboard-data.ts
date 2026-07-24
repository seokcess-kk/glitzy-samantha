'use client'

import { useState, useEffect, useCallback } from 'react'
import { normalizeChannel } from '@/lib/channel'

interface FetchState<T> {
  data: T | null
  loading: boolean
  error: boolean
}

function buildQs(params: Record<string, string | number | null | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') qs.set(k, String(v))
  }
  const str = qs.toString()
  return str ? `?${str}` : ''
}

// ─── KPI + 오늘 요약 ───
export function useKpiData(clinicId: number | null, startDate: string, endDate: string) {
  const [state, setState] = useState<FetchState<any>>({ data: null, loading: true, error: false })

  const fetch_ = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }))
    try {
      const qs = buildQs({ startDate, endDate, compare: 'true', clinic_id: clinicId })
      const res = await fetch(`/api/dashboard/kpi${qs}`)
      // 비-2xx 응답을 데이터로 저장하면 undefined 필드가 "0"으로 표시됨 → 에러로 구분
      if (!res.ok) { setState({ data: null, loading: false, error: true }); return }
      const json = await res.json()
      setState({ data: json, loading: false, error: false })
    } catch {
      setState({ data: null, loading: false, error: true })
    }
  }, [clinicId, startDate, endDate])

  useEffect(() => { fetch_() }, [fetch_])

  return { ...state, refetch: fetch_ }
}

// ─── 추이 ───
export function useTrendData(clinicId: number | null, startDate: string, endDate: string) {
  const [trend, setTrend] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      // 선택 기간과 최소 4주(28일) 중 긴 쪽 사용 (YYYY-MM-DD 형식 통일)
      const MIN_TREND_DAYS = 28
      const selectedStartDate = new Date(startDate)
      const minStartDate = new Date(Date.now() - MIN_TREND_DAYS * 86400000)
      const effectiveStart = selectedStartDate < minStartDate ? selectedStartDate : minStartDate
      const trendStart = effectiveStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
      const trendQs = buildQs({ startDate: trendStart, clinic_id: clinicId })

      const res = await fetch(`/api/dashboard/trend${trendQs}`)
      if (!res.ok) { setTrend([]); setError(true); return }
      const json = await res.json()
      const raw = Array.isArray(json) ? json : []
      setTrend(raw.map((r: any) => ({
        date: r.date || '',
        spend: r.spend || 0,
        leads: r.leads || 0,
      })))
      setError(false)
    } catch {
      setTrend([])
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [clinicId, startDate, endDate])

  useEffect(() => { fetch_() }, [fetch_])

  return { trend, loading, error, refetch: fetch_ }
}

// ─── 최근 리드 (DatePicker 무관, 항상 최신 8건) ───
export interface RecentLead {
  name: string
  utmSource: string
  createdAt: string
  phoneNumber: string
}

export function useRecentLeads(clinicId: number | null) {
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const qs = buildQs({ clinic_id: clinicId, limit: '8' })
      const res = await fetch(`/api/leads${qs}`)
      if (!res.ok) { setRecentLeads([]); setError(true); return }
      const json = await res.json()
      const customers = Array.isArray(json) ? json : []

      // customer → lead 변환 (최신순 정렬)
      const leads: RecentLead[] = []
      for (const c of customers) {
        const customerLeads = c.leads || []
        for (const l of customerLeads) {
          leads.push({
            name: c.name || '이름 없음',
            utmSource: normalizeChannel(l.utm_source),
            createdAt: l.created_at || c.created_at,
            phoneNumber: c.phone_number || '',
          })
        }
      }
      // 최신순 정렬, 최대 8건
      leads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setRecentLeads(leads.slice(0, 8))
      setError(false)
    } catch {
      setRecentLeads([])
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [clinicId])

  useEffect(() => { fetch_() }, [fetch_])

  return { recentLeads, loading, error, refetch: fetch_ }
}

// ─── 퍼널 + 채널 + 시술별 매출 ───
export function useFunnelChannelData(clinicId: number | null, startDate: string, endDate: string) {
  const [funnel, setFunnel] = useState<any>(null)
  const [channel, setChannel] = useState<any[]>([])
  const [treatmentData, setTreatmentData] = useState<{ name: string; amount: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const qs = buildQs({ startDate, endDate, clinic_id: clinicId })

      const [funnelRes, channelRes, treatmentRes] = await Promise.allSettled([
        fetch(`/api/dashboard/funnel${qs}`),
        fetch(`/api/dashboard/channel${qs}`),
        fetch(`/api/dashboard/treatment-revenue${qs}`),
      ])

      // 실패(네트워크/비-2xx)를 빈 배열로 뭉개지 않고 에러로 표면화
      let anyError = false

      if (funnelRes.status === 'fulfilled' && funnelRes.value.ok) setFunnel(await funnelRes.value.json())
      else anyError = true

      if (channelRes.status === 'fulfilled' && channelRes.value.ok) {
        const j = await channelRes.value.json()
        setChannel(Array.isArray(j) ? j : [])
      } else anyError = true

      // 시술별 매출 (payments 테이블 직접 조회 — KPI 매출과 동일 기준)
      if (treatmentRes.status === 'fulfilled' && treatmentRes.value.ok) {
        const j = await treatmentRes.value.json()
        setTreatmentData(Array.isArray(j) ? j : [])
      } else anyError = true

      setError(anyError)
    } finally {
      setLoading(false)
    }
  }, [clinicId, startDate, endDate])

  useEffect(() => { fetch_() }, [fetch_])

  return { funnel, channel, treatmentData, loading, error, refetch: fetch_ }
}

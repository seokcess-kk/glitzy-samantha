'use client'

import { useState, useEffect, useCallback } from 'react'

interface FetchState<T> {
  data: T | null
  loading: boolean
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
  const [state, setState] = useState<FetchState<any>>({ data: null, loading: true })

  const fetch_ = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }))
    try {
      const qs = buildQs({ startDate, endDate, compare: 'true', clinic_id: clinicId })
      const res = await fetch(`/api/dashboard/kpi${qs}`)
      const json = await res.json()
      setState({ data: json, loading: false })
    } catch {
      setState(prev => ({ ...prev, loading: false }))
    }
  }, [clinicId, startDate, endDate])

  useEffect(() => { fetch_() }, [fetch_])

  return { ...state, refetch: fetch_ }
}

// ─── 추이 + 콘텐츠 ───
export function useTrendData(clinicId: number | null, startDate: string, endDate: string) {
  const [trend, setTrend] = useState<any[]>([])
  const [contentPlatform, setContentPlatform] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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
      const contentQs = buildQs({ groupBy: 'platform', startDate, endDate, clinic_id: clinicId })

      const [trendRes, contentRes] = await Promise.allSettled([
        fetch(`/api/dashboard/trend${trendQs}`).then(r => r.json()),
        fetch(`/api/content/analytics${contentQs}`).then(r => r.json()),
      ])

      if (trendRes.status === 'fulfilled') {
        const raw = Array.isArray(trendRes.value) ? trendRes.value : []
        setTrend(raw.map((r: any) => ({
          date: r.date || '',
          spend: r.spend || 0,
          leads: r.leads || 0,
        })))
      }
      if (contentRes.status === 'fulfilled') {
        setContentPlatform(Array.isArray(contentRes.value) ? contentRes.value : [])
      }
    } finally {
      setLoading(false)
    }
  }, [clinicId, startDate, endDate])

  useEffect(() => { fetch_() }, [fetch_])

  return { trend, contentPlatform, loading, refetch: fetch_ }
}

// ─── 퍼널 + 채널 + 시술별 매출 ───
export function useFunnelChannelData(clinicId: number | null, startDate: string, endDate: string) {
  const [funnel, setFunnel] = useState<any>(null)
  const [channel, setChannel] = useState<any[]>([])
  const [treatmentData, setTreatmentData] = useState<{ name: string; amount: number }[]>([])
  const [loading, setLoading] = useState(true)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const qs = buildQs({ startDate, endDate, clinic_id: clinicId })
      const leadsQs = buildQs({ startDate, endDate, clinic_id: clinicId, limit: '200' })

      const [funnelRes, channelRes, leadsRes] = await Promise.allSettled([
        fetch(`/api/dashboard/funnel${qs}`).then(r => r.json()),
        fetch(`/api/dashboard/channel${qs}`).then(r => r.json()),
        fetch(`/api/leads${leadsQs}`).then(r => r.json()),
      ])

      if (funnelRes.status === 'fulfilled') setFunnel(funnelRes.value)
      if (channelRes.status === 'fulfilled') setChannel(Array.isArray(channelRes.value) ? channelRes.value : [])

      // 시술별 매출 집계 (매출액 기준)
      if (leadsRes.status === 'fulfilled') {
        const leads = Array.isArray(leadsRes.value) ? leadsRes.value : []
        const treatmentMap: Record<string, number> = {}
        for (const lead of leads) {
          const payments = lead.customer?.payments || []
          for (const p of payments) {
            if (p.treatment_name && p.payment_amount) {
              treatmentMap[p.treatment_name] = (treatmentMap[p.treatment_name] || 0) + Number(p.payment_amount)
            }
          }
        }
        setTreatmentData(
          Object.entries(treatmentMap)
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount)
        )
      }
    } finally {
      setLoading(false)
    }
  }, [clinicId, startDate, endDate])

  useEffect(() => { fetch_() }, [fetch_])

  return { funnel, channel, treatmentData, loading, refetch: fetch_ }
}

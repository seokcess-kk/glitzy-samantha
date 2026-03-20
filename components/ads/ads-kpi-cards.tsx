'use client'

import { useState, useEffect, useCallback } from 'react'
import { useClinic } from '@/components/ClinicContext'
import { StatsCard } from '@/components/common'
import { getKstDateString } from '@/lib/date'

interface KpiComparison {
  cpl: number
  roas: number
  totalLeads: number
  totalSpend: number
  cac: number
  cpc: number
  ctr: number
}

interface KpiData {
  totalSpend: number
  totalLeads: number
  cpl: number
  roas: number
  cac: number
  totalClicks: number
  totalImpressions: number
  cpc: number
  ctr: number
  payingCustomerCount: number
  comparison?: KpiComparison
}

interface Props {
  days: string
}

export default function AdsKpiCards({ days }: Props) {
  const { selectedClinicId } = useClinic()
  const [data, setData] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const endDate = getKstDateString()
      const startDate = getKstDateString(new Date(Date.now() - Number(days) * 86400000))
      const qs = new URLSearchParams({ compare: 'true', startDate, endDate })
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))

      const res = await fetch(`/api/dashboard/kpi?${qs}`)
      if (!res.ok) {
        setData(null)
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [days, selectedClinicId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalSpend = data?.totalSpend ?? 0
  const totalLeads = data?.totalLeads ?? 0
  const cpl = data?.cpl ?? 0
  const roas = data?.roas ?? 0
  const cpc = data?.cpc ?? 0
  const ctr = data?.ctr ?? 0
  const cac = data?.cac ?? 0
  const payingCustomerCount = data?.payingCustomerCount ?? 0
  const comparison = data?.comparison

  // 리드→결제 전환율: client-side 계산
  const conversionRate = totalLeads > 0 ? (payingCustomerCount / totalLeads) * 100 : 0

  // 일반 지표: 양수 변화 = isPositive true
  const normalTrend = (val: number | undefined): { value: number; isPositive: boolean } | undefined => {
    if (val === undefined || val === null) return undefined
    return { value: Math.abs(val), isPositive: val >= 0 }
  }

  // 역전 지표 (CPL, CPC, CAC): 음수 변화(감소) = 좋은 것 → isPositive true
  const invertedTrend = (val: number | undefined): { value: number; isPositive: boolean } | undefined => {
    if (val === undefined || val === null) return undefined
    return { value: Math.abs(val), isPositive: val <= 0 }
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
      <StatsCard
        label="총 광고비"
        value={loading ? '' : `₩${totalSpend.toLocaleString()}`}
        loading={loading}
        trend={normalTrend(comparison?.totalSpend)}
      />
      <StatsCard
        label="총 리드"
        value={loading ? '' : totalLeads.toLocaleString()}
        loading={loading}
        trend={normalTrend(comparison?.totalLeads)}
      />
      <StatsCard
        label="CPL"
        value={loading ? '' : `₩${cpl.toLocaleString()}`}
        loading={loading}
        trend={invertedTrend(comparison?.cpl)}
      />
      <StatsCard
        label="ROAS"
        value={loading ? '' : `${(roas * 100).toFixed(0)}%`}
        loading={loading}
        trend={normalTrend(comparison?.roas)}
      />
      <StatsCard
        label="CPC"
        value={loading ? '' : `₩${cpc.toLocaleString()}`}
        loading={loading}
        trend={invertedTrend(comparison?.cpc)}
      />
      <StatsCard
        label="CTR"
        value={loading ? '' : `${ctr.toFixed(2)}%`}
        loading={loading}
        trend={normalTrend(comparison?.ctr)}
      />
      <StatsCard
        label="리드→결제 전환율"
        value={loading ? '' : `${conversionRate.toFixed(1)}%`}
        loading={loading}
      />
      <StatsCard
        label="CAC"
        value={loading ? '' : `₩${cac.toLocaleString()}`}
        loading={loading}
        trend={invertedTrend(comparison?.cac)}
      />
    </div>
  )
}

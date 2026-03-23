'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useClinic } from '@/components/ClinicContext'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common'
import { TrendingDown } from 'lucide-react'

function fmtShort(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).replace(/\.$/, '')
}

interface AdStatsRecord {
  impressions: number
  clicks: number
  spend: number
}

interface FunnelStage {
  stage: string
  label: string
  count: number
  rate: number
  dropoff: number
}

interface FunnelData {
  stages: FunnelStage[]
  totalConversionRate: number
}

interface FunnelResponse {
  type: string
  funnel: FunnelData
}

interface FunnelStageDisplay {
  label: string
  count: number
  conversionRateFromPrev: number | null
  conversionLabel: string | null
}

interface Props {
  startDate: string
  endDate: string
}

const STAGE_GRADIENT = 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #a78bfa 100%)'

export default function AdsFunnel({ startDate, endDate }: Props) {
  const { selectedClinicId } = useClinic()

  const [adsLoading, setAdsLoading] = useState(true)
  const [funnelLoading, setFunnelLoading] = useState(true)
  const [impressions, setImpressions] = useState(0)
  const [clicks, setClicks] = useState(0)
  const [leadCount, setLeadCount] = useState(0)
  const [bookingCount, setBookingCount] = useState(0)
  const [paymentCount, setPaymentCount] = useState(0)
  const [hasData, setHasData] = useState(false)

  const loading = adsLoading || funnelLoading

  const fetchAdsStats = useCallback(async () => {
    setAdsLoading(true)
    try {
      const days = String(Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1))
      const qs = new URLSearchParams({ days })
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))

      const res = await fetch(`/api/ads/stats?${qs}`)
      if (!res.ok) return

      const json = await res.json()
      const records: AdStatsRecord[] = Array.isArray(json) ? json : []

      const totalImpressions = records.reduce((sum, r) => sum + (r.impressions || 0), 0)
      const totalClicks = records.reduce((sum, r) => sum + (r.clicks || 0), 0)

      setImpressions(totalImpressions)
      setClicks(totalClicks)
    } catch {
      // silently fail — empty state handles zero data
    } finally {
      setAdsLoading(false)
    }
  }, [startDate, endDate, selectedClinicId])

  const fetchFunnelData = useCallback(async () => {
    setFunnelLoading(true)
    try {
      const qs = new URLSearchParams({ groupBy: 'total', startDate, endDate })
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))

      const res = await fetch(`/api/dashboard/funnel?${qs}`)
      if (!res.ok) return

      const json: FunnelResponse = await res.json()
      const stages = json?.funnel?.stages ?? []

      const leadStage = stages.find(s => s.stage === 'Lead')
      const bookingStage = stages.find(s => s.stage === 'Booking')
      const paymentStage = stages.find(s => s.stage === 'Payment')

      setLeadCount(leadStage?.count ?? 0)
      setBookingCount(bookingStage?.count ?? 0)
      setPaymentCount(paymentStage?.count ?? 0)
    } catch {
      // silently fail
    } finally {
      setFunnelLoading(false)
    }
  }, [startDate, endDate, selectedClinicId])

  useEffect(() => {
    fetchAdsStats()
    fetchFunnelData()
  }, [fetchAdsStats, fetchFunnelData])

  // Determine if there's any real data once loading completes
  useEffect(() => {
    if (!loading) {
      setHasData(impressions > 0 || clicks > 0 || leadCount > 0 || bookingCount > 0 || paymentCount > 0)
    }
  }, [loading, impressions, clicks, leadCount, bookingCount, paymentCount])

  const stages = useMemo<FunnelStageDisplay[]>(() => {
    const raw = [
      { label: '노출', count: impressions },
      { label: '클릭', count: clicks },
      { label: '리드', count: leadCount },
      { label: '예약', count: bookingCount },
      { label: '결제', count: paymentCount },
    ]

    return raw.map((stage, idx) => {
      if (idx === 0) {
        return { ...stage, conversionRateFromPrev: null, conversionLabel: null }
      }
      const prev = raw[idx - 1]
      const labels = ['클릭률', '리드 전환율', '예약 전환율', '결제 전환율']
      const rate = prev.count > 0 ? (stage.count / prev.count) * 100 : 0
      return {
        ...stage,
        conversionRateFromPrev: rate,
        conversionLabel: labels[idx - 1],
      }
    })
  }, [impressions, clicks, leadCount, bookingCount, paymentCount])

  const maxCount = useMemo(() => Math.max(...stages.map(s => s.count), 1), [stages])

  // Find biggest dropoff (highest dropoff rate from previous stage)
  const biggestDropoff = useMemo(() => {
    let worstIdx = -1
    let worstRate = -1

    stages.forEach((stage, idx) => {
      if (idx === 0) return
      const dropoffRate = stage.conversionRateFromPrev !== null ? 100 - stage.conversionRateFromPrev : 0
      if (dropoffRate > worstRate) {
        worstRate = dropoffRate
        worstIdx = idx
      }
    })

    if (worstIdx < 1) return null
    return {
      from: stages[worstIdx - 1].label,
      to: stages[worstIdx].label,
      rate: worstRate,
    }
  }, [stages])

  return (
    <Card variant="glass" className="p-5 md:p-6">
      <div className="flex items-center justify-between mb-5 gap-4">
        <h2 className="font-semibold text-foreground shrink-0">광고 퍼널 분석</h2>
        <span className="text-xs text-muted-foreground">{fmtShort(startDate)} ~ {fmtShort(endDate)}</span>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-8 rounded-lg" style={{ width: `${90 - i * 12}%` }} />
            </div>
          ))}
        </div>
      ) : !hasData ? (
        <EmptyState
          icon={TrendingDown}
          title="퍼널 데이터가 없습니다"
          description="광고 통계 및 리드 데이터가 유입되면 퍼널 분석을 확인할 수 있습니다."
        />
      ) : (
        <div className="space-y-3">
          {stages.map((stage, idx) => {
            const barWidthPct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0

            return (
              <div key={stage.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{stage.label}</span>
                    {stage.conversionLabel && stage.conversionRateFromPrev !== null && (
                      <span className="text-muted-foreground">
                        {stage.conversionLabel}{' '}
                        <span className={stage.conversionRateFromPrev < 10 ? 'text-rose-500 dark:text-rose-400 font-semibold' : 'text-foreground/70 font-medium'}>
                          {stage.conversionRateFromPrev.toFixed(1)}%
                        </span>
                      </span>
                    )}
                  </div>
                  <span className="tabular-nums text-foreground/80 font-medium">
                    {stage.count.toLocaleString()}
                  </span>
                </div>
                <div className="h-8 bg-muted/40 dark:bg-white/[0.04] rounded-lg overflow-hidden">
                  <div
                    className="h-full rounded-lg transition-all duration-500"
                    style={{
                      width: `${barWidthPct}%`,
                      background: STAGE_GRADIENT,
                      opacity: 1 - idx * 0.12,
                    }}
                  />
                </div>
                {idx < stages.length - 1 && (
                  <div className="flex justify-start pl-1 pt-0.5">
                    <span className="text-[10px] text-muted-foreground/50">▼</span>
                  </div>
                )}
              </div>
            )
          })}

          {biggestDropoff && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300">
              💡 <span className="font-medium">{biggestDropoff.from}→{biggestDropoff.to}</span> 구간 이탈률이{' '}
              <span className="font-semibold">{biggestDropoff.rate.toFixed(1)}%</span>로 가장 높습니다
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

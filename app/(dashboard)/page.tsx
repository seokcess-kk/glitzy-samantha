'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { startOfDay } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/common'
import { useClinic } from '@/components/ClinicContext'
import { useKpiData, useTrendData, useFunnelChannelData } from '@/hooks/use-dashboard-data'

// 섹션 컴포넌트
import { TodaySummary } from '@/components/dashboard/today-summary'
import { KpiSection } from '@/components/dashboard/kpi-section'
import { SpendLeadTrend } from '@/components/dashboard/spend-lead-trend'
import { TreatmentPie } from '@/components/dashboard/treatment-pie'
import { FunnelSection } from '@/components/dashboard/funnel-section'
import { ChannelChart } from '@/components/dashboard/channel-chart'
import { CplRoasChart } from '@/components/dashboard/cpl-roas-chart'
import { DateRangePicker } from '@/components/dashboard/date-range-picker'

function toStartISO(date: Date): string {
  return startOfDay(date).toISOString()
}

function toEndISO(date: Date): string {
  const end = startOfDay(date)
  end.setHours(23, 59, 59, 999)
  return end.toISOString()
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const sessionUser = session?.user as any
  const { selectedClinicId } = useClinic()

  useEffect(() => {
    if (sessionUser?.role === 'clinic_staff') router.replace('/patients')
  }, [sessionUser, router])

  // 기본값: 당일
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = startOfDay(new Date())
    return { from: today, to: today }
  })
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const startDate = dateRange.from ? toStartISO(dateRange.from) : toStartISO(new Date())
  const endDate = dateRange.to ? toEndISO(dateRange.to) : toEndISO(new Date())

  // 섹션별 독립 데이터 페칭
  const kpi = useKpiData(selectedClinicId, startDate, endDate)
  const trendData = useTrendData(selectedClinicId, startDate, endDate)
  const funnelChannel = useFunnelChannelData(selectedClinicId, startDate, endDate)

  // 마지막 업데이트 시간 추적
  useEffect(() => {
    if (!kpi.loading) setLastUpdated(new Date())
  }, [kpi.loading])

  const handleRefresh = () => {
    kpi.refetch()
    trendData.refetch()
    funnelChannel.refetch()
  }

  const anyLoading = kpi.loading || trendData.loading || funnelChannel.loading
  const handleNavigate = (path: string) => router.push(path)

  // 기간 일수 계산 (표시용)
  const daysDiff = dateRange.from && dateRange.to
    ? Math.max(1, Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / (24 * 60 * 60 * 1000)) + 1)
    : 1
  const daysLabel = daysDiff === 1 ? '당일' : `${daysDiff}일`

  // CPL / ROAS 비교 데이터
  const cplData = [
    ...funnelChannel.channel.filter((c: any) => c.cpl > 0).map((c: any) => ({ name: c.channel, cpl: c.cpl })),
    ...trendData.contentPlatform.filter((c: any) => c.cpl > 0).map((c: any) => ({ name: c.label, cpl: c.cpl })),
  ]
  const roasData = [
    ...funnelChannel.channel.filter((c: any) => c.roas > 0).map((c: any) => ({ name: c.channel, roas: Math.round(c.roas * 100) })),
    ...trendData.contentPlatform.filter((c: any) => c.roas > 0).map((c: any) => ({ name: c.label, roas: c.roas })),
  ]

  return (
    <>
      {/* Header */}
      <PageHeader
        title="마케팅 성과 대시보드"
        description={lastUpdated ? `마지막 업데이트: ${lastUpdated.toLocaleTimeString('ko')}` : '데이터 로딩 중...'}
        actions={
          <div className="flex items-center gap-2">
            <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={anyLoading} className="text-slate-400 hover:text-white">
              <RefreshCw size={16} className={anyLoading ? 'animate-spin' : ''} />
            </Button>
          </div>
        }
      />

      {/* 오늘의 요약 (최상단 강조) */}
      <TodaySummary data={kpi.data?.today} loading={kpi.loading} />

      {/* KPI 카드 (비즈니스 흐름 순) */}
      <KpiSection data={kpi.data} loading={kpi.loading} onNavigate={handleNavigate} />

      {/* 광고비 · 리드 추이 + 시술별 매출 비중 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6 md:mb-8 items-stretch">
        <div className="lg:col-span-2 flex">
          <SpendLeadTrend data={trendData.trend} loading={trendData.loading} />
        </div>
        <div className="flex">
          <TreatmentPie data={funnelChannel.treatmentData} loading={funnelChannel.loading} />
        </div>
      </div>

      {/* 전환 퍼널 */}
      <div className="mb-6 md:mb-8">
        <FunnelSection data={funnelChannel.funnel} loading={funnelChannel.loading} />
      </div>

      {/* 채널별 리드 & 매출 (바차트) */}
      <div className="mb-6 md:mb-8">
        <ChannelChart data={funnelChannel.channel} loading={funnelChannel.loading} days={daysLabel} />
      </div>

      {/* CPL / ROAS 비교 차트 */}
      <CplRoasChart
        cplData={cplData}
        roasData={roasData}
        loading={funnelChannel.loading || trendData.loading}
      />
    </>
  )
}

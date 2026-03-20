'use client'

import AdsKpiCards from '@/components/ads/ads-kpi-cards'
import AdsFunnel from '@/components/ads/ads-funnel'
import EfficiencyTrendChart from '@/components/ads/efficiency-trend-chart'
import PlatformComparisonTable from '@/components/ads/platform-comparison-table'
import DayOfWeekAnalysis from '@/components/ads/day-of-week-analysis'
import LandingPagePerformance from '@/components/ads/landing-page-performance'

interface Props {
  days: string
}

export default function AdsOverviewTab({ days }: Props) {
  return (
    <>
      <AdsKpiCards days={days} />
      <div className="mb-6" />
      <EfficiencyTrendChart days={days} />
      <div className="mb-6" />
      <PlatformComparisonTable days={days} />
      <div className="mb-6" />
      <AdsFunnel days={days} />
      <div className="mb-6" />
      <div className="grid lg:grid-cols-2 gap-3">
        <DayOfWeekAnalysis days={days} />
        <LandingPagePerformance days={days} />
      </div>
    </>
  )
}

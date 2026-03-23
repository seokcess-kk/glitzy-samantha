'use client'

import { StatsCard } from '@/components/common'

interface KpiData {
  totalLeads?: number
  bookingRate?: number
  totalConsultations?: number
  totalRevenue?: number
  totalSpend?: number
  roas?: number
  comparison?: {
    totalLeads?: number
    bookingRate?: number
    totalConsultations?: number
    totalRevenue?: number
    totalSpend?: number
    roas?: number
  }
}

interface KpiSectionProps {
  data?: KpiData | null
  loading?: boolean
  onNavigate?: (path: string) => void
}

export function KpiSection({ data, loading, onNavigate }: KpiSectionProps) {
  const cards = data ? [
    {
      label: '총 문의',
      value: `${(data.totalLeads ?? 0).toLocaleString()}건`,
      trend: data.comparison?.totalLeads !== undefined && data.comparison.totalLeads !== 0
        ? { value: Math.abs(data.comparison.totalLeads), isPositive: data.comparison.totalLeads > 0 }
        : undefined,
      path: '/leads',
    },
    {
      label: '예약 전환율',
      value: `${data.bookingRate ?? 0}%`,
      trend: data.comparison?.bookingRate !== undefined && data.comparison.bookingRate !== 0
        ? { value: Math.abs(data.comparison.bookingRate), isPositive: data.comparison.bookingRate > 0 }
        : undefined,
      path: '/patients',
    },
    {
      label: '총 방문(상담)',
      value: `${(data.totalConsultations ?? 0).toLocaleString()}건`,
      trend: data.comparison?.totalConsultations !== undefined && data.comparison.totalConsultations !== 0
        ? { value: Math.abs(data.comparison.totalConsultations), isPositive: data.comparison.totalConsultations > 0 }
        : undefined,
      path: '/patients',
    },
    {
      label: '총 매출',
      value: `₩${(data.totalRevenue ?? 0).toLocaleString()}`,
      trend: data.comparison?.totalRevenue !== undefined && data.comparison.totalRevenue !== 0
        ? { value: Math.abs(data.comparison.totalRevenue), isPositive: data.comparison.totalRevenue > 0 }
        : undefined,
      path: '/patients',
    },
    {
      label: '광고비',
      value: `₩${(data.totalSpend ?? 0).toLocaleString()}`,
      trend: data.comparison?.totalSpend !== undefined && data.comparison.totalSpend !== 0
        ? { value: Math.abs(data.comparison.totalSpend), isPositive: data.comparison.totalSpend < 0 }
        : undefined,
      path: '/ads',
    },
    {
      label: 'ROAS',
      value: `${((data.roas ?? 0) * 100).toFixed(0)}%`,
      trend: data.comparison?.roas !== undefined && data.comparison.roas !== 0
        ? { value: Math.abs(data.comparison.roas), isPositive: data.comparison.roas > 0 }
        : undefined,
      path: '/ads',
    },
  ] : Array(6).fill(null).map((_, i) => ({
    label: ['총 문의', '예약 전환율', '총 방문(상담)', '총 매출', '광고비', 'ROAS'][i],
    value: '-',
    trend: undefined,
    path: '/',
  }))

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 md:mb-8">
      {cards.map((card) => (
        <StatsCard
          key={card.label}
          label={card.label}
          value={card.value}
          loading={loading}
          trend={card.trend}
          onClick={onNavigate ? () => onNavigate(card.path) : undefined}
        />
      ))}
    </div>
  )
}

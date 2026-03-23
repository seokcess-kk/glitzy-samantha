'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer,
} from '@/components/charts'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common'
import { getChannelColor } from '@/lib/channel-colors'
import { BarChart3, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const POSITIVE = '#34d399'
const NEGATIVE = '#fb7185'

interface CplItem {
  name: string
  cpl: number
}

interface RoasItem {
  name: string
  roas: number
}

interface CplRoasChartProps {
  cplData: CplItem[]
  roasData: RoasItem[]
  loading?: boolean
}

const CplTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      <span className="text-muted-foreground">{d.payload.name}: </span>
      <span className="text-foreground font-medium">₩{Number(d.value).toLocaleString()}</span>
    </div>
  )
}

const RoasTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      <span className="text-muted-foreground">{d.payload.name}: </span>
      <span className="text-foreground font-medium">{d.value}%</span>
    </div>
  )
}

export function CplRoasChart({ cplData, roasData, loading }: CplRoasChartProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 md:mb-8">
        <Card variant="glass" className="p-5"><Skeleton className="h-[280px] rounded-lg" /></Card>
        <Card variant="glass" className="p-5"><Skeleton className="h-[280px] rounded-lg" /></Card>
      </div>
    )
  }

  if (cplData.length === 0 && roasData.length === 0) return null

  // 두 차트 동일한 높이 사용 (더 많은 쪽 기준)
  const maxItems = Math.max(cplData.length, roasData.length, 3)
  const chartHeight = Math.min(360, maxItems * 44 + 20)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 md:mb-8">
      {/* CPL */}
      <Card variant="glass" className="p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-foreground">매체별 CPL</h2>
          <span className="text-xs text-muted-foreground">광고 + 콘텐츠</span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">DB 1건 획득 비용 (낮을수록 효율적)</p>
        {cplData.length > 0 ? (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart layout="vertical" data={cplData} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis type="number" tickFormatter={(v: number) => `₩${(v / 1000).toFixed(0)}k`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
              <Tooltip content={<CplTooltip />} />
              <Bar dataKey="cpl" radius={[0, 4, 4, 0]}>
                {cplData.map((entry, i) => (
                  <Cell key={i} fill={getChannelColor(entry.name)} fillOpacity={0.75} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center" style={{ height: chartHeight }}>
            <EmptyState icon={BarChart3} title="CPL 데이터 없음" description="광고 성과가 집계되면 표시됩니다." />
          </div>
        )}
      </Card>

      {/* ROAS */}
      <Card variant="glass" className="p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-foreground">매체별 ROAS</h2>
          <Link
            href="/ads"
            className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            광고 성과 상세 보기
            <ArrowRight size={12} />
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mb-4">예산 대비 매출 (100% 이상 = 흑자)</p>
        {roasData.length > 0 ? (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart layout="vertical" data={roasData} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis type="number" tickFormatter={(v: number) => `${v}%`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
              <Tooltip content={<RoasTooltip />} />
              <Bar dataKey="roas" radius={[0, 4, 4, 0]}>
                {roasData.map((entry, i) => (
                  <Cell key={i} fill={entry.roas >= 100 ? POSITIVE : NEGATIVE} fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center" style={{ height: chartHeight }}>
            <EmptyState icon={BarChart3} title="ROAS 데이터 없음" description="매출 데이터가 집계되면 표시됩니다." />
          </div>
        )}
      </Card>
    </div>
  )
}

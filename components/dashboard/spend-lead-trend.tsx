'use client'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from '@/components/charts'
import { TrendingUp } from 'lucide-react'

const BRAND = '#6366f1'
const LEAD_COLOR = '#34d399' // emerald-400

const fmtKrw = (v: number) => `₩${(v / 10000).toFixed(0)}만`

interface TrendDataItem {
  date: string
  spend: number
  leads: number
}

interface SpendLeadTrendProps {
  data?: TrendDataItem[]
  loading?: boolean
}

function DualTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900/95 border border-slate-700/50 rounded-lg p-3 text-xs shadow-xl backdrop-blur-sm">
      <p className="font-medium text-slate-300 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-slate-400">
          {p.name}:{' '}
          <span className="text-white font-medium">
            {p.dataKey === 'spend' ? fmtKrw(p.value) : `${p.value}건`}
          </span>
        </p>
      ))}
    </div>
  )
}

function DualChart({ data, height, fontSize, dotRadius, gradientId, showLegend }: {
  data: TrendDataItem[]
  height: number
  fontSize: number
  dotRadius: number
  gradientId: string
  showLegend?: boolean
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND} stopOpacity={0.2} />
            <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="spend" tickFormatter={fmtKrw} tick={{ fill: '#64748b', fontSize }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="leads" orientation="right" tick={{ fill: '#64748b', fontSize }} axisLine={false} tickLine={false} unit="건" />
        <Tooltip content={<DualTooltip />} />
        {showLegend && (
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingBottom: 8 }}
          />
        )}
        <Area yAxisId="spend" type="monotone" dataKey="spend" name="광고비" stroke={BRAND} fill={`url(#${gradientId})`} strokeWidth={2} />
        <Line yAxisId="leads" type="monotone" dataKey="leads" name="리드 수" stroke={LEAD_COLOR} strokeWidth={2} dot={{ r: dotRadius, fill: LEAD_COLOR }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function SpendLeadTrend({ data, loading }: SpendLeadTrendProps) {
  return (
    <Card variant="glass" className="p-5 w-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">광고비 · 리드 추이</h2>
        <span className="text-xs text-slate-500">최근 8주</span>
      </div>
      {loading ? (
        <Skeleton className="h-[200px] md:h-[240px] rounded-lg flex-1" />
      ) : data && data.length > 0 ? (
        <>
          <div className="hidden md:block">
            <DualChart data={data} height={240} fontSize={11} dotRadius={3} gradientId="spendGradDual" showLegend />
          </div>
          <div className="block md:hidden">
            <DualChart data={data} height={180} fontSize={10} dotRadius={2} gradientId="spendGradDualMobile" />
          </div>
        </>
      ) : (
        <div className="h-[200px] md:h-[240px] flex flex-col gap-2 items-center justify-center text-slate-500 text-sm">
          <TrendingUp size={28} className="text-slate-600 mb-1" />
          <span>진행 중인 광고 캠페인이 없습니다.</span>
        </div>
      )}
    </Card>
  )
}

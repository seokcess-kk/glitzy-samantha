'use client'

import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
  ResponsiveContainer,
} from '@/components/charts'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common'
import { getChannelColor } from '@/lib/channel-colors'
import { BarChart3, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface ChannelData {
  channel: string
  leads: number
  payingCustomers: number
  revenue: number
  spend: number
  cpl: number
  roas: number
  conversionRate: number
}

interface ChannelChartProps {
  data: ChannelData[]
  loading?: boolean
  days?: string
}

const BarTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2.5 text-xs shadow-xl backdrop-blur-sm">
      <p className="font-medium text-foreground mb-1.5">{d.channel}</p>
      <p className="text-muted-foreground">리드: <span className="text-foreground font-medium">{d.leads}건</span></p>
      <p className="text-muted-foreground">결제: <span className="text-foreground font-medium">{d.payingCustomers ?? 0}건</span></p>
      <p className="text-muted-foreground">결제액: <span className="text-foreground font-medium">₩{d.revenue?.toLocaleString()}</span></p>
      <p className="text-muted-foreground">광고비: <span className="text-foreground/80">₩{d.spend?.toLocaleString()}</span></p>
      <p className="text-muted-foreground">ROAS: <span className={d.roas >= 1 ? 'text-emerald-500 dark:text-emerald-400 font-medium' : 'text-rose-500 dark:text-rose-400'}>{d.roas > 0 ? `${(d.roas * 100).toFixed(0)}%` : '-'}</span></p>
    </div>
  )
}

export function ChannelChart({ data, loading, days = '30' }: ChannelChartProps) {
  return (
    <Card variant="glass" className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">채널별 리드 & 매출</h2>
        <span className="text-xs text-muted-foreground">{days}</span>
      </div>

      {loading ? (
        <Skeleton className="h-[240px] rounded-lg" />
      ) : data.length > 0 ? (
        <>
          {/* 수평 바차트 */}
          <ResponsiveContainer width="100%" height={Math.min(400, Math.max(180, data.length * 56 + 20))}>
            <BarChart layout="vertical" data={data} barGap={2} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="channel"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip content={<BarTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}
                iconType="square"
                iconSize={8}
              />
              <Bar dataKey="leads" name="리드" barSize={12} radius={[0, 4, 4, 0]}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={getChannelColor(entry.channel)} fillOpacity={0.85} />
                ))}
              </Bar>
              <Bar dataKey="payingCustomers" name="결제" barSize={12} radius={[0, 4, 4, 0]}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={getChannelColor(entry.channel)} fillOpacity={0.4} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-3 pt-3 border-t border-border dark:border-white/5">
            <Link
              href="/ads"
              className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
            >
              채널별 상세 보기
              <ArrowRight size={12} />
            </Link>
          </div>
        </>
      ) : (
        <EmptyState
          icon={BarChart3}
          title="채널 데이터 없음"
          description="광고 캠페인이 시작되면 채널별 성과가 표시됩니다."
        />
      )}
    </Card>
  )
}

'use client'

import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer,
} from '@/components/charts'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common'
import { PieChart as PieChartIcon } from 'lucide-react'

const PIE_SHADES = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff', '#8b5cf6']

interface TreatmentData {
  name: string
  amount: number  // 매출액 기준
}

interface TreatmentPieProps {
  data: TreatmentData[]
  loading?: boolean
}

const fmtKrw = (v: number) => `₩${(v / 10000).toFixed(0)}만`

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-slate-900/95 border border-slate-700/50 rounded-lg px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      <p className="text-slate-400">{d.name}: <span className="text-white font-medium">{fmtKrw(d.value)}</span></p>
    </div>
  )
}

export function TreatmentPie({ data, loading }: TreatmentPieProps) {
  const filtered = data.filter(d => d.amount > 0)
  const total = filtered.reduce((sum, d) => sum + d.amount, 0)

  return (
    <Card variant="glass" className="p-5 w-full flex flex-col">
      <h2 className="text-sm font-semibold text-white mb-4">시술별 매출 비중</h2>

      {loading ? (
        <Skeleton className="h-[200px] rounded-lg" />
      ) : filtered.length > 0 ? (
        <>
          <div className="relative">
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie
                  data={filtered}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={68}
                  paddingAngle={2}
                  dataKey="amount"
                  stroke="none"
                >
                  {filtered.map((_, i) => (
                    <Cell key={i} fill={PIE_SHADES[i % PIE_SHADES.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* 도넛 중앙 총 매출 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-[10px] text-slate-500">총 매출</p>
                <p className="text-sm font-bold text-white tabular-nums">{fmtKrw(total)}</p>
              </div>
            </div>
          </div>

          <ul className="space-y-1.5 mt-3">
            {filtered.map((d, i) => {
              const pct = total > 0 ? ((d.amount / total) * 100).toFixed(0) : '0'
              return (
                <li key={i} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: PIE_SHADES[i % PIE_SHADES.length] }}
                    />
                    <span className="text-slate-400 truncate">{d.name}</span>
                  </span>
                  <span className="font-semibold text-white tabular-nums shrink-0 ml-2">
                    {fmtKrw(d.amount)} ({pct}%)
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <EmptyState
          icon={PieChartIcon}
          title="결제 데이터 없음"
          description="결제가 발생하면 시술별 매출 비중이 표시됩니다."
        />
      )}
    </Card>
  )
}

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface StatsCardProps {
  label: string
  value: string | number
  loading?: boolean
  icon?: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
}

export function StatsCard({ label, value, loading, icon: Icon, trend }: StatsCardProps) {
  return (
    <Card variant="glass" className="p-4 md:p-5 animate-fade-in-up overflow-hidden">
      <p className="text-[11px] text-slate-400 font-medium mb-3 truncate">
        {label}
      </p>
      {loading ? (
        <Skeleton className="h-7 md:h-8 mb-2" />
      ) : (
        <p className="text-xl md:text-2xl font-bold text-white mb-1 truncate tabular-nums">
          {value}
        </p>
      )}
      {trend && !loading && (
        <div className={`inline-flex items-center gap-1 text-xs font-medium mt-1 px-1.5 py-0.5 rounded ${
          trend.isPositive
            ? 'text-emerald-400 bg-emerald-500/10'
            : 'text-rose-400 bg-rose-500/10'
        }`}>
          {trend.isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          <span className="tabular-nums">{Math.abs(trend.value)}%</span>
        </div>
      )}
    </Card>
  )
}

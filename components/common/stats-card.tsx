import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { LucideIcon } from 'lucide-react'

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
      <div className="flex items-start justify-between">
        <p className="text-[10px] md:text-xs text-slate-400 uppercase tracking-widest mb-1 truncate">
          {label}
        </p>
        {Icon && <Icon size={16} className="text-slate-500" />}
      </div>
      {loading ? (
        <Skeleton className="h-7 md:h-9 mt-2 mb-2 md:mb-3" />
      ) : (
        <p className="text-lg md:text-3xl font-bold text-white mt-2 mb-2 md:mb-3 truncate">
          {value}
        </p>
      )}
      {trend && !loading && (
        <p className={`text-xs ${trend.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend.isPositive ? '+' : ''}{trend.value}%
        </p>
      )}
    </Card>
  )
}

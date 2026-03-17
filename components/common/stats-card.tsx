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
  onClick?: () => void
  subtitle?: string
  subtitleColor?: 'default' | 'positive' | 'negative'
  size?: 'default' | 'lg'
}

export function StatsCard({ label, value, loading, icon: Icon, trend, onClick, subtitle, subtitleColor = 'default', size = 'default' }: StatsCardProps) {
  const isLg = size === 'lg'
  const clickable = !!onClick

  return (
    <Card
      variant="glass"
      className={`${isLg ? 'p-5 md:p-6' : 'p-4 md:p-5'} h-full animate-fade-in-up overflow-hidden ${
        clickable ? 'cursor-pointer hover:border-white/20 hover:bg-white/[0.03] transition-all' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <p className={`${isLg ? 'text-xs' : 'text-[11px]'} text-slate-400 font-medium truncate`}>
          {label}
        </p>
        {Icon && <Icon size={isLg ? 16 : 14} className="text-slate-500 shrink-0" />}
      </div>
      {loading ? (
        <Skeleton className={`${isLg ? 'h-9 md:h-10' : 'h-7 md:h-8'} mb-2`} />
      ) : (
        <p className={`${isLg ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'} font-bold text-white mb-1 truncate tabular-nums`}>
          {value}
        </p>
      )}
      {subtitle && !loading && (
        <p className={`text-[11px] truncate ${
          subtitleColor === 'positive' ? 'text-emerald-400' :
          subtitleColor === 'negative' ? 'text-rose-400' :
          'text-slate-500'
        }`}>{subtitle}</p>
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

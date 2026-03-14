import { LucideIcon, Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
}

export function EmptyState({ icon: Icon = Inbox, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon size={48} className="text-slate-600 mb-4" />
      <h3 className="text-lg font-medium text-slate-400 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 max-w-sm">{description}</p>
      )}
    </div>
  )
}

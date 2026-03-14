import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white">{title}</h1>
        {description && (
          <p className="text-sm text-slate-400 mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

import * as React from 'react'
import { cn } from '@/lib/utils'
import { STATUS } from '@/lib/format'

export function Badge({ className, children, ...props }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', className)}
      {...props}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status, className }) {
  const s = STATUS[status] ?? { label: status, tone: 'bg-muted text-muted-foreground border-border' }
  return <Badge className={cn(s.tone, className)}>{s.label}</Badge>
}

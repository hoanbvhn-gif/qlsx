import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export default function StatCard({ label, value, sub, icon: Icon, tone = 'text-primary' }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="num mt-1.5 truncate text-2xl font-bold tracking-tight">{value}</p>
          {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
        {Icon && (
          <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted', tone)}>
            <Icon className="size-5" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

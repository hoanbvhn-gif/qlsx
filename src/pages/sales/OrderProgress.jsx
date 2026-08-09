import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useOrders } from '@/hooks/useOrders'
import PageHeader from '@/components/common/PageHeader'
import OrderDetailDialog from '@/components/common/OrderDetailDialog'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { vnd, dmy, DEPT_OF_STATUS } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

const STEPS = [
  { key: 'sales',      label: 'Kinh doanh lập đơn', at: () => true },
  { key: 'accounting', label: 'Kế toán duyệt',      at: o => !!o.approved_at },
  { key: 'production', label: 'Sản xuất',           at: o => !!o.production_started_at },
  { key: 'done',       label: 'Hoàn thành',         at: o => !!o.completed_at || !!o.delivered_at }
]

export default function OrderProgress() {
  const { profile } = useAuth()
  const { orders, loading } = useOrders({ salesId: profile.id })
  const [sel, setSel] = useState(null)
  const live = orders.filter(o => o.status !== 'cancelled')

  return (
    <>
      <PageHeader title="Tiến độ đơn hàng" desc="Theo dõi đơn đang nằm ở bộ phận nào — cập nhật thời gian thực" />

      {loading ? <Skeleton className="h-64 w-full" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {live.map(o => (
            <Card key={o.id} className="cursor-pointer transition hover:shadow-md" onClick={() => setSel(o)}>
              <CardContent className="p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">#{o.order_code}</p>
                    <p className="truncate text-sm text-muted-foreground">{o.customer_name}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>

                <div className="mb-4 flex items-center">
                  {STEPS.map((s, i) => {
                    const done = s.at(o) && !['draft', 'rejected'].includes(o.status)
                    const active = DEPT_OF_STATUS[o.status]?.startsWith(
                      { sales: 'Kinh', accounting: 'Kế', production: 'Sản', done: 'Hoàn' }[s.key])
                    return (
                      <div key={s.key} className="flex flex-1 items-center last:flex-none">
                        <div className="flex flex-col items-center gap-1">
                          <div className={cn('flex size-7 items-center justify-center rounded-full border-2 text-[10px] font-bold',
                            done ? 'border-emerald-500 bg-emerald-500 text-white'
                              : active ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-muted text-muted-foreground')}>
                            {done ? <Check className="size-3.5" /> : i + 1}
                          </div>
                          <span className="w-16 text-center text-[10px] leading-tight text-muted-foreground">{s.label}</span>
                        </div>
                        {i < STEPS.length - 1 && (
                          <div className={cn('mx-1 -mt-4 h-0.5 flex-1', done ? 'bg-emerald-500' : 'bg-border')} />
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="grid grid-cols-3 gap-2 border-t pt-3 text-xs">
                  <I k="Tổng tiền" v={vnd(o.total_amount)} />
                  <I k="Còn nợ" v={vnd(o.debt_amount)} tone={o.debt_amount > 0 ? 'text-rose-600' : 'text-emerald-600'} />
                  <I k="Giao dự kiến" v={o.estimated_delivery_date ? dmy(o.estimated_delivery_date) : '--'} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <OrderDetailDialog order={sel} open={!!sel} onOpenChange={v => !v && setSel(null)} />
    </>
  )
}

const I = ({ k, v, tone = '' }) => (
  <div><p className="text-muted-foreground">{k}</p><p className={`num font-semibold ${tone}`}>{v}</p></div>
)

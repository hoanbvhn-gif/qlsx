import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useOrders } from '@/hooks/useOrders'
import PageHeader from '@/components/common/PageHeader'
import StatCard from '@/components/common/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { vnd, dmy } from '@/lib/format'
import { CheckSquare, Wallet, AlertCircle, Receipt } from 'lucide-react'

export default function AccountingDashboard() {
  const { orders, loading } = useOrders()

  const s = useMemo(() => {
    const live = orders.filter(o => !['draft', 'cancelled'].includes(o.status))
    return {
      pending: orders.filter(o => o.status === 'pending_accounting').length,
      revenue: live.reduce((a, o) => a + Number(o.total_amount), 0),
      collected: live.reduce((a, o) => a + Number(o.paid_amount), 0),
      debt: live.reduce((a, o) => a + Number(o.debt_amount), 0),
      unsettled: live.filter(o => Number(o.debt_amount) > 0).length
    }
  }, [orders])

  const queue = orders.filter(o => o.status === 'pending_accounting').slice(0, 8)

  return (
    <>
      <PageHeader title="Tổng quan Kế toán" desc="Duyệt đơn, theo dõi thu tiền và công nợ toàn công ty" />

      {loading ? <Skeleton className="h-28 w-full" /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Đơn chờ duyệt" value={s.pending} icon={CheckSquare} tone="text-amber-600" />
          <StatCard label="Tổng doanh thu" value={vnd(s.revenue)} icon={Receipt} />
          <StatCard label="Đã thu" value={vnd(s.collected)} icon={Wallet} tone="text-emerald-600" />
          <StatCard label="Công nợ phải thu" value={vnd(s.debt)} sub={`${s.unsettled} đơn chưa tất toán`} icon={AlertCircle} tone="text-rose-600" />
        </div>
      )}

      <Card className="mt-5">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Hàng đợi duyệt đơn</CardTitle>
          <Button size="sm" variant="outline" asChild><Link to="/ketoan/duyet-don">Xem tất cả</Link></Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {queue.map(o => (
            <div key={o.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">#{o.order_code} · {o.customer_name}</p>
                <p className="num text-xs text-muted-foreground">
                  {dmy(o.order_date)} · NVKD {o.sales?.full_name} · {vnd(o.total_amount)} đ
                </p>
              </div>
              <StatusBadge status={o.status} />
            </div>
          ))}
          {!queue.length && <p className="py-6 text-center text-sm text-muted-foreground">Không có đơn nào chờ duyệt</p>}
        </CardContent>
      </Card>
    </>
  )
}

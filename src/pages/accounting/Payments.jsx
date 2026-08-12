import { useState, useMemo, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useOrders } from '@/hooks/useOrders'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import PaymentDialog from '@/components/common/PaymentDialog'
import StatCard from '@/components/common/StatCard'
import ChoXacNhanBox from '@/components/common/ChoXacNhanBox'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge, Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { vnd, dmy } from '@/lib/format'
import { Wallet, CircleDollarSign, Search, Plus, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export default function Payments() {
  const { profile } = useAuth()
  const { orders, loading, reload } = useOrders({
    statuses: ['approved', 'in_production', 'completed', 'delivered', 'pending_accounting']
  })
  const [q, setQ] = useState('')
  const [onlyDebt, setOnlyDebt] = useState(true)
  const [target, setTarget] = useState(null)

  const rows = useMemo(() => orders.filter(o =>
    (!onlyDebt || Number(o.debt_amount) > 0) &&
    (!q || `${o.order_code} ${o.customer_name}`.toLowerCase().includes(q.toLowerCase()))
  ), [orders, q, onlyDebt])

  const tot = useMemo(() => ({
    amount: orders.reduce((a, o) => a + Number(o.total_amount), 0),
    paid: orders.reduce((a, o) => a + Number(o.paid_amount), 0),
    debt: orders.reduce((a, o) => a + Number(o.debt_amount), 0)
  }), [orders])

  return (
    <>
      <PageHeader title="Thu tiền & Công nợ" desc="Ghi nhận đặt cọc / thanh toán, hệ thống tự tính số dư còn nợ" />

      <ChoXacNhanBox onDone={reload} />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Tổng giá trị đơn" value={vnd(tot.amount)} icon={CircleDollarSign} />
        <StatCard label="Đã thu" value={vnd(tot.paid)} icon={Wallet} tone="text-emerald-600" />
        <StatCard label="Còn phải thu" value={vnd(tot.debt)} icon={Wallet} tone="text-rose-600" />
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Tìm mã đơn / khách hàng..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Button variant={onlyDebt ? 'default' : 'outline'} onClick={() => setOnlyDebt(v => !v)}>
          {onlyDebt ? 'Đang lọc: còn nợ' : 'Đang xem: tất cả'}
        </Button>
      </div>

      {loading ? <Skeleton className="h-64 w-full" />
        : !rows.length ? <EmptyState icon={CheckCircle2} title="Không có công nợ" desc="Tất cả đơn hàng đã tất toán." />
        : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã đơn</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead className="text-right">Tổng tiền</TableHead>
                <TableHead className="text-right">Đã thu</TableHead>
                <TableHead className="text-right">Còn nợ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono font-medium">{o.order_code}
                    <span className="ml-1 block text-xs font-sans text-muted-foreground">{dmy(o.order_date)}</span>
                  </TableCell>
                  <TableCell className="min-w-[170px]">{o.customer_name}</TableCell>
                  <TableCell className="num text-right font-medium">{vnd(o.total_amount)}</TableCell>
                  <TableCell className="num text-right text-emerald-600">{vnd(o.paid_amount)}</TableCell>
                  <TableCell className={`num text-right font-semibold ${Number(o.debt_amount) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {vnd(o.debt_amount)}
                  </TableCell>
                  <TableCell>
                    {o.is_settled
                      ? <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Đã tất toán</Badge>
                      : <StatusBadge status={o.status} />}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setTarget(o)}>
                      <Plus className="size-4" /> Ghi thu
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

      <PaymentDialog order={target} onClose={() => setTarget(null)} onDone={reload} userId={profile.id} />
    </>
  )
}

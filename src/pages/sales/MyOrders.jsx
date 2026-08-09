import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useOrders } from '@/hooks/useOrders'
import PageHeader from '@/components/common/PageHeader'
import OrderDetailDialog from '@/components/common/OrderDetailDialog'
import EmptyState from '@/components/common/EmptyState'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { vnd, dmy, STATUS } from '@/lib/format'
import { FilePlus2, Search, Send, Eye } from 'lucide-react'
import { toast } from 'sonner'

export default function MyOrders() {
  const { profile } = useAuth()
  const { orders, loading, reload } = useOrders({ salesId: profile.id })
  const [q, setQ] = useState('')
  const [st, setSt] = useState('')
  const [sel, setSel] = useState(null)

  const rows = useMemo(() => orders.filter(o =>
    (!st || o.status === st) &&
    (!q || `${o.order_code} ${o.customer_name}`.toLowerCase().includes(q.toLowerCase()))
  ), [orders, q, st])

  const submit = async (o) => {
    if (!o.design_file_path) return toast.error('Đơn chưa có file thiết kế Market, không thể gửi duyệt.')
    const { error } = await supabase.from('orders')
      .update({ status: 'pending_accounting', reject_reason: null }).eq('id', o.id)
    if (error) return toast.error(error.message)
    toast.success(`Đã gửi đơn ${o.order_code} sang Kế toán`)
    reload()
  }

  return (
    <>
      <PageHeader title="Đơn hàng của tôi" desc={`${rows.length} đơn hàng`}
        action={<Button asChild><Link to="/kinhdoanh/don-moi"><FilePlus2 className="size-4" /> Lập đơn mới</Link></Button>} />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Tìm theo mã đơn / tên khách hàng..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Select className="sm:w-56" value={st} onChange={e => setSt(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </div>

      {loading ? <Skeleton className="h-64 w-full" />
        : !rows.length ? <EmptyState title="Không có đơn hàng" desc="Bấm 'Lập đơn mới' để tạo đơn đầu tiên." />
        : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã đơn</TableHead>
                <TableHead>Ngày</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead className="text-right">Tổng tiền</TableHead>
                <TableHead className="text-right">Còn nợ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono font-medium">{o.order_code}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{dmy(o.order_date)}</TableCell>
                  <TableCell className="min-w-[180px]">{o.customer_name}</TableCell>
                  <TableCell className="num text-right font-medium">{vnd(o.total_amount)}</TableCell>
                  <TableCell className={`num text-right ${o.debt_amount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{vnd(o.debt_amount)}</TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setSel(o)}><Eye className="size-4" /></Button>
                      {['draft', 'rejected'].includes(o.status) && (
                        <Button size="sm" variant="outline" onClick={() => submit(o)}>
                          <Send className="size-4" /> Gửi duyệt
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

      <OrderDetailDialog order={sel} open={!!sel} onOpenChange={v => !v && setSel(null)} />
    </>
  )
}

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useOrders } from '@/hooks/useOrders'
import PageHeader from '@/components/common/PageHeader'
import OrderDetailDialog from '@/components/common/OrderDetailDialog'
import DesignLinksDialog from '@/components/common/DesignLinksDialog'
import EmptyState from '@/components/common/EmptyState'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { vnd, dmy, STATUS, payStatus } from '@/lib/format'
import { FilePlus2, Search, Send, Eye, FolderPlus } from 'lucide-react'
import { toast } from 'sonner'

export default function MyOrders() {
  const { profile } = useAuth()
  const { orders, loading, reload } = useOrders({ salesId: profile.id })
  const [q, setQ] = useState('')
  const [st, setSt] = useState('')
  const [sel, setSel] = useState(null)
  const [design, setDesign] = useState(null)
  const [confirm, setConfirm] = useState(null)   // don dang cho xac nhan gui

  const rows = useMemo(() => orders.filter(o =>
    (!st || o.status === st) &&
    (!q || `${o.order_code} ${o.customer_name}`.toLowerCase().includes(q.toLowerCase()))
  ), [orders, q, st])

  const submit = async (o) => {
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
                <TableHead className="min-w-[190px]">Thanh toán</TableHead>
                <TableHead>Tiến độ đơn</TableHead>
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
                  <TableCell><PayCell order={o} /></TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setSel(o)}><Eye className="size-4" /></Button>
                      {['draft', 'rejected'].includes(o.status) && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setDesign(o)}>
                            <FolderPlus className="size-4" /> Thiết kế
                          </Button>
                          <Button size="sm" onClick={() => setConfirm(o)}>
                            <Send className="size-4" /> Gửi duyệt
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

      <OrderDetailDialog order={sel} open={!!sel} onOpenChange={v => !v && setSel(null)} />

      {/* Xem lai toan bo don roi moi gui */}
      <OrderDetailDialog
        order={confirm} open={!!confirm} onOpenChange={v => !v && setConfirm(null)}
        footer={confirm && (
          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setConfirm(null)}>Quay lại sửa</Button>
            <Button onClick={async () => { const o = confirm; setConfirm(null); await submit(o) }}>
              <Send className="size-4" /> Xác nhận gửi Kế toán
            </Button>
          </div>
        )}
      />

      <DesignLinksDialog
        order={design} open={!!design}
        onOpenChange={v => !v && setDesign(null)}
        onSaved={reload}
      />
    </>
  )
}

/** O hien tinh trang thanh toan: nhan + thanh tien do + so tien con no */
function PayCell({ order }) {
  const p = payStatus(order)
  const last = (order.payments ?? [])
    .slice()
    .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))[0]
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Badge className={p.tone}>{p.label}</Badge>
        {p.debt > 0 && (
          <span className="num text-xs font-medium text-rose-600">còn {vnd(p.debt)}</span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all ${p.bar}`} style={{ width: `${p.pct}%` }} />
      </div>
      <p className="num text-[11px] text-muted-foreground">
        {p.paid > 0 ? `Đã thu ${vnd(p.paid)} / ${vnd(p.total)}` : `Tổng ${vnd(p.total)}`}
        {last ? ` · lần cuối ${dmy(last.payment_date)}` : ''}
      </p>
    </div>
  )
}

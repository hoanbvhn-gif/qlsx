import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useOrders } from '@/hooks/useOrders'
import PageHeader from '@/components/common/PageHeader'
import OrderDetailDialog from '@/components/common/OrderDetailDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { vnd, dmy, num } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Play, CheckCircle2, Truck, Calendar, Package, Eye, Loader2, GripVertical } from 'lucide-react'
import { toast } from 'sonner'

const COLUMNS = [
  { key: 'approved',      title: 'Chờ sản xuất',  tone: 'border-t-sky-400',     next: 'in_production', nextLabel: 'Bắt đầu SX', icon: Play },
  { key: 'in_production', title: 'Đang sản xuất', tone: 'border-t-indigo-400',  next: 'completed',     nextLabel: 'Hoàn thành',  icon: CheckCircle2 },
  { key: 'completed',     title: 'Hoàn thành SX', tone: 'border-t-emerald-400', next: 'delivered',     nextLabel: 'Đã giao hàng', icon: Truck },
  { key: 'delivered',     title: 'Đã giao hàng',  tone: 'border-t-teal-400',    next: null }
]

export default function KanbanBoard() {
  const { orders, loading, reload } = useOrders({
    statuses: ['approved', 'in_production', 'completed', 'delivered']
  })
  const [sel, setSel] = useState(null)
  const [eta, setEta] = useState(null)     // don dang hoi ngay giao du kien
  const [etaDate, setEtaDate] = useState('')
  const [busy, setBusy] = useState(null)
  const [dragId, setDragId] = useState(null)

  const byCol = useMemo(() => {
    const m = Object.fromEntries(COLUMNS.map(c => [c.key, []]))
    orders.forEach(o => m[o.status]?.push(o))
    return m
  }, [orders])

  const move = async (o, next) => {
    if (!next) return
    // Bat buoc co ngay giao du kien khi bat dau san xuat
    if (next === 'in_production' && !o.estimated_delivery_date) {
      setEta(o); setEtaDate(''); return
    }
    setBusy(o.id)
    const { error } = await supabase.from('orders').update({ status: next }).eq('id', o.id)
    setBusy(null)
    if (error) return toast.error(error.message)
    toast.success(`Đơn ${o.order_code} → ${COLUMNS.find(c => c.key === next)?.title ?? next}`)
    reload()
  }

  const startWithEta = async () => {
    if (!etaDate) return toast.error('Chọn ngày giao dự kiến.')
    const { error } = await supabase.from('orders')
      .update({ status: 'in_production', estimated_delivery_date: etaDate }).eq('id', eta.id)
    if (error) return toast.error(error.message)
    toast.success(`Đã đưa đơn ${eta.order_code} vào sản xuất`)
    setEta(null); reload()
  }

  const onDrop = (colKey) => (e) => {
    e.preventDefault()
    const o = orders.find(x => x.id === dragId)
    setDragId(null)
    if (!o || o.status === colKey) return
    const from = COLUMNS.findIndex(c => c.key === o.status)
    const to = COLUMNS.findIndex(c => c.key === colKey)
    if (to !== from + 1) return toast.error('Chỉ được chuyển sang bước kế tiếp.')
    move(o, colKey)
  }

  return (
    <>
      <PageHeader title="Bảng sản xuất" desc="Đơn hàng đã được Kế toán duyệt · kéo thả sang bước kế tiếp" />

      {loading ? <Skeleton className="h-96 w-full" /> : (
        <div className="grid gap-4 lg:grid-cols-4">
          {COLUMNS.map(col => (
            <div key={col.key}
              onDragOver={e => e.preventDefault()}
              onDrop={onDrop(col.key)}
              className={cn('rounded-xl border border-t-4 bg-background p-3', col.tone)}>
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold">{col.title}</h3>
                <Badge className="bg-muted text-muted-foreground">{byCol[col.key].length}</Badge>
              </div>

              <div className="space-y-3">
                {byCol[col.key].map(o => (
                  <Card key={o.id} draggable
                    onDragStart={() => setDragId(o.id)}
                    className="cursor-grab active:cursor-grabbing">
                    <CardContent className="space-y-2.5 p-3.5">
                      <div className="flex items-start gap-2">
                        <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-sm font-semibold">#{o.order_code}</p>
                          <p className="truncate text-xs text-muted-foreground">{o.customer_name}</p>
                        </div>
                      </div>

                      <div className="space-y-1 rounded-lg bg-muted/50 p-2 text-xs">
                        {(o.order_items ?? []).slice(0, 3).map(it => (
                          <div key={it.id} className="flex justify-between gap-2">
                            <span className="truncate">{it.item_name}</span>
                            <span className="num shrink-0 font-medium">{num(it.quantity, 0)} {it.unit}</span>
                          </div>
                        ))}
                        {(o.order_items?.length ?? 0) > 3 && (
                          <p className="text-muted-foreground">+{o.order_items.length - 3} mặt hàng khác</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Package className="size-3" /> {vnd(o.total_amount)} đ</span>
                        {o.estimated_delivery_date && (
                          <span className="flex items-center gap-1"><Calendar className="size-3" /> {dmy(o.estimated_delivery_date)}</span>
                        )}
                      </div>

                      <div className="flex gap-1.5">
                        <Button size="sm" variant="ghost" className="flex-1" onClick={() => setSel(o)}>
                          <Eye className="size-4" /> Chi tiết
                        </Button>
                        {col.next && (
                          <Button size="sm" className="flex-1" disabled={busy === o.id} onClick={() => move(o, col.next)}>
                            {busy === o.id ? <Loader2 className="size-4 animate-spin" /> : <col.icon className="size-4" />}
                            {col.nextLabel}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {!byCol[col.key].length && (
                  <p className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">Trống</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <OrderDetailDialog order={sel} open={!!sel} onOpenChange={v => !v && setSel(null)} />

      <Dialog open={!!eta} onOpenChange={v => !v && setEta(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ngày giao dự kiến · #{eta?.order_code}</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Chọn ngày hoàn thành dự kiến</Label>
            <Input type="date" value={etaDate} min={new Date().toISOString().slice(0, 10)}
              onChange={e => setEtaDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">Thông tin này hiển thị ngay cho Kinh doanh và Ban Giám đốc.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEta(null)}>Hủy</Button>
            <Button onClick={startWithEta}><Play className="size-4" /> Bắt đầu sản xuất</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

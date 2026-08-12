import { useState, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useOrders } from '@/hooks/useOrders'
import PageHeader from '@/components/common/PageHeader'
import OrderDetailDialog from '@/components/common/OrderDetailDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { vnd, dmy, num, loiTiengViet } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Play, CheckCircle2, Truck, Calendar, Package, Eye, Loader2, GripVertical,
  Ban, Undo2, AlertTriangle, XCircle
} from 'lucide-react'
import { toast } from 'sonner'

const COT_HUY = { key: 'cancelled', title: 'Đã hủy', tone: 'border-t-zinc-400', next: null }

const COLUMNS = [
  { key: 'approved',      title: 'Chờ sản xuất',  tone: 'border-t-sky-400',     next: 'in_production', nextLabel: 'Bắt đầu SX', icon: Play },
  { key: 'in_production', title: 'Đang sản xuất', tone: 'border-t-indigo-400',  next: 'completed',     nextLabel: 'Hoàn thành',  icon: CheckCircle2 },
  { key: 'completed',     title: 'Hoàn thành SX', tone: 'border-t-emerald-400', next: 'delivered',     nextLabel: 'Đã giao hàng', icon: Truck },
  { key: 'delivered',     title: 'Đã giao hàng',  tone: 'border-t-teal-400',    next: null }
]

export default function KanbanBoard() {
  const { profile } = useAuth()
  // San xuat chi cap nhat tien do. Huy don / tra lai la viec cua Ke toan va Ban Giam doc.
  const coQuyenHuy = ['accounting', 'management'].includes(profile?.role)

  const { orders, loading, reload } = useOrders({
    statuses: ['approved', 'in_production', 'completed', 'delivered', 'cancelled']
  })
  const [sel, setSel] = useState(null)
  const [eta, setEta] = useState(null)     // don dang hoi ngay giao du kien
  const [etaDate, setEtaDate] = useState('')
  const [busy, setBusy] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [huy, setHuy] = useState(null)          // don dang huy
  const [tra, setTra] = useState(null)          // don tra lai Kinh doanh
  const [lyDo, setLyDo] = useState('')

  const cot = useMemo(() => {
    const coDonHuy = orders.some(o => o.status === 'cancelled')
    return coDonHuy ? [...COLUMNS, COT_HUY] : COLUMNS
  }, [orders])

  const byCol = useMemo(() => {
    const m = Object.fromEntries([...COLUMNS, COT_HUY].map(c => [c.key, []]))
    orders.forEach(o => m[o.status]?.push(o))
    return m
  }, [orders])

  /** Huy don — don khong bien mat, chuyen sang cot Da huy de tra cuu */
  const huyDon = async () => {
    if (!lyDo.trim()) return toast.error('Bắt buộc ghi lý do hủy.')
    setBusy(huy.id)
    const { error } = await supabase.from('orders')
      .update({ status: 'cancelled', cancel_reason: lyDo.trim() }).eq('id', huy.id)
    setBusy(null)
    if (error) return toast.error(loiTiengViet(error))
    toast.success(`Đã hủy đơn ${huy.order_code}`)
    setHuy(null); setLyDo(''); reload()
  }

  /** Tra don ve Kinh doanh de sua roi gui lai */
  const traLai = async () => {
    if (!lyDo.trim()) return toast.error('Bắt buộc ghi lý do trả lại.')
    setBusy(tra.id)
    const { error } = await supabase.from('orders')
      .update({ status: 'rejected', reject_reason: lyDo.trim() }).eq('id', tra.id)
    setBusy(null)
    if (error) return toast.error(loiTiengViet(error))
    toast.success(`Đã trả đơn ${tra.order_code} về bộ phận Kinh doanh`)
    setTra(null); setLyDo(''); reload()
  }

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
    if (colKey === 'cancelled' || o.status === 'cancelled') return
    const from = COLUMNS.findIndex(c => c.key === o.status)
    const to = COLUMNS.findIndex(c => c.key === colKey)
    if (to !== from + 1) return toast.error('Chỉ được chuyển sang bước kế tiếp.')
    move(o, colKey)
  }

  return (
    <>
      <PageHeader title="Bảng sản xuất" desc="Đơn hàng đã được Kế toán duyệt · kéo thả sang bước kế tiếp" />

      {loading ? <Skeleton className="h-96 w-full" /> : (
        <div className={cn('grid gap-4', cot.length > 4 ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
          {cot.map(col => (
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
                  <Card key={o.id} draggable={o.status !== 'cancelled'}
                    onDragStart={() => setDragId(o.id)}
                    className={cn(o.status === 'cancelled'
                      ? 'opacity-60' : 'cursor-grab active:cursor-grabbing')}>
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

                      {coQuyenHuy && o.status !== 'cancelled' && o.status !== 'delivered' && (
                        <div className="flex gap-1.5 border-t pt-2">
                          <Button size="sm" variant="ghost" className="flex-1 text-xs text-muted-foreground"
                            onClick={() => { setTra(o); setLyDo('') }}>
                            <Undo2 className="size-3.5" /> Trả lại KD
                          </Button>
                          <Button size="sm" variant="ghost" className="flex-1 text-xs text-destructive"
                            onClick={() => { setHuy(o); setLyDo('') }}>
                            <Ban className="size-3.5" /> Hủy đơn
                          </Button>
                        </div>
                      )}

                      {o.status === 'cancelled' && o.cancel_reason && (
                        <p className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
                          <b>Lý do hủy:</b> {o.cancel_reason}
                        </p>
                      )}
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

      {/* ----- Huy don ----- */}
      <Dialog open={!!huy} onOpenChange={v => !v && setHuy(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="size-5" /> Hủy đơn #{huy?.order_code}
            </DialogTitle>
          </DialogHeader>

          {huy && (
            <div className="space-y-1 rounded-xl border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between"><span>Khách hàng</span><b className="truncate">{huy.customer_name}</b></div>
              <div className="flex justify-between"><span>Giá trị đơn</span><b className="num">{vnd(huy.total_amount)} đ</b></div>
              {Number(huy.paid_amount) > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Đã thu</span><b className="num">{vnd(huy.paid_amount)} đ</b>
                </div>
              )}
            </div>
          )}

          {Number(huy?.paid_amount) > 0 && (
            <p className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="size-4 shrink-0" />
              Đơn này <b>đã thu {vnd(huy.paid_amount)} đ</b>. Hủy đơn không tự hoàn tiền —
              nếu phải trả lại khách, Kế toán ghi một bút toán <b>Hoàn trả</b> ở màn Thu tiền.
            </p>
          )}

          <p className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
            Đơn không bị xóa, chuyển sang cột <b>Đã hủy</b> để tra cứu về sau.
            Doanh thu và công nợ tự loại đơn này ra.
          </p>

          <div className="space-y-1.5">
            <Label>Lý do hủy *</Label>
            <Textarea rows={3} value={lyDo} onChange={e => setLyDo(e.target.value)}
              placeholder="vd: Khách báo dừng đơn ngày 10/08, chưa vào sản xuất" />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHuy(null)}>Giữ lại</Button>
            <Button variant="destructive" onClick={huyDon} disabled={busy === huy?.id || !lyDo.trim()}>
              {busy === huy?.id ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
              Xác nhận hủy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----- Tra lai Kinh doanh ----- */}
      <Dialog open={!!tra} onOpenChange={v => !v && setTra(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="size-5" /> Trả đơn #{tra?.order_code} về Kinh doanh
            </DialogTitle>
          </DialogHeader>

          <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            Dùng khi duyệt nhầm hoặc đơn cần sửa. Đơn quay về bộ phận Kinh doanh ở trạng thái
            <b> Bị trả lại</b>, nhân viên sửa xong gửi duyệt lại. Đơn rời khỏi Bảng sản xuất
            cho tới khi được duyệt lại.
          </p>

          <div className="space-y-1.5">
            <Label>Lý do trả lại *</Label>
            <Textarea rows={3} value={lyDo} onChange={e => setLyDo(e.target.value)}
              placeholder="vd: Khách đổi kích thước từ 40x160 sang 50x200, cần sửa lại đơn" />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTra(null)}>Hủy bỏ</Button>
            <Button onClick={traLai} disabled={busy === tra?.id || !lyDo.trim()}>
              {busy === tra?.id ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
              Trả về Kinh doanh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

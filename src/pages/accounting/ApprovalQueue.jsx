import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useOrders } from '@/hooks/useOrders'
import PageHeader from '@/components/common/PageHeader'
import OrderDetailDialog from '@/components/common/OrderDetailDialog'
import EmptyState from '@/components/common/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { vnd, dmy, dmyhm } from '@/lib/format'
import { Check, X, Eye, Paperclip, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function ApprovalQueue() {
  const { orders, loading, reload } = useOrders({ statuses: ['pending_accounting'] })
  const [sel, setSel] = useState(null)
  const [rejectFor, setRejectFor] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(null)

  const approve = async (o) => {
    if (!o.design_file_path) return toast.error('Đơn thiếu file thiết kế Market — không đủ điều kiện duyệt.')
    setBusy(o.id)
    const { error } = await supabase.from('orders')
      .update({ status: 'approved', reject_reason: null }).eq('id', o.id)
    setBusy(null)
    if (error) return toast.error(error.message)
    toast.success(`Đã duyệt đơn ${o.order_code} → chuyển bộ phận Sản xuất`)
    reload()
  }

  const reject = async () => {
    if (!reason.trim()) return toast.error('Nhập lý do trả lại đơn.')
    const { error } = await supabase.from('orders')
      .update({ status: 'rejected', reject_reason: reason }).eq('id', rejectFor.id)
    if (error) return toast.error(error.message)
    toast.success('Đã trả đơn về bộ phận Kinh doanh')
    setRejectFor(null); setReason(''); reload()
  }

  return (
    <>
      <PageHeader title="Duyệt đơn hàng" desc={`${orders.length} đơn đang chờ kế toán kiểm tra`} />

      {loading ? <Skeleton className="h-64 w-full" />
        : !orders.length
          ? <EmptyState icon={CheckCircle2} title="Đã xử lý hết" desc="Không còn đơn hàng nào chờ duyệt." />
          : (
            <div className="grid gap-4 lg:grid-cols-2">
              {orders.map(o => (
                <Card key={o.id}>
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono font-semibold">#{o.order_code}</p>
                        <p className="truncate text-sm font-medium">{o.customer_name}</p>
                        <p className="text-xs text-muted-foreground">
                          MST {o.customer_tax_code || '--'} · {o.customer_phone || '--'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="num text-lg font-bold">{vnd(o.total_amount)}</p>
                        <p className="text-xs text-muted-foreground">đ (đã gồm VAT)</p>
                      </div>
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-3 text-xs sm:grid-cols-4">
                      <I k="Ngày lập" v={dmy(o.order_date)} />
                      <I k="NVKD" v={o.sales?.full_name ?? '--'} />
                      <I k="Số dòng hàng" v={o.order_items?.length ?? 0} />
                      <I k="Gửi lúc" v={dmyhm(o.submitted_at)} />
                    </div>

                    <div className={`mb-3 flex items-center gap-2 rounded-lg border p-2.5 text-xs ${
                      o.design_file_path ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                         : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                      <Paperclip className="size-4 shrink-0" />
                      <span className="truncate">
                        {o.design_file_path ? `File Market: ${o.design_file_name}` : 'CHƯA có file thiết kế Market'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSel(o)}>
                        <Eye className="size-4" /> Xem chi tiết
                      </Button>
                      <Button variant="success" size="sm" onClick={() => approve(o)}
                        disabled={busy === o.id || !o.design_file_path}>
                        {busy === o.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        Duyệt đơn
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive"
                        onClick={() => setRejectFor(o)}>
                        <X className="size-4" /> Trả lại
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

      <OrderDetailDialog
        order={sel} open={!!sel} onOpenChange={v => !v && setSel(null)}
        footer={sel && (
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => { setRejectFor(sel); setSel(null) }}>Trả lại</Button>
            <Button variant="success" disabled={!sel.design_file_path}
              onClick={() => { approve(sel); setSel(null) }}>
              <Check className="size-4" /> Duyệt & chuyển Sản xuất
            </Button>
          </div>
        )}
      />

      <Dialog open={!!rejectFor} onOpenChange={v => !v && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Trả lại đơn #{rejectFor?.order_code}</DialogTitle></DialogHeader>
          <Textarea rows={4} value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Lý do: sai đơn giá, thiếu MST, thiếu file thiết kế..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>Hủy</Button>
            <Button variant="destructive" onClick={reject}>Xác nhận trả lại</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

const I = ({ k, v }) => <div><p className="text-muted-foreground">{k}</p><p className="font-medium">{v}</p></div>

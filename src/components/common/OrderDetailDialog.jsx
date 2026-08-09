import { useState } from 'react'
import { supabase, DESIGN_BUCKET } from '@/lib/supabase'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { vnd, num, dmy, dmyhm, DEPT_OF_STATUS } from '@/lib/format'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function OrderDetailDialog({ order, open, onOpenChange, footer }) {
  const [busy, setBusy] = useState(false)
  if (!order) return null

  const openDesign = async () => {
    if (!order.design_file_path) return
    setBusy(true)
    const { data, error } = await supabase.storage
      .from(DESIGN_BUCKET)
      .createSignedUrl(order.design_file_path, 60 * 10)
    setBusy(false)
    if (error) return toast.error('Không mở được file: ' + error.message)
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Đơn hàng #{order.order_code}
            <StatusBadge status={order.status} />
          </DialogTitle>
          <DialogDescription>
            Ngày lập {dmy(order.order_date)} · NVKD {order.sales?.full_name ?? '--'} ·
            Đang ở bộ phận: <b>{DEPT_OF_STATUS[order.status]}</b>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-xl border bg-muted/30 p-4 text-sm sm:grid-cols-2">
          <Field k="Khách hàng" v={order.customer_name} />
          <Field k="Mã số thuế" v={order.customer_tax_code} />
          <Field k="Địa chỉ" v={order.customer_address} />
          <Field k="Điện thoại" v={order.customer_phone} />
          <Field k="Ngày giao dự kiến" v={order.estimated_delivery_date ? dmy(order.estimated_delivery_date) : 'Chưa có'} />
          <Field k="Duyệt lúc" v={order.approved_at ? dmyhm(order.approved_at) : 'Chưa duyệt'} />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã hàng</TableHead>
              <TableHead>Tên hàng hóa</TableHead>
              <TableHead className="text-right">SL</TableHead>
              <TableHead>ĐVT</TableHead>
              <TableHead className="text-right">Đơn giá</TableHead>
              <TableHead className="text-right">Thành tiền</TableHead>
              <TableHead className="text-right">VAT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(order.order_items ?? []).sort((a, b) => a.line_no - b.line_no).map(it => (
              <TableRow key={it.id}>
                <TableCell className="font-mono text-xs">{it.item_code || '--'}</TableCell>
                <TableCell className="min-w-[160px]">{it.item_name}</TableCell>
                <TableCell className="num text-right">{num(it.quantity, 3)}</TableCell>
                <TableCell>{it.unit}</TableCell>
                <TableCell className="num text-right">{vnd(it.unit_price)}</TableCell>
                <TableCell className="num text-right font-medium">{vnd(it.line_amount)}</TableCell>
                <TableCell className="num text-right text-muted-foreground">{it.vat_rate}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="ml-auto w-full space-y-1.5 text-sm sm:w-72">
          <Row k="Cộng tiền hàng" v={vnd(order.subtotal)} />
          <Row k="Tiền thuế GTGT" v={vnd(order.vat_amount)} />
          <Row k="Tổng thanh toán" v={vnd(order.total_amount)} bold />
          <Row k="Đã thu" v={vnd(order.paid_amount)} className="text-emerald-600" />
          <Row k="Còn nợ" v={vnd(order.debt_amount)} bold className={order.debt_amount > 0 ? 'text-rose-600' : 'text-emerald-600'} />
        </div>

        {order.note && <p className="rounded-lg bg-muted/50 p-3 text-sm"><b>Ghi chú:</b> {order.note}</p>}
        {order.reject_reason && order.status === 'rejected' && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <b>Lý do trả lại:</b> {order.reject_reason}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {order.design_file_path ? (
            <Button variant="outline" onClick={openDesign} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              File thiết kế: {order.design_file_name}
            </Button>
          ) : (
            <span className="text-sm text-rose-600">Chưa đính kèm file thiết kế Market</span>
          )}
        </div>

        {footer}
      </DialogContent>
    </Dialog>
  )
}

const Field = ({ k, v }) => (
  <div><p className="text-xs text-muted-foreground">{k}</p><p className="font-medium">{v || '--'}</p></div>
)
const Row = ({ k, v, bold, className = '' }) => (
  <div className={`flex justify-between ${bold ? 'font-semibold' : ''} ${className}`}>
    <span className={bold ? '' : 'text-muted-foreground'}>{k}</span><span className="num">{v}</span>
  </div>
)

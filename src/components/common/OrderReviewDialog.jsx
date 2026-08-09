import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { vnd, num } from '@/lib/format'
import { Send, ArrowLeft, Link2, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react'

/**
 * Buoc XEM LAI truoc khi gui Ke toan duyet.
 * Kinh doanh doc lai toan bo don, sai thi quay ve sua, dung moi gui.
 */
export default function OrderReviewDialog({
  open, onOpenChange, head, lines, files, totals, orderCode, onConfirm, busy
}) {
  const goodLines = lines.filter(l => l.item_name?.trim() && Number(l.quantity) > 0)
  const warns = []
  if (!head.customer_tax_code?.trim()) warns.push('Chưa có mã số thuế khách hàng — sẽ vướng khi xuất hóa đơn GTGT')
  if (!head.customer_phone?.trim())    warns.push('Chưa có số điện thoại khách hàng')
  if (goodLines.some(l => !Number(l.unit_price))) warns.push('Có dòng hàng đơn giá bằng 0')
  if (!files.length) warns.push('Chưa có file thiết kế Market')

  return (
    <Dialog open={open} onOpenChange={v => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kiểm tra lại đơn hàng trước khi gửi</DialogTitle>
          <DialogDescription>
            Đọc kỹ một lượt. Sau khi gửi, đơn chuyển sang Kế toán và bạn không sửa được nữa.
          </DialogDescription>
        </DialogHeader>

        {/* ---- Khach hang ---- */}
        <div className="grid gap-3 rounded-xl border bg-muted/30 p-4 text-sm sm:grid-cols-2">
          {orderCode && <F k="Mã đơn" v={orderCode} mono />}
          <F k="Ngày lập đơn" v={head.order_date?.split('-').reverse().join('/')} />
          <F k="Khách hàng" v={head.customer_name} strong />
          <F k="Mã khách hàng" v={head.customer_code} />
          <F k="Mã số thuế" v={head.customer_tax_code} />
          <F k="Điện thoại" v={head.customer_phone} />
          <div className="sm:col-span-2"><F k="Địa chỉ" v={head.customer_address} /></div>
        </div>

        {/* ---- Hang hoa ---- */}
        <div>
          <p className="mb-2 text-sm font-semibold">Chi tiết hàng hóa ({goodLines.length} dòng)</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã hàng</TableHead>
                <TableHead>Tên hàng hóa</TableHead>
                <TableHead className="text-right">SL</TableHead>
                <TableHead>ĐVT</TableHead>
                <TableHead className="text-right">Đơn giá</TableHead>
                <TableHead className="text-right">VAT</TableHead>
                <TableHead className="text-right">Thành tiền</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goodLines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{l.item_code || '--'}</TableCell>
                  <TableCell className="min-w-[160px]">{l.item_name}</TableCell>
                  <TableCell className="num text-right">{num(l.quantity, 3)}</TableCell>
                  <TableCell>{l.unit}</TableCell>
                  <TableCell className="num text-right">{vnd(l.unit_price)}</TableCell>
                  <TableCell className="num text-right text-muted-foreground">{l.vat_rate}%</TableCell>
                  <TableCell className="num text-right font-medium">
                    {vnd(Number(l.quantity) * Number(l.unit_price))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* ---- Tong ket ---- */}
        <div className="ml-auto w-full space-y-1.5 text-sm sm:w-72">
          <R k="Cộng tiền hàng" v={vnd(totals.sub)} />
          <R k="Tiền thuế GTGT" v={vnd(totals.vat)} />
          <div className="my-1 h-px bg-border" />
          <R k="Tổng thanh toán" v={vnd(totals.total) + ' đ'} bold />
        </div>

        {/* ---- Thiet ke ---- */}
        <div>
          <p className="mb-2 text-sm font-semibold">File thiết kế Market ({files.length})</p>
          {files.length ? (
            <div className="space-y-1.5">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
                  {f.source === 'upload'
                    ? <Upload className="size-4 shrink-0 text-emerald-600" />
                    : <Link2 className="size-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1 truncate">{f.file_name || `Thiết kế ${i + 1}`}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {f.source === 'upload' ? 'Tải lên' : 'Link'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-sm text-rose-700">
              Chưa có thiết kế nào
            </p>
          )}
        </div>

        {head.note && (
          <p className="rounded-lg bg-muted/50 p-3 text-sm"><b>Ghi chú:</b> {head.note}</p>
        )}

        {/* ---- Canh bao mem ---- */}
        {warns.length ? (
          <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <AlertTriangle className="size-4" /> Nên kiểm tra lại
            </p>
            <ul className="ml-5 list-disc space-y-0.5 text-xs text-amber-800">
              {warns.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
            <p className="text-xs text-amber-700">Đây chỉ là nhắc nhở, bạn vẫn gửi được.</p>
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="size-4" /> Thông tin đầy đủ, sẵn sàng gửi duyệt.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            <ArrowLeft className="size-4" /> Quay lại sửa
          </Button>
          <Button onClick={onConfirm} disabled={busy || !files.length}>
            <Send className="size-4" /> Xác nhận gửi Kế toán
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const F = ({ k, v, strong, mono }) => (
  <div>
    <p className="text-xs text-muted-foreground">{k}</p>
    <p className={`${strong ? 'font-semibold' : 'font-medium'} ${mono ? 'font-mono' : ''}`}>{v || '--'}</p>
  </div>
)
const R = ({ k, v, bold }) => (
  <div className={`flex justify-between ${bold ? 'text-base font-bold' : ''}`}>
    <span className={bold ? '' : 'text-muted-foreground'}>{k}</span><span className="num">{v}</span>
  </div>
)

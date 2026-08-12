import { useState } from 'react'
import { supabase, DESIGN_BUCKET } from '@/lib/supabase'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { vnd, num, dmy, dmyhm, DEPT_OF_STATUS, payStatus, PAYMENT_TYPE_LABEL } from '@/lib/format'
import { ExternalLink, FileWarning, Paperclip, Download, Loader2, Receipt, ImageOff, HandCoins, Clock, CheckCircle2 } from 'lucide-react'
import ChungTu from '@/components/common/ChungTu'

export default function OrderDetailDialog({ order, open, onOpenChange, footer }) {
  const [busyId, setBusyId] = useState(null)
  if (!order) return null

  // File tai len nam trong Storage -> phai xin link co han 10 phut moi tai duoc
  const openUpload = async (f) => {
    setBusyId(f.id)
    const { data, error } = await supabase.storage
      .from(DESIGN_BUCKET).createSignedUrl(f.storage_path, 600)
    setBusyId(null)
    if (error) return toast.error('Không mở được file: ' + error.message)
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  const pay = payStatus(order)
  const pays = order.payments ?? []
  const deposit = pays.filter(p => p.payment_type === 'deposit')
                      .reduce((a, p) => a + Number(p.amount), 0)
  const lastPay = [...pays].sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))[0]

  // uu tien danh sach order_files; neu don cu chi co 1 link thi dung link do
  const designs = (order.order_files?.length
    ? [...order.order_files].sort((a, b) => a.line_no - b.line_no)
    : order.design_file_path
      ? [{ id: 'legacy', file_name: order.design_file_name || 'Link thiết kế', file_url: order.design_file_path }]
      : [])

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
          <Field k="Đơn vị xuất hóa đơn" v={order.entity?.short_name ?? '--'} />
          <Field k="Khách hàng" v={order.customer_name} />
          <Field k="Mã số thuế" v={order.customer_tax_code} />
          <Field k="Địa chỉ" v={order.customer_address} />
          <Field k="Điện thoại" v={order.customer_phone} />
          <Field k="Ngày giao dự kiến" v={order.estimated_delivery_date ? dmy(order.estimated_delivery_date) : 'Chưa có'} />
          <Field k="Duyệt lúc" v={order.approved_at ? dmyhm(order.approved_at) : 'Chưa duyệt'} />
        </div>

        {/* ----- File thiet ke Market ----- */}
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Paperclip className="size-4" /> File thiết kế Market ({designs.length})
          </p>
          {designs.length ? (
            <div className="space-y-1.5">
              {designs.map(f => f.source === 'upload' ? (
                <button key={f.id} type="button" onClick={() => openUpload(f)}
                  className="flex w-full items-center gap-3 rounded-lg border p-2.5 text-left text-sm transition hover:bg-accent">
                  {busyId === f.id
                    ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                    : <Download className="size-4 shrink-0 text-emerald-600" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{f.file_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      File tải lên{f.file_size ? ` · ${(f.file_size / 1048576).toFixed(1)}MB` : ''}
                    </p>
                    {f.note && <p className="truncate text-xs text-muted-foreground">Ghi chú: {f.note}</p>}
                  </div>
                </button>
              ) : (
                <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border p-2.5 text-sm transition hover:bg-accent">
                  <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{f.file_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{f.file_url}</p>
                    {f.note && <p className="truncate text-xs text-muted-foreground">Ghi chú: {f.note}</p>}
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-sm text-rose-700">
              <FileWarning className="size-4 shrink-0" /> Chưa có link thiết kế Market
            </p>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Ảnh</TableHead>
              <TableHead>Mã hàng</TableHead>
              <TableHead>Tên hàng hóa</TableHead>
              <TableHead className="text-right">SL</TableHead>
              <TableHead>ĐVT</TableHead>
              <TableHead className="text-right">Đơn giá</TableHead>
              <TableHead className="text-right">Thành tiền</TableHead>
              <TableHead className="text-right">VAT</TableHead>
              <TableHead>Ngày giao</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(order.order_items ?? []).sort((a, b) => a.line_no - b.line_no).map(it => (
              <TableRow key={it.id}>
                <TableCell>
                  {it.image_url ? (
                    <a href={it.image_url} target="_blank" rel="noopener noreferrer">
                      <img src={it.image_url} alt={it.item_name}
                        className="size-11 rounded-lg border object-cover transition hover:brightness-90" />
                    </a>
                  ) : (
                    <div className="flex size-11 items-center justify-center rounded-lg border border-dashed">
                      <ImageOff className="size-4 text-muted-foreground/50" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{it.item_code || '--'}</TableCell>
                <TableCell className="min-w-[160px]">{it.item_name}</TableCell>
                <TableCell className="num text-right">{num(it.quantity, 3)}</TableCell>
                <TableCell>{it.unit}</TableCell>
                <TableCell className="num text-right">{vnd(it.unit_price)}</TableCell>
                <TableCell className="num text-right font-medium">{vnd(it.line_amount)}</TableCell>
                <TableCell className="num text-right text-muted-foreground">{it.vat_rate}%</TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {it.delivery_date
                    ? dmy(it.delivery_date)
                    : <span className="text-muted-foreground">theo đơn</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 rounded-xl border p-4 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Giá trị đơn hàng</p>
            <Row k="Cộng tiền hàng" v={vnd(order.subtotal)} />
            <Row k="Tiền thuế GTGT" v={vnd(order.vat_amount)} />
            <div className="my-1 h-px bg-border" />
            <Row k="Tổng thanh toán" v={vnd(order.total_amount)} bold />
          </div>

          <div className="space-y-2 rounded-xl border p-4 text-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Tình trạng thanh toán</p>
              <Badge className={pay.tone}>{pay.label}</Badge>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full transition-all ${pay.bar}`} style={{ width: `${pay.pct}%` }} />
            </div>
            <Row k="Đã thu" v={vnd(order.paid_amount)} className="text-emerald-600" />
            {deposit > 0 && <Row k="— trong đó đặt cọc" v={vnd(deposit)} className="text-muted-foreground" />}
            <Row k="Còn nợ" v={vnd(order.debt_amount)} bold
              className={order.debt_amount > 0 ? 'text-rose-600' : 'text-emerald-600'} />
            {lastPay && (
              <p className="pt-1 text-xs text-muted-foreground">
                Lần thu gần nhất: {dmy(lastPay.payment_date)} · {vnd(lastPay.amount)} đ
                {lastPay.method ? ` · ${lastPay.method}` : ''}
              </p>
            )}
            {!order.payments?.length && (
              <p className="pt-1 text-xs text-muted-foreground">Chưa phát sinh khoản thu nào.</p>
            )}
            {Number(order.pending_amount) > 0 && (
              <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                <Clock className="size-4 shrink-0" />
                Có <b className="num">{vnd(order.pending_amount)} đ</b> tiền về đã đối chiếu,
                <b> chờ Kế toán xác nhận</b> — chưa trừ vào công nợ.
              </p>
            )}
            {Number(order.deposit_expected) > 0 && !order.deposit_confirmed && (
              <p className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
                <HandCoins className="size-4 shrink-0" />
                Kinh doanh khai khách đã cọc <b className="num">{vnd(order.deposit_expected)} đ</b> —
                <b> chờ Kế toán xác nhận</b>, chưa vào sổ.
              </p>
            )}
          </div>
        </div>

        {/* ----- Lich su thu tien ----- */}
        {!!order.payments?.length && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Receipt className="size-4" /> Lịch sử thu tiền ({order.payments.length})
            </p>
            <div className="space-y-1.5">
              {[...order.payments]
                .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
                .map(p => (
                <div key={p.id} className={`flex items-start gap-3 rounded-lg border p-2.5 text-sm ${
                  p.confirmed === false ? 'border-amber-200 bg-amber-50/60' : ''}`}>
                  <ChungTu value={p.proof_path} size="sm" readOnly onChange={() => {}} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 font-medium">
                      {dmy(p.payment_date)} · {PAYMENT_TYPE_LABEL[p.payment_type] ?? p.payment_type}
                      {p.confirmed === false
                        ? <Badge className="border-amber-200 bg-amber-100 text-amber-800">
                            <Clock className="size-3" /> chờ Kế toán xác nhận
                          </Badge>
                        : <CheckCircle2 className="size-3.5 text-emerald-600" />}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.method, p.reference_no, p.transfer_note].filter(Boolean).join(' · ') || 'Không có chứng từ'}
                    </p>
                  </div>
                  <span className={`num shrink-0 font-semibold ${Number(p.amount) < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {vnd(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {order.note && <p className="rounded-lg bg-muted/50 p-3 text-sm"><b>Ghi chú:</b> {order.note}</p>}
        {order.reject_reason && order.status === 'rejected' && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <b>Lý do trả lại:</b> {order.reject_reason}
          </p>
        )}

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

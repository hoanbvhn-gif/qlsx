import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useOrders } from '@/hooks/useOrders'
import PageHeader from '@/components/common/PageHeader'
import OrderDetailDialog from '@/components/common/OrderDetailDialog'
import EntitySwitch from '@/components/common/EntitySwitch'
import ChungTu from '@/components/common/ChungTu'
import EmptyState from '@/components/common/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { vnd, dmy, dmyhm, loiTiengViet } from '@/lib/format'
import { Check, X, Eye, Paperclip, CheckCircle2, Loader2, HandCoins } from 'lucide-react'
import { toast } from 'sonner'

export default function ApprovalQueue() {
  const { orders, loading, reload } = useOrders({ statuses: ['pending_accounting'] })
  const [sel, setSel] = useState(null)
  const [rejectFor, setRejectFor] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(null)
  const [coc, setCoc] = useState(null)          // don dang xac nhan tien coc
  const [soTienCoc, setSoTienCoc] = useState('')
  const [cocMethod, setCocMethod] = useState('Chuyển khoản')
  const [cocRef, setCocRef] = useState('')
  const [cocProof, setCocProof] = useState('')

  /** Ke toan xac nhan da nhan tien coc -> tao but toan dat coc */
  const xacNhanCoc = async () => {
    const tien = Number(String(soTienCoc).replace(/[^\d]/g, ''))
    if (!tien) return toast.error('Nhập số tiền cọc đã nhận.')
    setBusy(coc.id)
    const { error } = await supabase.rpc('xac_nhan_tien_coc', {
      p_order_id: coc.id, p_amount: tien, p_method: cocMethod, p_ref: cocRef || null,
      p_proof: cocProof || null
    })
    setBusy(null)
    if (error) return toast.error(loiTiengViet(error))
    toast.success(`Đã ghi nhận cọc ${tien.toLocaleString('vi-VN')} đ vào sổ thu tiền`)
    setCoc(null); setSoTienCoc(''); setCocRef(''); reload()
  }

  const approve = async (o) => {
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
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono font-semibold">#{o.order_code}</p>
                          <EntitySwitch order={o} canEdit onChanged={reload} />
                        </div>
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
                      (o.order_files?.length || o.design_file_path)
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                      <Paperclip className="size-4 shrink-0" />
                      <span className="truncate">
                        {o.order_files?.length || o.design_file_path
                          ? `Thiết kế Market: ${o.order_files?.length || 1} file`
                          : 'Chưa có thiết kế Market — vẫn duyệt được, Kinh doanh bổ sung sau'}
                      </span>
                    </div>

                    {Number(o.deposit_expected) > 0 && !o.deposit_confirmed && (
                      <div className="mb-3 space-y-2 rounded-lg border border-sky-200 bg-sky-50 p-2.5">
                        <p className="flex items-center gap-2 text-xs text-sky-900">
                          <HandCoins className="size-4 shrink-0" />
                          Kinh doanh khai khách đã cọc <b className="num">{vnd(o.deposit_expected)} đ</b>
                          {o.deposit_note ? ` · ${o.deposit_note}` : ''}
                          {o.deposit_proof_path
                            ? <b className="text-emerald-700"> · có ảnh chuyển khoản</b>
                            : <b className="text-amber-800"> · chưa có ảnh</b>}
                        </p>
                        <Button size="sm" variant="outline" className="w-full"
                          onClick={() => { setCoc(o); setSoTienCoc(String(o.deposit_expected)); setCocRef(''); setCocProof(o.deposit_proof_path ?? '') }}>
                          <Check className="size-4" /> Xác nhận đã nhận tiền cọc
                        </Button>
                      </div>
                    )}
                    {o.deposit_confirmed && (
                      <p className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
                        <CheckCircle2 className="size-4 shrink-0" /> Đã xác nhận tiền cọc, đã vào sổ thu tiền
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSel(o)}>
                        <Eye className="size-4" /> Xem chi tiết
                      </Button>
                      <Button variant="success" size="sm" onClick={() => approve(o)}
                        disabled={busy === o.id}>
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
            <Button variant="success"
              onClick={() => { approve(sel); setSel(null) }}>
              <Check className="size-4" /> Duyệt & chuyển Sản xuất
            </Button>
          </div>
        )}
      />

      {/* ----- Xac nhan tien coc ----- */}
      <Dialog open={!!coc} onOpenChange={v => !v && setCoc(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HandCoins className="size-5" /> Xác nhận tiền cọc · #{coc?.order_code}
            </DialogTitle>
          </DialogHeader>

          {coc && (
            <div className="space-y-1 rounded-xl border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between"><span>Khách hàng</span><b className="truncate">{coc.customer_name}</b></div>
              <div className="flex justify-between"><span>Giá trị đơn</span><b className="num">{vnd(coc.total_amount)} đ</b></div>
              <div className="flex justify-between"><span>Kinh doanh khai</span>
                <b className="num text-sky-700">{vnd(coc.deposit_expected)} đ</b></div>
              {coc.deposit_note && (
                <div className="flex justify-between"><span>Hình thức</span><b>{coc.deposit_note}</b></div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Số tiền thực nhận *</Label>
            <Input inputMode="decimal" value={soTienCoc} onChange={e => setSoTienCoc(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Sửa lại nếu số thực nhận khác con số Kinh doanh khai.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Hình thức</Label>
              <Select value={cocMethod} onChange={e => setCocMethod(e.target.value)}>
                {['Chuyển khoản', 'Tiền mặt', 'Bù trừ công nợ', 'Séc'].map(m => <option key={m}>{m}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Số chứng từ</Label>
              <Input value={cocRef} onChange={e => setCocRef(e.target.value)} placeholder="UNC..." />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Chứng từ chuyển khoản</Label>
            <div className="flex items-center gap-3 rounded-lg border p-2.5">
              <ChungTu value={cocProof} onChange={setCocProof} />
              <p className="text-xs text-muted-foreground">
                {cocProof
                  ? 'Ảnh Kinh doanh đính kèm — mở ra đối chiếu với sao kê trước khi xác nhận'
                  : 'Kinh doanh chưa đính ảnh. Bạn có thể tự đính nếu đã nhận được chứng từ.'}
              </p>
            </div>
          </div>

          <p className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
            Xác nhận xong hệ thống tạo một bút toán <b>Đặt cọc</b> trong Sổ thu tiền,
            công nợ của đơn tự trừ đi.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCoc(null)}>Để sau</Button>
            <Button variant="success" onClick={xacNhanCoc} disabled={busy === coc?.id}>
              {busy === coc?.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Ghi vào sổ thu tiền
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

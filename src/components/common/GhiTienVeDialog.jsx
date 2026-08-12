import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import BankTxnPicker from '@/components/common/BankTxnPicker'
import { vnd, dmy, parseNum, loiTiengViet, PAYMENT_TYPE_LABEL } from '@/lib/format'
import { Loader2, Landmark, Clock, CheckCircle2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

/**
 * KINH DOANH GHI NHAN TIEN VE cho don cua chinh minh.
 *
 * Khac hop thoai cua Ke toan o cho:
 *   - Bat buoc chon khoan tien tu bang ke ngan hang (khong khai khong duoc)
 *   - Ghi xong o trang thai CHO KE TOAN XAC NHAN, chua tru vao cong no
 *   - Ghi nham thi tu go lai duoc, mien la Ke toan chua xac nhan
 */
export default function GhiTienVeDialog({ order, open, onOpenChange, onDone, userId }) {
  const [txn, setTxn] = useState(null)
  const [soTien, setSoTien] = useState('')
  const [dienGiai, setDienGiai] = useState('')
  const [busy, setBusy] = useState(false)
  const [lichSu, setLichSu] = useState([])

  const taiLichSu = () => {
    if (!order) return
    supabase.from('payments')
      .select('id, amount, payment_date, payment_type, method, reference_no, transfer_note, confirmed, created_by')
      .eq('order_id', order.id).order('payment_date', { ascending: false })
      .then(({ data }) => setLichSu(data ?? []))
  }

  useEffect(() => {
    if (!open) return
    setTxn(null); setSoTien(''); setDienGiai(''); taiLichSu()
  }, [open, order?.id])

  if (!order) return null

  const conNo = Number(order.debt_amount ?? 0)
  const choDuyet = lichSu.filter(p => !p.confirmed)
  const tongCho = choDuyet.reduce((a, p) => a + Number(p.amount), 0)
  const amt = parseNum(soTien)
  const conLaiCuaKhoan = txn ? Number(txn.con_lai ?? txn.amount_in) : 0
  const conNoSau = conNo - amt

  const chon = (r) => {
    setTxn(r)
    const dung = Math.min(Number(r.con_lai ?? r.amount_in), conNo > 0 ? conNo : Number(r.con_lai ?? r.amount_in))
    setSoTien(String(Math.round(dung)))
  }

  const luu = async () => {
    if (!txn) return toast.error('Chọn khoản tiền khách đã chuyển trong bảng kê.')
    if (!amt || amt <= 0) return toast.error('Nhập số tiền ghi cho đơn này.')
    if (amt > conLaiCuaKhoan + 0.01) {
      return toast.error(`Khoản này chỉ còn ${vnd(conLaiCuaKhoan)} đ chưa phân bổ.`)
    }

    setBusy(true)
    const { error } = await supabase.from('payments').insert({
      order_id: order.id,
      payment_type: Number(order.paid_amount) > 0 ? (conNoSau > 0 ? 'partial' : 'final') : 'deposit',
      amount: amt,
      payment_date: txn.posting_date,
      method: 'Chuyển khoản',
      reference_no: txn.bank_ref,
      transfer_note: txn.content ?? null,
      bank_account: txn.account_no ? `${txn.bank_name ?? ''} ${txn.account_no}`.trim() : null,
      note: dienGiai || null,
      bank_txn_id: txn.id,
      created_by: userId
    })
    setBusy(false)
    if (error) return toast.error(loiTiengViet(error))

    toast.success('Đã gửi Kế toán xác nhận. Công nợ cập nhật khi Kế toán duyệt.')
    setTxn(null); setSoTien(''); setDienGiai('')
    taiLichSu(); onDone?.()
  }

  const go = async (p) => {
    const { error } = await supabase.from('payments').delete().eq('id', p.id)
    if (error) return toast.error(loiTiengViet(error))
    toast.success('Đã gỡ khoản ghi nhầm.')
    taiLichSu(); onDone?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ghi nhận tiền về · #{order.order_code}</DialogTitle>
          <DialogDescription>{order.customer_name}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/50 p-3 text-center text-sm">
          <O k="Tổng tiền" v={vnd(order.total_amount)} />
          <O k="Đã thu" v={vnd(order.paid_amount)} tone="text-emerald-600" />
          <O k="Còn nợ" v={vnd(conNo)} tone="text-rose-600" />
        </div>

        {tongCho > 0 && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            <Clock className="mt-0.5 size-4 shrink-0" />
            <span>
              Đang có <b className="num">{vnd(tongCho)} đ</b> chờ Kế toán xác nhận.
              Số này chưa trừ vào công nợ ở trên.
            </span>
          </p>
        )}

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Landmark className="size-4" /> Khoản khách đã chuyển
          </Label>
          <BankTxnPicker order={order} value={txn} soTienGhi={amt}
            onPick={chon} onClear={() => { setTxn(null); setSoTien('') }} />
          <p className="text-xs text-muted-foreground">
            Gõ ngày <b>12/08</b>, số tiền <b>2510000</b> hoặc tên khách để tìm.
            Khách trả nhiều lần thì mỗi lần chọn một khoản.
          </p>
        </div>

        {txn && (
          <>
            <div className="space-y-1.5">
              <Label>Ghi cho đơn này bao nhiêu</Label>
              <Input inputMode="decimal" value={soTien} onChange={e => setSoTien(e.target.value)} />
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Button type="button" size="sm" variant="secondary"
                  onClick={() => setSoTien(String(Math.round(conLaiCuaKhoan)))}>
                  Cả khoản {vnd(conLaiCuaKhoan)}
                </Button>
                {conNo > 0 && conNo < conLaiCuaKhoan && (
                  <Button type="button" size="sm" variant="secondary"
                    onClick={() => setSoTien(String(Math.round(conNo)))}>
                    Vừa hết nợ {vnd(conNo)}
                  </Button>
                )}
              </div>
              {!!amt && (
                <p className="num pt-1 text-xs text-muted-foreground">
                  Còn nợ sau khi Kế toán duyệt:{' '}
                  <b className={conNoSau > 0 ? 'text-rose-600' : 'text-emerald-600'}>{vnd(conNoSau)} đ</b>
                  {amt < conLaiCuaKhoan && (
                    <> · khoản chuyển còn dư <b>{vnd(conLaiCuaKhoan - amt)} đ</b> dùng cho đơn khác</>
                  )}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Diễn giải cho Kế toán</Label>
              <Textarea rows={2} value={dienGiai} onChange={e => setDienGiai(e.target.value)}
                placeholder="vd: khách chuyển gộp 2 đơn, đơn này lấy 3 triệu" />
            </div>
          </>
        )}

        {!!lichSu.length && (
          <div className="rounded-xl border p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Các lần thu của đơn ({lichSu.length})
            </p>
            <div className="space-y-1.5">
              {lichSu.map(p => (
                <div key={p.id} className="flex items-start gap-2 text-sm">
                  {p.confirmed
                    ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    : <Clock className="mt-0.5 size-4 shrink-0 text-amber-500" />}
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className="text-muted-foreground">{dmy(p.payment_date)}</span>
                      <span>{PAYMENT_TYPE_LABEL[p.payment_type] ?? p.payment_type}</span>
                      {!p.confirmed && (
                        <Badge className="border-amber-200 bg-amber-50 text-amber-700">chờ Kế toán</Badge>
                      )}
                    </p>
                    {(p.reference_no || p.transfer_note) && (
                      <p className="truncate text-xs text-muted-foreground">
                        {[p.reference_no, p.transfer_note].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <span className="num shrink-0 font-medium">{vnd(p.amount)}</span>
                  {!p.confirmed && p.created_by === userId && (
                    <button type="button" onClick={() => go(p)} title="Gỡ khoản ghi nhầm"
                      className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
          <Button onClick={luu} disabled={busy || !txn}>
            {busy && <Loader2 className="size-4 animate-spin" />} Gửi Kế toán xác nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const O = ({ k, v, tone = '' }) => (
  <div><p className="text-xs text-muted-foreground">{k}</p><p className={`num font-semibold ${tone}`}>{v}</p></div>
)

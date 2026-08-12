import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import BankTxnPicker from '@/components/common/BankTxnPicker'
import { vnd, dmy, parseNum, loiTiengViet } from '@/lib/format'
import { Loader2, Landmark } from 'lucide-react'
import ChungTu from '@/components/common/ChungTu'
import { toast } from 'sonner'

export const TYPES = [
  { v: 'deposit', l: 'Đặt cọc' },
  { v: 'partial', l: 'Thanh toán từng phần' },
  { v: 'final',   l: 'Thanh toán nốt' },
  { v: 'refund',  l: 'Hoàn trả (ghi âm)' }
]
export const METHODS = ['Chuyển khoản', 'Tiền mặt', 'Bù trừ công nợ', 'Séc']

/**
 * Hop thoai GHI NHAN THU TIEN — dat coc, thanh toan tung phan, thanh toan not.
 * Dung chung o man "Thu tien & cong no" va "Cong no khach hang".
 */
export default function PaymentDialog({ order, onClose, onDone, userId }) {
  const [history, setHistory] = useState([])
  const [form, setForm] = useState({
    payment_type: 'deposit', amount: '', payment_date: new Date().toISOString().slice(0, 10),
    method: 'Chuyển khoản', reference_no: '', bank_account: '', transfer_note: '', note: '',
    proof_path: ''
  })
  const [busy, setBusy] = useState(false)
  const [bankTxn, setBankTxn] = useState(null)   // khoan tien ve duoc chon tu bang ke

  useEffect(() => {
    if (!order) return
    setForm(f => ({
      ...f, amount: '', reference_no: '', transfer_note: '', note: '', proof_path: '',
      payment_type: Number(order.paid_amount) > 0 ? 'final' : 'deposit'
    }))
    supabase.from('payments').select('*').eq('order_id', order.id)
      .order('payment_date', { ascending: false })
      .then(({ data }) => setHistory(data ?? []))
  }, [order])

  if (!order) return null
  const amt = parseNum(form.amount)
  const after = Number(order.debt_amount) - (form.payment_type === 'refund' ? -amt : amt)

  /** Chon mot khoan tien ve -> tu dien so tien, ngay, chung tu, noi dung CK */
  const chonKhoanTienVe = (r) => {
    setBankTxn(r)
    setForm(f => ({
      ...f,
      amount: String(Math.round(Math.min(
        Number(r.con_lai ?? r.amount_in),
        Number(order.debt_amount) > 0 ? Number(order.debt_amount) : Number(r.con_lai ?? r.amount_in)
      ))),
      payment_date: r.posting_date,
      method: 'Chuyển khoản',
      reference_no: r.bank_ref,
      transfer_note: r.content ?? '',
      bank_account: r.account_no ? `${r.bank_name ?? ''} ${r.account_no}`.trim() : f.bank_account
    }))
  }

  const save = async () => {
    if (!amt) return toast.error('Nhập số tiền.')
    setBusy(true)
    const { error } = await supabase.from('payments').insert({
      order_id: order.id,
      payment_type: form.payment_type,
      amount: form.payment_type === 'refund' ? -Math.abs(amt) : Math.abs(amt),
      payment_date: form.payment_date,
      method: form.method,
      reference_no: form.reference_no || null,
      bank_account: form.bank_account || null,
      transfer_note: form.transfer_note || null,
      note: form.note || null,
      proof_path: form.proof_path || null,
      bank_txn_id: bankTxn?.id ?? null,
      created_by: userId
    })
    setBusy(false)
    if (error) return toast.error(loiTiengViet(error))
    toast.success('Đã ghi nhận khoản thu. Công nợ được tính lại tự động.')
    onDone(); onClose()
  }

  return (
    <Dialog open={!!order} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ghi nhận thanh toán · #{order.order_code}</DialogTitle>
          <DialogDescription>{order.customer_name}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/50 p-3 text-center text-sm">
          <I k="Tổng tiền" v={vnd(order.total_amount)} />
          <I k="Đã thu" v={vnd(order.paid_amount)} tone="text-emerald-600" />
          <I k="Còn nợ" v={vnd(order.debt_amount)} tone="text-rose-600" />
        </div>

        {/* ----- Doi chieu voi bang ke ngan hang ----- */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Landmark className="size-4" /> Khoản tiền về từ ngân hàng
          </Label>
          <BankTxnPicker order={order} value={bankTxn} soTienGhi={parseNum(form.amount)}
            onPick={chonKhoanTienVe} onClear={() => setBankTxn(null)} />
          <p className="text-xs text-muted-foreground">
            Chọn khoản tiền khách đã chuyển để tự điền số tiền và chứng từ.
            Một khoản chuyển chia được cho nhiều đơn — phần chưa dùng vẫn nằm trong danh sách.
            Thu tiền mặt thì bỏ qua ô này, nhập tay bên dưới.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Loại thanh toán</Label>
            <Select value={form.payment_type} onChange={e => setForm(f => ({ ...f, payment_type: e.target.value }))}>
              {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ngày thu</Label>
            <Input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Số tiền</Label>
            <Input inputMode="decimal" placeholder="0" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[0.3, 0.5, 0.7, 1].map(p => (
                <Button key={p} type="button" size="sm" variant="secondary"
                  onClick={() => setForm(f => ({ ...f, amount: String(Math.round(Number(order.debt_amount) * p)) }))}>
                  {p === 1 ? 'Tất toán' : `${p * 100}% dư nợ`}
                </Button>
              ))}
            </div>
            {!!amt && (
              <p className="num pt-1 text-xs text-muted-foreground">
                Dư nợ sau bút toán: <b className={after > 0 ? 'text-rose-600' : 'text-emerald-600'}>{vnd(after)} đ</b>
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Hình thức</Label>
            <Select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
              {METHODS.map(m => <option key={m}>{m}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Số chứng từ / UNC</Label>
            <Input value={form.reference_no} placeholder="vd: UNC0912"
              onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tài khoản nhận</Label>
            <Input value={form.bank_account} placeholder="vd: Vietcombank - 0123456789"
              onChange={e => setForm(f => ({ ...f, bank_account: e.target.value }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Nội dung chuyển khoản</Label>
            <Input value={form.transfer_note}
              placeholder="Chép đúng nội dung khách ghi — để sau này dò với sao kê"
              onChange={e => setForm(f => ({ ...f, transfer_note: e.target.value }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Diễn giải</Label>
            <Textarea rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <Label>Chứng từ chuyển khoản</Label>
            <div className="mt-1.5 flex items-center gap-3 rounded-lg border p-2.5">
              <ChungTu value={form.proof_path}
                onChange={v => setForm(f => ({ ...f, proof_path: v }))} />
              <p className="text-xs text-muted-foreground">
                {form.proof_path
                  ? 'Đã đính chứng từ — sổ thu tiền sẽ hiện ảnh này'
                  : 'Đính ảnh sao kê hoặc biên lai để sau này đối chiếu ngân hàng'}
              </p>
            </div>
          </div>
        </div>

        {!!history.length && (
          <div className="rounded-xl border p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Lịch sử thu tiền</p>
            <div className="space-y-1.5">
              {history.map(p => (
                <div key={p.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-muted-foreground">
                      {dmy(p.payment_date)} · {TYPES.find(t => t.v === p.payment_type)?.l} · {p.method}
                    </p>
                    {(p.reference_no || p.transfer_note) && (
                      <p className="truncate text-xs text-muted-foreground">
                        {[p.reference_no, p.transfer_note].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <span className="num shrink-0 font-medium">{vnd(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Lưu bút toán
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const I = ({ k, v, tone = '' }) => (
  <div><p className="text-xs text-muted-foreground">{k}</p><p className={`num font-semibold ${tone}`}>{v}</p></div>
)

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
import { cn } from '@/lib/utils'
import { vnd, dmy, parseNum, PAYMENT_TYPE_LABEL } from '@/lib/format'
import { Loader2, Send, PencilLine, Ban, ArrowRight, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

const METHODS = ['Chuyển khoản', 'Tiền mặt', 'Bù trừ công nợ', 'Séc']

/** Ke toan tao yeu cau sua / huy mot but toan thu tien */
export default function AmendmentDialog({ payment, open, onOpenChange, onSaved }) {
  const [kind, setKind] = useState('edit')
  const [f, setF] = useState({})
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!payment || !open) return
    setKind('edit'); setReason('')
    setF({
      amount: String(payment.amount ?? ''),
      payment_date: payment.payment_date ?? '',
      payment_type: payment.payment_type ?? 'deposit',
      method: payment.method ?? '',
      reference_no: payment.reference_no ?? '',
      transfer_note: payment.transfer_note ?? '',
      note: payment.note ?? ''
    })
  }, [payment, open])

  if (!payment) return null

  const changed = kind === 'edit' && (
    parseNum(f.amount) !== Number(payment.amount) ||
    f.payment_date !== payment.payment_date ||
    f.payment_type !== payment.payment_type ||
    (f.method || '') !== (payment.method || '') ||
    (f.reference_no || '') !== (payment.reference_no || '') ||
    (f.transfer_note || '') !== (payment.transfer_note || '') ||
    (f.note || '') !== (payment.note || '')
  )

  const send = async () => {
    if (!reason.trim()) return toast.error('Bắt buộc ghi lý do điều chỉnh.')
    if (kind === 'edit' && !changed) return toast.error('Chưa thay đổi gì so với bút toán gốc.')
    if (kind === 'edit' && parseNum(f.amount) === 0)
      return toast.error('Số tiền 0 thì dùng chức năng Hủy bút toán.')

    setBusy(true)
    const row = { payment_id: payment.id, kind, reason: reason.trim() }
    if (kind === 'edit') Object.assign(row, {
      new_amount: parseNum(f.amount),
      new_payment_date: f.payment_date,
      new_payment_type: f.payment_type,
      new_method: f.method || null,
      new_reference_no: f.reference_no || null,
      new_transfer_note: f.transfer_note || null,
      new_note: f.note || null
    })
    const { error } = await supabase.from('payment_amendments').insert(row)
    setBusy(false)
    if (error) {
      if (/uq_amend_pending/.test(error.message))
        return toast.error('Bút toán này đã có một yêu cầu đang chờ Giám đốc duyệt.')
      return toast.error(error.message)
    }
    toast.success('Đã gửi yêu cầu, chờ Ban Giám đốc duyệt')
    onSaved?.(); onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yêu cầu điều chỉnh bút toán</DialogTitle>
          <DialogDescription>
            Đơn #{payment.order_code} · {payment.customer_name}
          </DialogDescription>
        </DialogHeader>

        <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
          <ShieldAlert className="size-4 shrink-0" />
          Số đã thu <b>giữ nguyên</b> cho tới khi Ban Giám đốc duyệt. Bút toán gốc không bị xóa,
          hệ thống lưu lại giá trị cũ để đối chiếu.
        </p>

        {/* But toan goc */}
        <div className="space-y-1 rounded-xl border bg-muted/40 p-3 text-sm">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Bút toán gốc</p>
          <div className="flex justify-between"><span>Ngày thu</span><b>{dmy(payment.payment_date)}</b></div>
          <div className="flex justify-between"><span>Loại</span><b>{PAYMENT_TYPE_LABEL[payment.payment_type]}</b></div>
          <div className="flex justify-between"><span>Hình thức</span><b>{payment.method || '--'}</b></div>
          <div className="flex justify-between"><span>Số chứng từ</span><b>{payment.reference_no || '--'}</b></div>
          <div className="flex justify-between text-base">
            <span>Số tiền</span><b className="num">{vnd(payment.amount)} đ</b>
          </div>
        </div>

        {/* Chon loai dieu chinh */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <Tab active={kind === 'edit'} onClick={() => setKind('edit')}>
            <PencilLine className="size-3.5" /> Sửa lại
          </Tab>
          <Tab active={kind === 'void'} onClick={() => setKind('void')}>
            <Ban className="size-3.5" /> Hủy bút toán
          </Tab>
        </div>

        {kind === 'edit' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Số tiền đúng</Label>
              <Input inputMode="decimal" value={f.amount}
                onChange={e => setF({ ...f, amount: e.target.value })} />
              {parseNum(f.amount) !== Number(payment.amount) && (
                <p className="num flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground line-through">{vnd(payment.amount)}</span>
                  <ArrowRight className="size-3 text-muted-foreground" />
                  <b className="text-emerald-700">{vnd(parseNum(f.amount))}</b>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Ngày thu</Label>
              <Input type="date" value={f.payment_date}
                onChange={e => setF({ ...f, payment_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Loại</Label>
              <Select value={f.payment_type} onChange={e => setF({ ...f, payment_type: e.target.value })}>
                {Object.entries(PAYMENT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Hình thức</Label>
              <Select value={f.method} onChange={e => setF({ ...f, method: e.target.value })}>
                {METHODS.map(m => <option key={m}>{m}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Số chứng từ</Label>
              <Input value={f.reference_no} onChange={e => setF({ ...f, reference_no: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nội dung chuyển khoản</Label>
              <Input value={f.transfer_note} onChange={e => setF({ ...f, transfer_note: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Diễn giải</Label>
              <Input value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            Bút toán sẽ được đưa về <b>0 đ</b> và đánh dấu <b>đã hủy</b>. Dòng vẫn nằm trong sổ
            để giữ dấu vết, công nợ của đơn tự tính lại. Thao tác này cần Giám đốc duyệt.
          </p>
        )}

        <div className="space-y-1.5">
          <Label>Lý do điều chỉnh *</Label>
          <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
            placeholder="vd: Ghi nhầm 3.300.000 thành 33.000.000 do thừa số 0. Đã đối chiếu UNC ngày 09/08." />
          <p className="text-xs text-muted-foreground">
            Ban Giám đốc sẽ đọc lý do này khi duyệt, ghi càng rõ càng nhanh được duyệt.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Hủy</Button>
          <Button onClick={send} disabled={busy || !reason.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Gửi Giám đốc duyệt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const Tab = ({ active, onClick, children }) => (
  <button type="button" onClick={onClick}
    className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium transition',
      active ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
    {children}
  </button>
)

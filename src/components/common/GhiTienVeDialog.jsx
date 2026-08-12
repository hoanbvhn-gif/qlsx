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
import { Badge } from '@/components/ui/badge'
import BankTxnPicker from '@/components/common/BankTxnPicker'
import { vnd, dmy, parseNum, loiTiengViet, PAYMENT_TYPE_LABEL } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Loader2, Landmark, Banknote, Clock, CheckCircle2, Trash2, CircleDollarSign
} from 'lucide-react'
import { toast } from 'sonner'

/**
 * KINH DOANH GHI NHAN TIEN KHACH TRA cho don cua chinh minh.
 *
 * Hai duong:
 *   - Chuyen khoan: bat buoc chi ra khoan trong bang ke -> co doi chieu that
 *   - Tien mat:     chi la loi khai, phai ghi ro ai dua -> Ke toan dem tien roi duyet
 *
 * Ca hai deu CHO KE TOAN XAC NHAN, chua tru cong no.
 * Khach tra 2-3 lan thi mo lai hop thoai nay 2-3 lan.
 */
const LOAI = [
  { v: 'deposit', l: 'Đặt cọc' },
  { v: 'partial', l: 'Trả một phần' },
  { v: 'final',   l: 'Trả nốt' }
]

export default function GhiTienVeDialog({ order, open, onOpenChange, onDone, userId }) {
  const [cach, setCach] = useState('ck')      // ck = chuyen khoan | tm = tien mat
  const [txn, setTxn] = useState(null)
  const [soTien, setSoTien] = useState('')
  const [ngay, setNgay] = useState(new Date().toISOString().slice(0, 10))
  const [loai, setLoai] = useState('deposit')
  const [dienGiai, setDienGiai] = useState('')
  const [busy, setBusy] = useState(false)
  const [lichSu, setLichSu] = useState([])

  const taiLichSu = () => {
    if (!order) return
    supabase.from('payments')
      .select('id, amount, payment_date, payment_type, method, reference_no, transfer_note, note, confirmed, created_by')
      .eq('order_id', order.id).order('payment_date', { ascending: false })
      .then(({ data }) => setLichSu(data ?? []))
  }

  const lamMoiForm = () => {
    setTxn(null); setSoTien(''); setDienGiai('')
    setNgay(new Date().toISOString().slice(0, 10))
  }

  useEffect(() => {
    if (!open) return
    setCach('ck'); lamMoiForm(); taiLichSu()
  }, [open, order?.id])

  if (!order) return null

  const conNo = Number(order.debt_amount ?? 0)
  const choDuyet = lichSu.filter(p => !p.confirmed)
  const tongCho = choDuyet.reduce((a, p) => a + Number(p.amount), 0)
  const daThu = Number(order.paid_amount ?? 0)
  const soLan = lichSu.filter(p => p.confirmed).length

  const amt = parseNum(soTien)
  const conLaiCuaKhoan = txn ? Number(txn.con_lai ?? txn.amount_in) : 0
  const conNoSau = conNo - amt

  /* Loai but toan tu suy ra, nhung van cho sua */
  useEffect(() => {
    if (!amt) return
    setLoai(daThu <= 0 && soLan === 0 ? 'deposit' : (conNoSau > 0.01 ? 'partial' : 'final'))
  }, [amt, daThu, soLan, conNoSau])

  const chon = (r) => {
    setTxn(r)
    const con = Number(r.con_lai ?? r.amount_in)
    setSoTien(String(Math.round(conNo > 0 ? Math.min(con, conNo) : con)))
    setNgay(r.posting_date)
  }

  const doiCach = (v) => {
    setCach(v)
    setTxn(null); setSoTien(''); setNgay(new Date().toISOString().slice(0, 10))
  }

  const luu = async () => {
    if (cach === 'ck' && !txn) return toast.error('Chọn khoản tiền khách đã chuyển trong bảng kê.')
    if (!amt || amt <= 0) return toast.error('Nhập số tiền.')
    if (cach === 'ck' && amt > conLaiCuaKhoan + 0.01) {
      return toast.error(`Khoản này chỉ còn ${vnd(conLaiCuaKhoan)} đ chưa phân bổ.`)
    }
    if (cach === 'tm' && !dienGiai.trim()) {
      return toast.error('Thu tiền mặt thì ghi rõ ai đưa, đưa ở đâu — để Kế toán đối chiếu.')
    }

    setBusy(true)
    const { error } = await supabase.from('payments').insert({
      order_id: order.id,
      payment_type: loai,
      amount: amt,
      payment_date: cach === 'ck' ? txn.posting_date : ngay,
      method: cach === 'ck' ? 'Chuyển khoản' : 'Tiền mặt',
      reference_no: cach === 'ck' ? txn.bank_ref : null,
      transfer_note: cach === 'ck' ? (txn.content ?? null) : null,
      bank_account: cach === 'ck' && txn.account_no
        ? `${txn.bank_name ?? ''} ${txn.account_no}`.trim() : null,
      note: dienGiai || null,
      bank_txn_id: cach === 'ck' ? txn.id : null,
      created_by: userId
    })
    setBusy(false)
    if (error) return toast.error(loiTiengViet(error))

    toast.success(conNoSau > 0.01
      ? `Đã gửi Kế toán xác nhận. Đơn còn ${vnd(conNoSau)} đ, thu tiếp lần sau vào đúng chỗ này.`
      : 'Đã gửi Kế toán xác nhận. Đơn này thu đủ rồi.')
    lamMoiForm(); taiLichSu(); onDone?.()
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
          <DialogTitle>Ghi nhận tiền khách trả · #{order.order_code}</DialogTitle>
          <DialogDescription>{order.customer_name}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/50 p-3 text-center text-sm">
          <O k="Tổng tiền" v={vnd(order.total_amount)} />
          <O k={`Đã thu${soLan ? ` (${soLan} lần)` : ''}`} v={vnd(daThu)} tone="text-emerald-600" />
          <O k="Còn nợ" v={vnd(conNo)} tone="text-rose-600" />
        </div>

        {tongCho > 0 && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            <Clock className="mt-0.5 size-4 shrink-0" />
            <span>
              Đang có <b className="num">{vnd(tongCho)} đ</b> chờ Kế toán xác nhận —
              số này chưa trừ vào ô "Còn nợ" ở trên.
            </span>
          </p>
        )}

        {/* ---------- Khach tra bang cach nao ---------- */}
        <div className="space-y-2">
          <Label>Khách trả bằng cách nào</Label>
          <div className="grid grid-cols-2 gap-2">
            <CachNut active={cach === 'ck'} onClick={() => doiCach('ck')}
              icon={Landmark} title="Chuyển khoản"
              desc="Chọn đúng khoản trong bảng kê" />
            <CachNut active={cach === 'tm'} onClick={() => doiCach('tm')}
              icon={Banknote} title="Tiền mặt"
              desc="Khách đưa tiền tận tay" />
          </div>
        </div>

        {/* ---------- Chuyen khoan ---------- */}
        {cach === 'ck' && (
          <div className="space-y-2">
            <BankTxnPicker order={order} value={txn} soTienGhi={amt}
              onPick={chon} onClear={() => { setTxn(null); setSoTien('') }} />
            <p className="text-xs text-muted-foreground">
              Gõ ngày <b>12/08</b>, số tiền <b>2510000</b> hoặc tên khách để tìm.
              Không thấy khoản nào thì Kế toán chưa nhập bảng kê của ngày đó.
            </p>
          </div>
        )}

        {/* ---------- Tien mat ---------- */}
        {cach === 'tm' && (
          <p className="rounded-lg border border-sky-200 bg-sky-50 p-2.5 text-xs text-sky-900">
            Tiền mặt không có bảng kê để đối chiếu, nên đây chỉ là <b>lời khai</b>.
            Ghi rõ ai đưa và đưa ở đâu — Kế toán đếm tiền thực tế rồi mới xác nhận vào sổ.
          </p>
        )}

        {(cach === 'tm' || txn) && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Số tiền lần này</Label>
                <Input inputMode="decimal" value={soTien} onChange={e => setSoTien(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Ngày nhận</Label>
                <Input type="date" value={ngay} onChange={e => setNgay(e.target.value)}
                  disabled={cach === 'ck'} />
                {cach === 'ck' && (
                  <p className="text-[11px] text-muted-foreground">Lấy theo ngày tiền về tài khoản</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {conNo > 0 && (
                <Button type="button" size="sm" variant="secondary"
                  onClick={() => setSoTien(String(Math.round(
                    cach === 'ck' ? Math.min(conLaiCuaKhoan, conNo) : conNo)))}>
                  Trả hết {vnd(cach === 'ck' ? Math.min(conLaiCuaKhoan, conNo) : conNo)}
                </Button>
              )}
              {cach === 'ck' && conLaiCuaKhoan > conNo && conNo > 0 && (
                <Button type="button" size="sm" variant="secondary"
                  onClick={() => setSoTien(String(Math.round(conLaiCuaKhoan)))}>
                  Cả khoản {vnd(conLaiCuaKhoan)}
                </Button>
              )}
              {[0.3, 0.5].map(p => (
                <Button key={p} type="button" size="sm" variant="secondary"
                  onClick={() => setSoTien(String(Math.round(conNo * p)))}>
                  {p * 100}% dư nợ
                </Button>
              ))}
            </div>

            {!!amt && (
              <div className="num space-y-0.5 rounded-lg bg-muted/50 p-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lần này</span>
                  <b>{vnd(amt)} đ</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Còn nợ sau khi Kế toán duyệt</span>
                  <b className={conNoSau > 0.01 ? 'text-rose-600' : 'text-emerald-600'}>
                    {vnd(Math.max(0, conNoSau))} đ
                  </b>
                </div>
                {cach === 'ck' && amt < conLaiCuaKhoan && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Khoản chuyển còn dư (dùng cho đơn khác)</span>
                    <b className="text-sky-700">{vnd(conLaiCuaKhoan - amt)} đ</b>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Loại khoản thu</Label>
                <Select value={loai} onChange={e => setLoai(e.target.value)}>
                  {LOAI.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Diễn giải {cach === 'tm' && <span className="text-rose-600">*</span>}
                </Label>
                <Textarea rows={2} value={dienGiai} onChange={e => setDienGiai(e.target.value)}
                  placeholder={cach === 'tm'
                    ? 'vd: anh Hùng đưa tiền mặt tại xưởng sáng 12/08'
                    : 'vd: khách chuyển gộp 2 đơn, đơn này lấy 3 triệu'} />
              </div>
            </div>
          </>
        )}

        {/* ---------- Cac lan da thu ---------- */}
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
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        {p.method === 'Tiền mặt'
                          ? <Banknote className="size-3" />
                          : <Landmark className="size-3" />}
                        {p.method}
                      </span>
                      {!p.confirmed && (
                        <Badge className="border-amber-200 bg-amber-50 text-amber-700">chờ Kế toán</Badge>
                      )}
                    </p>
                    {(p.reference_no || p.note) && (
                      <p className="truncate text-xs text-muted-foreground">
                        {[p.reference_no, p.note].filter(Boolean).join(' · ')}
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
            {conNo > 0.01 && (
              <p className="mt-2 flex items-center gap-1.5 border-t pt-2 text-xs text-muted-foreground">
                <CircleDollarSign className="size-3.5" />
                Còn <b className="num text-rose-600">{vnd(conNo)} đ</b> — khách trả tiếp thì
                mở lại đúng hộp thoại này, ghi thêm một lần nữa.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
          <Button onClick={luu} disabled={busy || (cach === 'ck' && !txn) || !amt}>
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

const CachNut = ({ active, onClick, icon: Icon, title, desc }) => (
  <button type="button" onClick={onClick}
    className={cn('flex items-start gap-2.5 rounded-xl border-2 p-3 text-left transition',
      active ? 'border-primary bg-primary/5' : 'hover:bg-accent')}>
    <Icon className={cn('mt-0.5 size-5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
    <div className="min-w-0">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  </button>
)

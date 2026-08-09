import { useState, useMemo, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useOrders } from '@/hooks/useOrders'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import StatCard from '@/components/common/StatCard'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge, Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { vnd, dmy, parseNum } from '@/lib/format'
import { Wallet, CircleDollarSign, Search, Plus, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const TYPES = [
  { v: 'deposit', l: 'Đặt cọc' },
  { v: 'partial', l: 'Thanh toán từng phần' },
  { v: 'final',   l: 'Thanh toán nốt' },
  { v: 'refund',  l: 'Hoàn trả (ghi âm)' }
]
const METHODS = ['Chuyển khoản', 'Tiền mặt', 'Bù trừ công nợ', 'Séc']

export default function Payments() {
  const { profile } = useAuth()
  const { orders, loading, reload } = useOrders({
    statuses: ['approved', 'in_production', 'completed', 'delivered', 'pending_accounting']
  })
  const [q, setQ] = useState('')
  const [onlyDebt, setOnlyDebt] = useState(true)
  const [target, setTarget] = useState(null)

  const rows = useMemo(() => orders.filter(o =>
    (!onlyDebt || Number(o.debt_amount) > 0) &&
    (!q || `${o.order_code} ${o.customer_name}`.toLowerCase().includes(q.toLowerCase()))
  ), [orders, q, onlyDebt])

  const tot = useMemo(() => ({
    amount: orders.reduce((a, o) => a + Number(o.total_amount), 0),
    paid: orders.reduce((a, o) => a + Number(o.paid_amount), 0),
    debt: orders.reduce((a, o) => a + Number(o.debt_amount), 0)
  }), [orders])

  return (
    <>
      <PageHeader title="Thu tiền & Công nợ" desc="Ghi nhận đặt cọc / thanh toán, hệ thống tự tính số dư còn nợ" />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Tổng giá trị đơn" value={vnd(tot.amount)} icon={CircleDollarSign} />
        <StatCard label="Đã thu" value={vnd(tot.paid)} icon={Wallet} tone="text-emerald-600" />
        <StatCard label="Còn phải thu" value={vnd(tot.debt)} icon={Wallet} tone="text-rose-600" />
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Tìm mã đơn / khách hàng..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Button variant={onlyDebt ? 'default' : 'outline'} onClick={() => setOnlyDebt(v => !v)}>
          {onlyDebt ? 'Đang lọc: còn nợ' : 'Đang xem: tất cả'}
        </Button>
      </div>

      {loading ? <Skeleton className="h-64 w-full" />
        : !rows.length ? <EmptyState icon={CheckCircle2} title="Không có công nợ" desc="Tất cả đơn hàng đã tất toán." />
        : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã đơn</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead className="text-right">Tổng tiền</TableHead>
                <TableHead className="text-right">Đã thu</TableHead>
                <TableHead className="text-right">Còn nợ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono font-medium">{o.order_code}
                    <span className="ml-1 block text-xs font-sans text-muted-foreground">{dmy(o.order_date)}</span>
                  </TableCell>
                  <TableCell className="min-w-[170px]">{o.customer_name}</TableCell>
                  <TableCell className="num text-right font-medium">{vnd(o.total_amount)}</TableCell>
                  <TableCell className="num text-right text-emerald-600">{vnd(o.paid_amount)}</TableCell>
                  <TableCell className={`num text-right font-semibold ${Number(o.debt_amount) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {vnd(o.debt_amount)}
                  </TableCell>
                  <TableCell>
                    {o.is_settled
                      ? <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Đã tất toán</Badge>
                      : <StatusBadge status={o.status} />}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setTarget(o)}>
                      <Plus className="size-4" /> Ghi thu
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

      <PaymentDialog order={target} onClose={() => setTarget(null)} onDone={reload} userId={profile.id} />
    </>
  )
}

function PaymentDialog({ order, onClose, onDone, userId }) {
  const [history, setHistory] = useState([])
  const [form, setForm] = useState({
    payment_type: 'deposit', amount: '', payment_date: new Date().toISOString().slice(0, 10),
    method: 'Chuyển khoản', reference_no: '', bank_account: '', transfer_note: '', note: ''
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!order) return
    setForm(f => ({
      ...f, amount: '', reference_no: '', transfer_note: '', note: '',
      payment_type: Number(order.paid_amount) > 0 ? 'final' : 'deposit'
    }))
    supabase.from('payments').select('*').eq('order_id', order.id)
      .order('payment_date', { ascending: false })
      .then(({ data }) => setHistory(data ?? []))
  }, [order])

  if (!order) return null
  const amt = parseNum(form.amount)
  const after = Number(order.debt_amount) - (form.payment_type === 'refund' ? -amt : amt)

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
      created_by: userId
    })
    setBusy(false)
    if (error) return toast.error(error.message)
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

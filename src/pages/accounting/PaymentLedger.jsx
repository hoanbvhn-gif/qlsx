import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import PageHeader from '@/components/common/PageHeader'
import StatCard from '@/components/common/StatCard'
import EmptyState from '@/components/common/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { vnd, dmy, dmyhm } from '@/lib/format'
import { cn, noAccent } from '@/lib/utils'
import {
  Search, Download, Wallet, TrendingUp, CheckCircle2, Circle,
  Landmark, Banknote, CalendarDays, RotateCcw, PencilLine, Ban, Clock, Trash2, AlertTriangle,
  ImageOff, Paperclip
} from 'lucide-react'
import { toast } from 'sonner'
import AmendmentDialog from './AmendmentDialog'
import { ChungTuNho, linkChungTu } from '@/components/common/ChungTu'

const TYPE_LABEL = {
  deposit: 'Đặt cọc', partial: 'Thanh toán từng phần',
  final: 'Thanh toán nốt', refund: 'Hoàn trả'
}
const TYPE_TONE = {
  deposit: 'bg-sky-50 text-sky-700 border-sky-200',
  partial: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  final: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  refund: 'bg-rose-50 text-rose-700 border-rose-200'
}

const firstOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export default function PaymentLedger() {
  const { profile } = useAuth()
  const canEdit = ['accounting', 'management'].includes(profile?.role)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const [q, setQ] = useState('')
  const [method, setMethod] = useState('')
  const [rec, setRec] = useState('')
  const [ct, setCt] = useState('')
  const [amend, setAmend] = useState(null)
  const [del, setDel] = useState(null)          // but toan Giam doc muon xoa han
  const [delReason, setDelReason] = useState('')
  const [delBusy, setDelBusy] = useState(false)
  const isBoss = profile?.role === 'management'
  const [anh, setAnh] = useState({})        // duong dan -> link xem tam thoi

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('v_payment_ledger')
      .select('*')
      .gte('payment_date', from)
      .lte('payment_date', to)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    setRows(data ?? [])
    setLoading(false)
    // Xin link xem anh cho ca trang trong 1 lan goi
    const paths = (data ?? []).map(r => r.proof_path).filter(Boolean)
    if (paths.length) linkChungTu(paths).then(setAnh)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const list = useMemo(() => {
    const key = noAccent(q)
    return rows.filter(r =>
      (!method || r.method === method) &&
      (!rec || (rec === 'yes' ? r.reconciled : !r.reconciled)) &&
      (!ct || (ct === 'yes' ? r.co_chung_tu : !r.co_chung_tu)) &&
      (!key || noAccent(`${r.order_code} ${r.customer_name} ${r.reference_no ?? ''} ${r.transfer_note ?? ''}`).includes(key))
    )
  }, [rows, q, method, rec, ct])

  const sum = useMemo(() => ({
    total: list.reduce((a, r) => a + Number(r.amount), 0),
    count: list.length,
    done: list.filter(r => r.reconciled).length,
    pending: list.filter(r => !r.reconciled).reduce((a, r) => a + Number(r.amount), 0),
    thieuCt: list.filter(r => !r.co_chung_tu && !r.voided).length
  }), [list])

  const methods = useMemo(() => [...new Set(rows.map(r => r.method).filter(Boolean))], [rows])

  const toggleRec = async (r) => {
    const { error } = await supabase.from('payments')
      .update({ reconciled: !r.reconciled }).eq('id', r.id)
    if (error) return toast.error(error.message)
    setRows(rs => rs.map(x => x.id === r.id ? { ...x, reconciled: !x.reconciled } : x))
  }

  /** Giam doc xoa han but toan — ghi ly do vao truoc de nhat ky bat duoc */
  const doDelete = async () => {
    if (!delReason.trim()) return toast.error('Bắt buộc ghi lý do xóa.')
    setDelBusy(true)
    const { error: e1 } = await supabase.from('payments')
      .update({ delete_reason: delReason.trim() }).eq('id', del.id)
    if (e1) { setDelBusy(false); return toast.error(e1.message) }
    const { error: e2 } = await supabase.from('payments').delete().eq('id', del.id)
    setDelBusy(false)
    if (e2) return toast.error(e2.message)
    toast.success('Đã xóa bút toán — thao tác được lưu vào Nhật ký hệ thống')
    setDel(null); setDelReason(''); load()
  }

  const exportCsv = () => {
    const head = ['Ngày thu', 'Mã đơn', 'Mã KH', 'Khách hàng', 'MST', 'Loại', 'Hình thức',
      'Tài khoản nhận', 'Số chứng từ', 'Nội dung CK', 'Số tiền', 'NVKD', 'Người ghi',
      'Có ảnh CK', 'Đã đối chiếu', 'Ghi chú']
    const body = list.map(r => [
      dmy(r.payment_date), r.order_code, r.customer_code ?? '', r.customer_name, r.tax_code ?? '',
      TYPE_LABEL[r.payment_type] ?? r.payment_type, r.method ?? '', r.bank_account ?? '',
      r.reference_no ?? '', r.transfer_note ?? '', r.amount, r.sales_name ?? '',
      r.nguoi_ghi ?? '', r.co_chung_tu ? 'x' : '', r.reconciled ? 'Đã đối chiếu' : 'Chưa', r.note ?? ''
    ])
    const csv = '﻿' + [head, ...body]
      .map(rr => rr.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `so-thu-tien_${from}_${to}.csv`
    a.click()
  }

  const quickRange = (kind) => {
    const now = new Date()
    if (kind === 'month') {
      setFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
      setTo(new Date().toISOString().slice(0, 10))
    } else if (kind === 'lastmonth') {
      setFrom(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10))
      setTo(new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10))
    } else if (kind === 'quarter') {
      const q0 = Math.floor(now.getMonth() / 3) * 3
      setFrom(new Date(now.getFullYear(), q0, 1).toISOString().slice(0, 10))
      setTo(new Date().toISOString().slice(0, 10))
    } else {
      setFrom(new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10))
      setTo(new Date().toISOString().slice(0, 10))
    }
  }

  return (
    <>
      <PageHeader title="Sổ thu tiền"
        desc="Nhật ký toàn bộ khoản đã thu — dùng để đối chiếu với sao kê ngân hàng"
        action={<Button variant="outline" onClick={exportCsv}><Download className="size-4" /> Xuất CSV</Button>} />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng thu trong kỳ" value={vnd(sum.total)} icon={TrendingUp} tone="text-emerald-600" />
        <StatCard label="Số bút toán" value={sum.count} icon={Wallet} />
        <StatCard label="Đã đối chiếu" value={`${sum.done}/${sum.count}`} icon={CheckCircle2} tone="text-emerald-600" />
        <StatCard label="Chưa đối chiếu" value={vnd(sum.pending)} icon={Landmark} tone="text-amber-600"
          sub={sum.thieuCt ? `${sum.thieuCt} khoản chưa có chứng từ` : 'đủ chứng từ'} />
      </div>

      {/* ----- Bo loc ----- */}
      <Card className="mb-4">
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label>Từ ngày</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Đến ngày</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Hình thức</Label>
              <Select value={method} onChange={e => setMethod(e.target.value)}>
                <option value="">Tất cả</option>
                {methods.map(m => <option key={m} value={m}>{m}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Đối chiếu</Label>
              <Select value={rec} onChange={e => setRec(e.target.value)}>
                <option value="">Tất cả</option>
                <option value="no">Chưa đối chiếu</option>
                <option value="yes">Đã đối chiếu</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Chứng từ</Label>
              <Select value={ct} onChange={e => setCt(e.target.value)}>
                <option value="">Tất cả</option>
                <option value="no">Chưa có chứng từ</option>
                <option value="yes">Đã có chứng từ</option>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" /> Nhanh:
            </span>
            {[['month', 'Tháng này'], ['lastmonth', 'Tháng trước'],
              ['quarter', 'Quý này'], ['year', 'Năm nay']].map(([k, v]) => (
              <Button key={k} size="sm" variant="secondary" onClick={() => quickRange(k)}>{v}</Button>
            ))}
            <Button size="sm" variant="ghost" onClick={load}><RotateCcw className="size-3.5" /> Tải lại</Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Tìm mã đơn / khách hàng / số chứng từ / nội dung chuyển khoản..."
              value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {loading ? <Skeleton className="h-64 w-full" />
        : !list.length ? <EmptyState icon={Banknote} title="Chưa có khoản thu nào"
            desc="Đổi khoảng thời gian hoặc bỏ bớt bộ lọc." />
        : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày thu</TableHead>
                <TableHead>Mã đơn</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Hình thức</TableHead>
                <TableHead>Số chứng từ</TableHead>
                <TableHead className="text-center">Ảnh CK</TableHead>
                <TableHead className="text-right">Số tiền</TableHead>
                <TableHead>Người ghi</TableHead>
                <TableHead className="text-center">Đối chiếu</TableHead>
                <TableHead className="text-right">Điều chỉnh</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map(r => (
                <TableRow key={r.id} className={cn(
                  Number(r.amount) < 0 && 'bg-rose-50/40',
                  r.voided && 'bg-muted/60 text-muted-foreground',
                  r.confirmed === false && 'bg-amber-50/60')}>
                  <TableCell className="whitespace-nowrap">
                    {dmy(r.payment_date)}
                    <span className="block text-xs text-muted-foreground">{dmyhm(r.created_at)}</span>
                  </TableCell>
                  <TableCell className="font-mono font-medium">
                    {r.order_code}
                    {r.voided && <span className="block text-[11px] font-sans text-rose-600">ĐÃ HỦY</span>}
                    {r.confirmed === false && (
                      <span className="block text-[11px] font-sans text-amber-700">CHƯA HẠCH TOÁN</span>
                    )}
                  </TableCell>
                  <TableCell className="min-w-[170px]">
                    {r.customer_name}
                    {r.sales_name && <span className="block text-xs text-muted-foreground">NVKD {r.sales_name}</span>}
                  </TableCell>
                  <TableCell>
                    <Badge className={TYPE_TONE[r.payment_type]}>{TYPE_LABEL[r.payment_type] ?? r.payment_type}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {r.method}
                    {r.bank_account && <span className="block text-xs">{r.bank_account}</span>}
                  </TableCell>
                  <TableCell className="min-w-[140px]">
                    <span className="font-mono text-xs">{r.reference_no || '--'}</span>
                    {r.transfer_note && (
                      <span className="block truncate text-xs text-muted-foreground">{r.transfer_note}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <ChungTuNho path={r.proof_path} url={anh[r.proof_path]} />
                    </div>
                  </TableCell>
                  <TableCell className={cn('num text-right font-semibold',
                    r.voided ? 'text-muted-foreground line-through'
                      : Number(r.amount) < 0 ? 'text-rose-600' : 'text-emerald-700')}>
                    {vnd(r.amount)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{r.nguoi_ghi || '--'}</TableCell>
                  <TableCell className="text-center">
                    <button type="button" disabled={!canEdit}
                      onClick={() => canEdit && toggleRec(r)}
                      title={r.reconciled ? `Đã đối chiếu ${dmyhm(r.reconciled_at)}` : 'Bấm để đánh dấu đã đối chiếu'}
                      className={cn('inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition',
                        r.reconciled
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'text-muted-foreground',
                        canEdit && 'hover:bg-accent')}>
                      {r.reconciled ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
                      {r.reconciled ? 'Đã khớp' : 'Chưa'}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.confirmed === false ? (
                      <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                        <Clock className="mr-1 size-3" /> Chờ Kế toán xác nhận
                      </Badge>
                    ) : r.co_yeu_cau_sua ? (
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                        <Clock className="mr-1 size-3" /> Chờ GĐ duyệt
                      </Badge>
                    ) : r.voided ? (
                      <span className="text-xs text-muted-foreground">--</span>
                    ) : (
                      <div className="flex justify-end gap-1">
                        {canEdit && (
                          <Button size="sm" variant="ghost" onClick={() => setAmend(r)}>
                            <PencilLine className="size-4" /> Sửa
                          </Button>
                        )}
                        {isBoss && (
                          <Button size="sm" variant="ghost" className="text-destructive"
                            title="Chỉ Ban Giám đốc xóa được" onClick={() => { setDel(r); setDelReason('') }}>
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

      {/* Xoa han but toan — chi Ban Giam doc */}
      <Dialog open={!!del} onOpenChange={v => !delBusy && !v && setDel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Xóa hẳn bút toán
            </DialogTitle>
          </DialogHeader>
          {del && (
            <div className="space-y-1 rounded-xl border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between"><span>Đơn</span><b className="font-mono">#{del.order_code}</b></div>
              <div className="flex justify-between"><span>Khách hàng</span><b className="truncate">{del.customer_name}</b></div>
              <div className="flex justify-between"><span>Ngày thu</span><b>{dmy(del.payment_date)}</b></div>
              <div className="flex justify-between text-base"><span>Số tiền</span><b className="num">{vnd(del.amount)} đ</b></div>
            </div>
          )}
          <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            Bút toán biến mất khỏi sổ và công nợ của đơn tăng trở lại. Thao tác này
            <b> không hoàn tác được</b>. Cân nhắc dùng <b>Hủy bút toán</b> thay thế —
            cách đó giữ dòng lại trong sổ để đối chiếu về sau.
          </p>
          <div className="space-y-1.5">
            <Label>Lý do xóa *</Label>
            <Textarea rows={3} value={delReason} onChange={e => setDelReason(e.target.value)}
              placeholder="vd: Nhập trùng 2 lần cùng một khoản thu ngày 09/08" />
            <p className="text-xs text-muted-foreground">
              Lý do được ghi vĩnh viễn vào Nhật ký hệ thống cùng toàn bộ nội dung bút toán.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDel(null)} disabled={delBusy}>Hủy bỏ</Button>
            <Button variant="destructive" onClick={doDelete} disabled={delBusy || !delReason.trim()}>
              <Trash2 className="size-4" /> Xóa vĩnh viễn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AmendmentDialog payment={amend} open={!!amend}
        onOpenChange={v => !v && setAmend(null)} onSaved={load} />

      <p className="mt-4 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
        <b>Cách đối chiếu sao kê:</b> tải sao kê từ ngân hàng, xuất file CSV ở đây với cùng khoảng
        thời gian, mở cả hai bằng Excel rồi dò theo cột <b>Số tiền</b> và <b>Nội dung CK</b>.
        Khoản nào khớp thì quay lại đây bấm vào ô <b>Chưa</b> để chuyển thành <b>Đã khớp</b>.
        Cuối kỳ chỉ cần lọc &quot;Chưa đối chiếu&quot; là ra ngay danh sách cần xử lý.
        <br /><br />
        <b>Cột Ảnh CK:</b> có ảnh nghĩa là tiền đã về tài khoản và có chứng từ chứng minh —
        bấm vào ảnh để xem to. Ô để trắng nghĩa là chưa ai đính chứng từ, cần bổ sung trước khi
        đối chiếu sao kê. Lọc <b>&quot;Chưa có chứng từ&quot;</b> là ra ngay danh sách còn thiếu.
        <br /><br />
        <b>Ghi sai thì sao?</b> Bấm <b>Sửa</b> ở cột cuối để gửi yêu cầu điều chỉnh kèm lý do.
        Số đã thu giữ nguyên cho tới khi Ban Giám đốc duyệt. Bút toán không bao giờ bị xóa —
        trường hợp hủy thì đưa về 0 đ và đánh dấu ĐÃ HỦY, vẫn nằm trong sổ để giữ dấu vết.
      </p>
    </>
  )
}

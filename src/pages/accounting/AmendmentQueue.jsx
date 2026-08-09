import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import PageHeader from '@/components/common/PageHeader'
import StatCard from '@/components/common/StatCard'
import EmptyState from '@/components/common/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { vnd, dmy, dmyhm, PAYMENT_TYPE_LABEL } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Check, X, Clock, CheckCircle2, XCircle, ArrowRight, Ban, PencilLine, ShieldCheck
} from 'lucide-react'
import { toast } from 'sonner'

const ST = {
  pending:  { label: 'Chờ duyệt', tone: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  approved: { label: 'Đã duyệt',  tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'Từ chối',   tone: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle }
}

export default function AmendmentQueue() {
  const { profile } = useAuth()
  const isBoss = profile?.role === 'management'

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [decide, setDecide] = useState(null)   // { row, action }
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('v_payment_amendments')
      .select('*').order('requested_at', { ascending: false })
    if (error) toast.error(error.message)
    setRows(data ?? []); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const list = useMemo(
    () => rows.filter(r => !filter || r.status === filter), [rows, filter])
  const stat = useMemo(() => ({
    pending: rows.filter(r => r.status === 'pending').length,
    approved: rows.filter(r => r.status === 'approved').length,
    rejected: rows.filter(r => r.status === 'rejected').length
  }), [rows])

  const apply = async () => {
    if (!decide) return
    setBusy(true)
    const { error } = await supabase.from('payment_amendments')
      .update({ status: decide.action, decision_note: note.trim() || null })
      .eq('id', decide.row.id)
    setBusy(false)
    if (error) return toast.error(error.message)
    toast.success(decide.action === 'approved'
      ? 'Đã duyệt — số liệu được cập nhật, công nợ tính lại'
      : 'Đã từ chối yêu cầu')
    setDecide(null); setNote(''); load()
  }

  return (
    <>
      <PageHeader
        title={isBoss ? 'Duyệt điều chỉnh thu tiền' : 'Yêu cầu điều chỉnh của tôi'}
        desc={isBoss
          ? 'Kế toán không sửa trực tiếp được bút toán — mọi thay đổi phải qua đây'
          : 'Theo dõi trạng thái các yêu cầu đã gửi Ban Giám đốc'}
        action={
          <Select className="w-44" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Từ chối</option>
            <option value="">Tất cả</option>
          </Select>
        } />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Chờ duyệt" value={stat.pending} icon={Clock} tone="text-amber-600" />
        <StatCard label="Đã duyệt" value={stat.approved} icon={CheckCircle2} tone="text-emerald-600" />
        <StatCard label="Từ chối" value={stat.rejected} icon={XCircle} tone="text-rose-600" />
      </div>

      {loading ? <Skeleton className="h-64 w-full" />
        : !list.length ? <EmptyState icon={ShieldCheck} title="Không có yêu cầu nào"
            desc={filter === 'pending' ? 'Mọi bút toán đang khớp, không có gì chờ duyệt.' : 'Đổi bộ lọc để xem mục khác.'} />
        : (
          <div className="space-y-4">
            {list.map(r => <AmendCard key={r.id} r={r} isBoss={isBoss}
              onDecide={(action) => { setDecide({ row: r, action }); setNote('') }} />)}
          </div>
        )}

      {/* Hop thoai xac nhan */}
      <Dialog open={!!decide} onOpenChange={v => !busy && !v && setDecide(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decide?.action === 'approved' ? 'Duyệt điều chỉnh' : 'Từ chối yêu cầu'}
            </DialogTitle>
          </DialogHeader>
          {decide?.action === 'approved' ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Sau khi duyệt, số liệu áp dụng ngay và công nợ của đơn
              <b> #{decide?.row.order_code}</b> được tính lại. Bút toán sẽ cần đối chiếu sao kê lại.
            </p>
          ) : (
            <p className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
              Bút toán giữ nguyên như cũ. Kế toán có thể gửi yêu cầu khác nếu cần.
            </p>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Ý kiến của Ban Giám đốc</label>
            <Textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
              placeholder="Tùy chọn — ghi lại để sau này tra cứu" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecide(null)} disabled={busy}>Quay lại</Button>
            <Button onClick={apply} disabled={busy}
              variant={decide?.action === 'approved' ? 'success' : 'destructive'}>
              {decide?.action === 'approved' ? <Check className="size-4" /> : <X className="size-4" />}
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function AmendCard({ r, isBoss, onDecide }) {
  const st = ST[r.status]
  const StIcon = st.icon
  const isVoid = r.kind === 'void'

  const diffs = isVoid ? [] : [
    ['Số tiền', vnd(r.old_amount), vnd(r.new_amount), Number(r.old_amount) !== Number(r.new_amount)],
    ['Ngày thu', dmy(r.old_payment_date), dmy(r.new_payment_date), r.old_payment_date !== r.new_payment_date],
    ['Loại', PAYMENT_TYPE_LABEL[r.old_payment_type], PAYMENT_TYPE_LABEL[r.new_payment_type], r.old_payment_type !== r.new_payment_type],
    ['Hình thức', r.old_method, r.new_method, (r.old_method || '') !== (r.new_method || '')],
    ['Số chứng từ', r.old_reference_no, r.new_reference_no, (r.old_reference_no || '') !== (r.new_reference_no || '')],
    ['Nội dung CK', r.old_transfer_note, r.new_transfer_note, (r.old_transfer_note || '') !== (r.new_transfer_note || '')],
    ['Diễn giải', r.old_note, r.new_note, (r.old_note || '') !== (r.new_note || '')]
  ].filter(d => d[3])

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold">
              {isVoid ? <Ban className="size-4 text-rose-600" /> : <PencilLine className="size-4 text-sky-600" />}
              {isVoid ? 'Hủy bút toán' : 'Sửa bút toán'} · đơn
              <span className="font-mono">#{r.order_code}</span>
            </p>
            <p className="truncate text-sm text-muted-foreground">{r.customer_name}</p>
          </div>
          <Badge className={st.tone}><StIcon className="mr-1 size-3" />{st.label}</Badge>
        </div>

        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Lý do</p>
          <p className="mt-0.5">{r.reason}</p>
        </div>

        {isVoid ? (
          <p className="num rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            Đưa bút toán <b>{vnd(r.old_amount)} đ</b> ngày {dmy(r.old_payment_date)} về <b>0 đ</b>
          </p>
        ) : diffs.length ? (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2 text-left">Trường</th>
                  <th className="px-3 py-2 text-left">Giá trị cũ</th>
                  <th className="w-8" />
                  <th className="px-3 py-2 text-left">Đề nghị sửa thành</th>
                </tr>
              </thead>
              <tbody>
                {diffs.map(([k, oldV, newV]) => (
                  <tr key={k} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{k}</td>
                    <td className="px-3 py-2 text-muted-foreground line-through">{oldV || '--'}</td>
                    <td className="text-center"><ArrowRight className="mx-auto size-3.5 text-muted-foreground" /></td>
                    <td className="px-3 py-2 font-semibold text-emerald-700">{newV || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
          <span>Người yêu cầu: <b className="text-foreground">{r.nguoi_yeu_cau || '--'}</b> · {dmyhm(r.requested_at)}</span>
          {r.decided_at && (
            <span>{r.status === 'approved' ? 'Duyệt' : 'Từ chối'} bởi
              <b className="text-foreground"> {r.nguoi_duyet || '--'}</b> · {dmyhm(r.decided_at)}</span>
          )}
        </div>

        {r.decision_note && (
          <p className="rounded-lg border bg-muted/40 p-2.5 text-sm">
            <b>Ý kiến Ban Giám đốc:</b> {r.decision_note}
          </p>
        )}

        {isBoss && r.status === 'pending' && (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button variant="success" size="sm" onClick={() => onDecide('approved')}>
              <Check className="size-4" /> Duyệt điều chỉnh
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive"
              onClick={() => onDecide('rejected')}>
              <X className="size-4" /> Từ chối
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

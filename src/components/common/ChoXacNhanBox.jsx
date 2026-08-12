import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { vnd, dmy, dmyhm, loiTiengViet } from '@/lib/format'
import { Clock, CheckCircle2, Undo2, Loader2, Landmark, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

/**
 * BUT TOAN KINH DOANH GUI LEN, CHO KE TOAN XAC NHAN.
 *
 * Kinh doanh da doi chieu voi bang ke roi nen o day chi con viec kiem tra
 * lai roi bam mot cham. Chua xac nhan thi tien chua vao cong no.
 */
export default function ChoXacNhanBox({ onDone }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [traLai, setTraLai] = useState(null)
  const [lyDo, setLyDo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('v_but_toan_cho_xac_nhan')
      .select('*').order('created_at', { ascending: true })
    if (error) toast.error(loiTiengViet(error))
    setRows(data ?? []); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const duyet = async (r) => {
    setBusy(r.id)
    const { error } = await supabase.rpc('xac_nhan_but_toan', { p_payment_id: r.id })
    setBusy(null)
    if (error) return toast.error(loiTiengViet(error))
    toast.success(`Đã hạch toán ${vnd(r.amount)} đ vào đơn #${r.order_code}`)
    load(); onDone?.()
  }

  const guiTraLai = async () => {
    if (!lyDo.trim()) return toast.error('Nhập lý do để kinh doanh biết đường sửa.')
    setBusy(traLai.id)
    const { error } = await supabase.rpc('tra_lai_but_toan',
      { p_payment_id: traLai.id, p_ly_do: lyDo.trim() })
    setBusy(null)
    if (error) return toast.error(loiTiengViet(error))
    toast.success('Đã trả lại cho kinh doanh.')
    setTraLai(null); setLyDo(''); load(); onDone?.()
  }

  if (loading) return null
  if (!rows.length) return null

  const tong = rows.reduce((a, r) => a + Number(r.amount), 0)

  return (
    <>
      <Card className="mb-5 border-2 border-amber-300 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <Clock className="size-5" /> Kinh doanh báo tiền về · chờ xác nhận ({rows.length})
          </CardTitle>
          <CardDescription>
            Tổng <b className="num">{vnd(tong)} đ</b> đã được đối chiếu với bảng kê nhưng
            chưa hạch toán vào công nợ. Kiểm tra rồi bấm xác nhận.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.map(r => {
            const lech = r.bank_ref && Number(r.amount) !== Number(r.so_tien_ve)
            return (
              <div key={r.id} className="flex flex-col gap-3 rounded-xl border bg-background p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono font-semibold">#{r.order_code}</span>
                    <span className="truncate">{r.customer_name}</span>
                    <span className="num font-semibold text-emerald-700">{vnd(r.amount)} đ</span>
                    {lech && (
                      <Badge className="border-sky-200 bg-sky-50 text-sky-700">
                        một phần của {vnd(r.so_tien_ve)}
                      </Badge>
                    )}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Landmark className="size-3.5 shrink-0" />
                    {dmy(r.payment_date)} · {r.counterparty || '--'}
                    {r.bank_ref ? ` · ${r.bank_ref}` : ''}
                  </p>
                  {r.noi_dung_ck && (
                    <p className="truncate text-xs text-muted-foreground">{r.noi_dung_ck}</p>
                  )}
                  {r.note && <p className="text-xs text-sky-700">Kinh doanh ghi chú: {r.note}</p>}
                  <p className="text-[11px] text-muted-foreground">
                    {r.nguoi_ghi} gửi lúc {dmyhm(r.created_at)} · đơn còn nợ{' '}
                    <b className="num">{vnd(r.debt_amount)} đ</b>
                  </p>
                  {Number(r.amount) > Number(r.debt_amount) && (
                    <p className="flex items-center gap-1 text-xs text-orange-600">
                      <AlertTriangle className="size-3.5" /> Ghi vượt số còn nợ của đơn — kiểm tra lại.
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setTraLai(r); setLyDo('') }}>
                    <Undo2 className="size-4" /> Trả lại
                  </Button>
                  <Button size="sm" onClick={() => duyet(r)} disabled={busy === r.id}>
                    {busy === r.id
                      ? <Loader2 className="size-4 animate-spin" />
                      : <CheckCircle2 className="size-4" />}
                    Xác nhận
                  </Button>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Dialog open={!!traLai} onOpenChange={v => !v && setTraLai(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Trả lại bút toán · #{traLai?.order_code}</DialogTitle>
            <DialogDescription>
              Bút toán bị xóa khỏi đơn và ghi vào nhật ký. Khoản tiền về quay lại
              danh sách chờ để kinh doanh gắn lại cho đúng.
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={3} value={lyDo} onChange={e => setLyDo(e.target.value)}
            placeholder="vd: khoản này là của đơn 0132, không phải đơn này" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTraLai(null)}>Hủy</Button>
            <Button variant="destructive" onClick={guiTraLai} disabled={busy === traLai?.id}>
              <Undo2 className="size-4" /> Trả lại kinh doanh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

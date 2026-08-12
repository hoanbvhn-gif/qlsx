import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useOrders } from '@/hooks/useOrders'
import { useEntities } from '@/hooks/useEntities'
import PageHeader from '@/components/common/PageHeader'
import StatCard from '@/components/common/StatCard'
import EmptyState from '@/components/common/EmptyState'
import OrderDetailDialog from '@/components/common/OrderDetailDialog'
import EntitySwitch from '@/components/common/EntitySwitch'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { vnd, dmy, STATUS, payStatus } from '@/lib/format'
import { cn, noAccent } from '@/lib/utils'
import {
  Search, Eye, Trash2, AlertTriangle, Download, Receipt, Wallet, PackageX, RotateCcw,
  Phone, MapPin
} from 'lucide-react'
import { toast } from 'sonner'

export default function AllOrders() {
  const { profile } = useAuth()
  const isBoss = profile?.role === 'management'
  const canEdit = ['management', 'accounting'].includes(profile?.role)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [st, setSt] = useState('')
  const [dv, setDv] = useState('')
  const { entities } = useEntities()
  const [del, setDel] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [sel, setSel] = useState(null)

  const { orders } = useOrders()   // dung cho hop thoai chi tiet

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('v_tat_ca_don_hang')
      .select('*').order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    setRows(data ?? []); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const list = useMemo(() => {
    const key = noAccent(q)
    return rows.filter(r =>
      (!st || r.status === st) &&
      (!dv || r.entity_id === dv) &&
      (!key || noAccent(`${r.order_code} ${r.customer_name} ${r.sales_name ?? ''} ${r.customer_phone ?? ''} ${r.customer_address ?? ''}`).includes(key))
    )
  }, [rows, q, st, dv])

  const stat = useMemo(() => ({
    count: list.length,
    total: list.reduce((a, r) => a + Number(r.total_amount), 0),
    paid: list.reduce((a, r) => a + Number(r.paid_amount), 0),
    draft: list.filter(r => r.status === 'draft').length
  }), [list])

  const doDelete = async () => {
    if (!reason.trim()) return toast.error('Bắt buộc ghi lý do xóa.')
    setBusy(true)
    const { error: e1 } = await supabase.from('orders')
      .update({ delete_reason: reason.trim() }).eq('id', del.order_id)
    if (e1) { setBusy(false); return toast.error(e1.message) }
    const { error: e2 } = await supabase.from('orders').delete().eq('id', del.order_id)
    setBusy(false)
    if (e2) return toast.error(e2.message)
    toast.success(`Đã xóa đơn ${del.order_code} — thao tác lưu vào Nhật ký hệ thống`)
    setDel(null); setReason(''); load()
  }

  const exportCsv = () => {
    const head = ['Mã đơn', 'Ngày lập', 'Đơn vị xuất HĐ', 'Khách hàng', 'MST', 'Điện thoại', 'Địa chỉ', 'NVKD',
      'Trạng thái', 'Tiền hàng', 'VAT', 'Tổng tiền', 'Đã thu', 'Còn nợ', 'Số dòng hàng', 'Số file TK']
    const body = list.map(r => [r.order_code, dmy(r.order_date), r.entity_name ?? '', r.customer_name,
      r.customer_tax_code || r.tax_code || '', r.customer_phone ?? '', r.customer_address ?? '',
      r.sales_name ?? '', STATUS[r.status]?.label ?? r.status, r.subtotal, r.vat_amount,
      r.total_amount, r.paid_amount, r.debt_amount, r.so_dong_hang, r.so_file_thiet_ke])
    const csv = '﻿' + [head, ...body]
      .map(rr => rr.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `danh-sach-don-hang-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <>
      <PageHeader title="Quản lý đơn hàng"
        desc="Toàn bộ đơn hàng công ty — xem chi tiết, xuất báo cáo, xóa đơn nhập sai"
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={load}><RotateCcw className="size-4" /> Tải lại</Button>
            <Button variant="outline" onClick={exportCsv}><Download className="size-4" /> Xuất CSV</Button>
          </div>
        } />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Số đơn hàng" value={stat.count} icon={Receipt} sub={`${stat.draft} đơn nháp`} />
        <StatCard label="Tổng giá trị" value={vnd(stat.total)} icon={Wallet} />
        <StatCard label="Đã thu" value={vnd(stat.paid)} icon={Wallet} tone="text-emerald-600" />
        <StatCard label="Chênh lệch" value={vnd(stat.total - stat.paid)} icon={AlertTriangle} tone="text-amber-600"
          sub="gồm cả đơn chưa giao" />
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Tìm mã đơn / khách hàng / NVKD / số điện thoại / địa chỉ..."
              value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <Select className="sm:w-52" value={st} onChange={e => setSt(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <Select className="sm:w-48" value={dv} onChange={e => setDv(e.target.value)}>
            <option value="">Cả hai đơn vị</option>
            {entities.map(e => <option key={e.id} value={e.id}>{e.short_name}</option>)}
          </Select>
        </CardContent>
      </Card>

      {loading ? <Skeleton className="h-64 w-full" />
        : !list.length ? <EmptyState icon={PackageX} title="Không có đơn hàng"
            desc="Đổi bộ lọc để xem đơn khác." />
        : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã đơn</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead>NVKD</TableHead>
                <TableHead>Xuất HĐ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Tổng tiền</TableHead>
                <TableHead className="min-w-[170px]">Thanh toán</TableHead>
                <TableHead className="text-center">Dòng / File</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map(r => {
                const p = payStatus(r)
                return (
                  <TableRow key={r.order_id}>
                    <TableCell className="font-mono font-medium">
                      {r.order_code}
                      <span className="block font-sans text-xs text-muted-foreground">{dmy(r.order_date)}</span>
                    </TableCell>
                    <TableCell className="min-w-[260px]">
                      <p className="font-medium">{r.customer_name}</p>
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        {(r.customer_tax_code || r.tax_code) && (
                          <p>MST {r.customer_tax_code || r.tax_code}</p>
                        )}
                        {r.customer_phone && (
                          <p className="flex items-center gap-1">
                            <Phone className="size-3 shrink-0" /> {r.customer_phone}
                          </p>
                        )}
                        {r.customer_address && (
                          <p className="flex items-start gap-1">
                            <MapPin className="mt-0.5 size-3 shrink-0" />
                            <span className="line-clamp-2">{r.customer_address}</span>
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.sales_name || '--'}</TableCell>
                    <TableCell>
                      <EntitySwitch order={r} canEdit={canEdit} onChanged={load} />
                    </TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="num text-right font-medium">{vnd(r.total_amount)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge className={p.tone}>{p.label}</Badge>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className={cn('h-full rounded-full', p.bar)} style={{ width: `${p.pct}%` }} />
                        </div>
                        {p.debt > 0 && <p className="num text-[11px] text-rose-600">còn {vnd(p.debt)}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {r.so_dong_hang} / {r.so_file_thiet_ke}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost"
                          onClick={() => setSel(orders.find(o => o.id === r.order_id) ?? null)}>
                          <Eye className="size-4" />
                        </Button>
                        {isBoss && (
                          <Button size="sm" variant="ghost" className="text-destructive"
                            onClick={() => { setDel(r); setReason('') }}>
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

      <OrderDetailDialog order={sel} open={!!sel} onOpenChange={v => !v && setSel(null)} />

      {/* ----- Xoa don hang ----- */}
      <Dialog open={!!del} onOpenChange={v => !busy && !v && setDel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Xóa đơn hàng
            </DialogTitle>
          </DialogHeader>

          {del && (
            <>
              <div className="space-y-1 rounded-xl border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between"><span>Mã đơn</span><b className="font-mono">{del.order_code}</b></div>
                <div className="flex justify-between"><span>Khách hàng</span><b className="truncate">{del.customer_name}</b></div>
                <div className="flex justify-between"><span>Trạng thái</span><StatusBadge status={del.status} /></div>
                <div className="flex justify-between text-base"><span>Tổng tiền</span><b className="num">{vnd(del.total_amount)} đ</b></div>
              </div>

              <div className="space-y-1.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                <p className="font-semibold">Xóa đơn sẽ xóa theo:</p>
                <ul className="ml-4 list-disc text-xs">
                  <li>{del.so_dong_hang} dòng hàng hóa</li>
                  <li>{del.so_file_thiet_ke} liên kết file thiết kế</li>
                  <li>{del.so_but_toan} bút toán thu tiền
                    {Number(del.paid_amount) > 0 && <b> (đã thu {vnd(del.paid_amount)} đ)</b>}</li>
                </ul>
                <p className="pt-1 font-semibold">Không hoàn tác được.</p>
              </div>

              {Number(del.paid_amount) > 0 && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
                  <b>Cân nhắc kỹ:</b> đơn này đã phát sinh tiền thu thật. Xóa đi thì số liệu thu tiền
                  của kỳ sẽ giảm theo. Nếu chỉ muốn ngừng theo dõi, nên chuyển đơn sang trạng thái
                  <b> Đã hủy</b> thay vì xóa.
                </p>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <Label>Lý do xóa *</Label>
            <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
              placeholder="vd: Đơn nhập thử để kiểm tra hệ thống, không phải đơn thật" />
            <p className="text-xs text-muted-foreground">
              Lý do và toàn bộ nội dung đơn được ghi vĩnh viễn vào Nhật ký hệ thống.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDel(null)} disabled={busy}>Hủy bỏ</Button>
            <Button variant="destructive" onClick={doDelete} disabled={busy || !reason.trim()}>
              <Trash2 className="size-4" /> Xóa vĩnh viễn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

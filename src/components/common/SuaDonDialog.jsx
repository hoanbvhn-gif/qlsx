import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import ProductSearchBox from '@/components/common/ProductSearchBox'
import MstInput from '@/components/common/MstInput'
import { useItems } from '@/hooks/useItems'
import { vnd, parseNum, loiTiengViet } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Loader2, Plus, Trash2, Save, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

const UNITS = ['Cái', 'Bộ', 'Chiếc', 'Kg', 'Tấn', 'Mét', 'M2', 'Thùng', 'Hộp', 'Tờ']
const VAT_RATES = [0, 5, 8, 10]

const dongTrong = () => ({
  key: crypto.randomUUID(), id: null,
  item_code: '', item_name: '', quantity: '1', unit: 'Cái',
  unit_price: '', vat_rate: 8, delivery_date: ''
})

/**
 * SUA DON HANG — dung duoc cho toi truoc khi giao hang.
 *
 * Thuc te xuong in: khach doi so luong, doi kich thuoc, chot lai gia sau khi
 * don da xuong San xuat la chuyen thuong ngay. Bat lam don moi thi vua mat
 * so lieu vua sai thuc te.
 *
 * Doi lai: sua don DA DUYET deu de lai dau vet trong Nhat ky he thong,
 * va neu sua vuot nguong tu duyet thi don quay ve cho Ke toan duyet lai.
 */
export default function SuaDonDialog({ order, open, onOpenChange, onSaved }) {
  const { items: catalog } = useItems({ onlyApproved: true })
  const [lines, setLines] = useState([])
  const [head, setHead] = useState({
    customer_name: '', customer_tax_code: '', customer_address: '', customer_phone: '', note: ''
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !order) return
    setLines((order.order_items ?? [])
      .slice().sort((a, b) => a.line_no - b.line_no)
      .map(it => ({
        key: crypto.randomUUID(), id: it.id,
        item_code: it.item_code ?? '', item_name: it.item_name ?? '',
        quantity: String(it.quantity ?? ''), unit: it.unit || 'Cái',
        unit_price: String(it.unit_price ?? ''), vat_rate: Number(it.vat_rate ?? 8),
        delivery_date: it.delivery_date ?? ''
      })))
    setHead({
      customer_name: order.customer_name ?? '',
      customer_tax_code: order.customer_tax_code ?? '',
      customer_address: order.customer_address ?? '',
      customer_phone: order.customer_phone ?? '',
      note: order.note ?? ''
    })
  }, [open, order?.id])

  const tong = useMemo(() => {
    let sub = 0, vat = 0
    for (const l of lines) {
      const t = parseNum(l.quantity) * parseNum(l.unit_price)
      sub += t; vat += t * (Number(l.vat_rate) || 0) / 100
    }
    return { sub, vat, total: sub + vat }
  }, [lines])

  if (!order) return null

  const tongCu = Number(order.total_amount ?? 0)
  const daThu = Number(order.paid_amount ?? 0)
  const chenh = tong.total - tongCu
  const daDuyet = ['approved', 'in_production', 'completed'].includes(order.status)

  const setLine = (key, patch) =>
    setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)))
  const xoaDong = (key) => setLines(ls => ls.filter(l => l.key !== key))

  const themTuDanhMuc = (it) => setLines(ls => [...ls, {
    ...dongTrong(),
    item_code: it.item_code, item_name: it.item_name,
    unit: it.unit || 'Cái',
    unit_price: it.list_price > 0 ? String(it.list_price) : '',
    vat_rate: lines[0]?.vat_rate ?? 8
  }])

  const luu = async () => {
    const hopLe = lines.filter(l => l.item_name.trim() && parseNum(l.quantity) > 0)
    if (!hopLe.length) return toast.error('Đơn phải còn ít nhất 1 dòng hàng hóa.')
    if (!head.customer_name.trim()) return toast.error('Chưa có tên khách hàng.')
    if (daThu > 0 && tong.total < daThu) {
      return toast.error(
        `Đơn đã thu ${vnd(daThu)} đ mà tổng mới chỉ ${vnd(tong.total)} đ. ` +
        'Sửa xuống thấp hơn số đã thu sẽ thành thừa tiền — nhờ Kế toán xử lý khoản hoàn trả trước.')
    }

    setBusy(true)
    try {
      // 1. Thong tin chung cua don
      const { error: eH } = await supabase.from('orders').update({
        customer_name: head.customer_name.trim(),
        customer_tax_code: head.customer_tax_code.trim() || null,
        customer_address: head.customer_address.trim() || null,
        customer_phone: head.customer_phone.trim() || null,
        note: head.note.trim() || null
      }).eq('id', order.id)
      if (eH) throw eH

      // 2. Dong hang hoa: ghi lai toan bo trong MOT giao dich.
      //    Lam hai buoc roi ma dut giua chung thi don mat sach hang hoa.
      const { error: eI } = await supabase.rpc('ghi_lai_dong_hang', {
        p_order: order.id,
        p_items: hopLe.map(l => ({
          item_code: l.item_code || '',
          item_name: l.item_name.trim(),
          quantity: parseNum(l.quantity),
          unit: l.unit,
          unit_price: parseNum(l.unit_price),
          vat_rate: Number(l.vat_rate) || 0,
          delivery_date: l.delivery_date || ''
        }))
      })
      if (eI) throw eI

      // 3. Doc lai xem he thong co tra don ve cho duyet khong
      const { data: sau } = await supabase.from('orders')
        .select('status, total_amount').eq('id', order.id).maybeSingle()

      toast.success(sau?.status === 'pending_accounting' && daDuyet
        ? `Đã sửa đơn ${order.order_code}. Tổng vượt ngưỡng tự duyệt nên đơn quay về chờ Kế toán duyệt lại.`
        : `Đã sửa đơn ${order.order_code} — tổng mới ${vnd(sau?.total_amount ?? tong.total)} đ`)
      onSaved?.()
      onOpenChange(false)
    } catch (e) {
      toast.error(loiTiengViet(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sửa đơn hàng · #{order.order_code}</DialogTitle>
          <DialogDescription>
            Sửa được cho tới trước khi giao hàng. Đơn đã giao thì phải nhờ Kế toán điều chỉnh.
          </DialogDescription>
        </DialogHeader>

        {daDuyet && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Đơn này <b>đã duyệt</b>{order.status === 'in_production' ? ' và đang ở Sản xuất' : ''}.
              Mọi thay đổi tổng tiền đều được ghi vào Nhật ký hệ thống kèm tên người sửa.
              {daThu > 0 && <> Đơn đã thu <b>{vnd(daThu)} đ</b> — sửa xong nhớ kiểm lại công nợ.</>}
            </span>
          </p>
        )}

        {/* ---------- Khach hang ---------- */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 lg:col-span-2">
            <Label>Tên khách hàng</Label>
            <Input value={head.customer_name}
              onChange={e => setHead(h => ({ ...h, customer_name: e.target.value }))} />
          </div>
          <MstInput
            value={head.customer_tax_code}
            tenHienTai={head.customer_name}
            onChange={v => setHead(h => ({ ...h, customer_tax_code: v }))}
            onFound={r => setHead(h => ({
              ...h, customer_name: r.ten,
              customer_address: h.customer_address?.trim() ? h.customer_address : (r.diaChi ?? '')
            }))}
            onRevert={ten => setHead(h => ({ ...h, customer_name: ten }))} />
          <div className="space-y-1.5">
            <Label>Điện thoại</Label>
            <Input value={head.customer_phone}
              onChange={e => setHead(h => ({ ...h, customer_phone: e.target.value }))} />
          </div>
          <div className="space-y-1.5 lg:col-span-4">
            <Label>Địa chỉ</Label>
            <Input value={head.customer_address}
              onChange={e => setHead(h => ({ ...h, customer_address: e.target.value }))} />
          </div>
        </div>

        {/* ---------- Hang hoa ---------- */}
        <div className="space-y-2">
          <Label>Thêm hàng hóa từ danh mục</Label>
          <ProductSearchBox items={catalog} onAdd={themTuDanhMuc} />
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Mã hàng</TableHead>
                <TableHead className="min-w-[200px]">Tên hàng hóa</TableHead>
                <TableHead className="w-24 text-right">SL</TableHead>
                <TableHead className="w-24">ĐVT</TableHead>
                <TableHead className="w-32 text-right">Đơn giá</TableHead>
                <TableHead className="w-20">VAT</TableHead>
                <TableHead className="w-36">Ngày giao</TableHead>
                <TableHead className="w-32 text-right">Thành tiền</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map(l => (
                <TableRow key={l.key}>
                  <TableCell className="font-mono text-xs">{l.item_code || '--'}</TableCell>
                  <TableCell>
                    <Input value={l.item_name}
                      onChange={e => setLine(l.key, { item_name: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input className="text-right" inputMode="decimal" value={l.quantity}
                      onChange={e => setLine(l.key, { quantity: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Select value={l.unit} onChange={e => setLine(l.key, { unit: e.target.value })}>
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input className="text-right" inputMode="decimal" value={l.unit_price}
                      onChange={e => setLine(l.key, { unit_price: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Select value={l.vat_rate}
                      onChange={e => setLine(l.key, { vat_rate: Number(e.target.value) })}>
                      {VAT_RATES.map(v => <option key={v} value={v}>{v}%</option>)}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input type="date" value={l.delivery_date ?? ''}
                      onChange={e => setLine(l.key, { delivery_date: e.target.value })} />
                  </TableCell>
                  <TableCell className="num text-right font-medium">
                    {vnd(parseNum(l.quantity) * parseNum(l.unit_price))}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="text-destructive"
                      onClick={() => xoaDong(l.key)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Button variant="outline" size="sm" onClick={() => setLines(ls => [...ls, dongTrong()])}>
          <Plus className="size-4" /> Thêm dòng trống
        </Button>

        <div className="space-y-1.5">
          <Label>Ghi chú đơn hàng</Label>
          <Textarea rows={2} value={head.note}
            onChange={e => setHead(h => ({ ...h, note: e.target.value }))} />
        </div>

        {/* ---------- Doi chieu truoc va sau ---------- */}
        <div className="grid gap-2 rounded-xl border p-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Tổng cũ</p>
            <p className="num font-semibold">{vnd(tongCu)} đ</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tổng mới</p>
            <p className="num font-semibold">{vnd(tong.total)} đ</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Chênh lệch</p>
            <p className={cn('num font-semibold',
              chenh > 0 ? 'text-rose-600' : chenh < 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
              {chenh > 0 ? '+' : ''}{vnd(chenh)} đ
            </p>
          </div>
        </div>

        {daThu > 0 && (
          <p className="num rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
            Đã thu <b className="text-emerald-700">{vnd(daThu)} đ</b> ·
            còn nợ sau khi sửa{' '}
            <b className={tong.total - daThu > 0 ? 'text-rose-600' : 'text-emerald-600'}>
              {vnd(tong.total - daThu)} đ
            </b>
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={luu} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

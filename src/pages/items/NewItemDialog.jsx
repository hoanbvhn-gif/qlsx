import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { buildItemCode, buildItemName } from '@/hooks/useItems'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { parseNum, vnd } from '@/lib/format'
import { Loader2, Save, Info } from 'lucide-react'
import { toast } from 'sonner'

const EMPTY = { material_code: '', process_code: '', thickness_code: '', size_code: '', unit: 'Cái', list_price: '', note: '' }

export default function NewItemDialog({ open, onOpenChange, cat, isBoss, userId, onSaved }) {
  const [f, setF] = useState(EMPTY)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) setF(EMPTY) }, [open])

  const code = buildItemCode(f.material_code, f.process_code, f.thickness_code, f.size_code)
  const ready = f.material_code && f.process_code && f.thickness_code && f.size_code

  // Ten san pham sinh HOAN TOAN tu ma — khong co o nhap tay nen khong the trung
  const autoName = useMemo(() => buildItemName(cat, f), [cat, f])

  const save = async () => {
    if (!ready) return toast.error('Chọn đủ 4 thành phần của mã hàng.')
    setBusy(true)
    const { error } = await supabase.from('items').insert({
      material_code: f.material_code,
      process_code: f.process_code,
      thickness_code: f.thickness_code,
      size_code: f.size_code,
      item_name: autoName,          // database van tu sinh lai, day chi la gia tri tam
      unit: f.unit,
      list_price: parseNum(f.list_price),
      note: f.note || null,
      status: isBoss ? 'approved' : 'pending',
      created_by: userId
    })
    setBusy(false)
    if (error) {
      if (/uq_items_(code|combo)/.test(error.message))
        return toast.error(`Mã ${code} đã tồn tại trong danh mục.`)
      return toast.error(error.message)
    }
    toast.success(isBoss ? `Đã thêm mã ${code}` : `Đã gửi đề xuất mã ${code}, chờ Giám đốc duyệt`)
    onSaved?.(); onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isBoss ? 'Thêm mã hàng' : 'Đề xuất mã hàng mới'}</DialogTitle>
          <DialogDescription>Chọn đủ 4 thành phần, mã sẽ tự ghép</DialogDescription>
        </DialogHeader>

        {/* Xem truoc ma */}
        <div className="space-y-1 rounded-xl border bg-muted/40 p-3 text-center">
          <p className="text-xs text-muted-foreground">Mã hàng</p>
          <p className="font-mono text-2xl font-bold tracking-tight">{code}</p>
          <div className="border-t pt-2">
            <p className="text-xs text-muted-foreground">Tên sản phẩm (tự sinh từ mã)</p>
            <p className="font-medium">{autoName || '—'}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Fld label="Chất liệu *">
            <Select value={f.material_code} onChange={e => setF({ ...f, material_code: e.target.value })}>
              <option value="">-- chọn --</option>
              {cat.materials.filter(x => x.is_active).map(m =>
                <option key={m.code} value={m.code}>{m.code} · {m.name}</option>)}
            </Select>
          </Fld>
          <Fld label="Kiểu gia công *">
            <Select value={f.process_code} onChange={e => setF({ ...f, process_code: e.target.value })}>
              <option value="">-- chọn --</option>
              {cat.processes.filter(x => x.is_active).map(p =>
                <option key={p.code} value={p.code}>{p.code} · {p.name}</option>)}
            </Select>
          </Fld>
          <Fld label="Độ dày *">
            <Select value={f.thickness_code} onChange={e => setF({ ...f, thickness_code: e.target.value })}>
              <option value="">-- chọn --</option>
              {cat.thicknesses.filter(x => x.is_active).map(t =>
                <option key={t.code} value={t.code}>{t.code} · {t.name}</option>)}
            </Select>
          </Fld>
          <Fld label="Kích thước *">
            <Select value={f.size_code} onChange={e => setF({ ...f, size_code: e.target.value })}>
              <option value="">-- chọn --</option>
              {cat.sizes.filter(x => x.is_active).map(s =>
                <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
            </Select>
          </Fld>

          <Fld label="Đơn vị tính">
            <Select value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })}>
              {['Cái', 'Bộ', 'Chiếc', 'Tờ', 'M2', 'Kg'].map(u => <option key={u}>{u}</option>)}
            </Select>
          </Fld>
          <Fld label="Đơn giá niêm yết">
            <Input inputMode="decimal" value={f.list_price} placeholder="0"
              onChange={e => setF({ ...f, list_price: e.target.value })} />
          </Fld>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Ghi chú</Label>
            <Textarea rows={2} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
          </div>
        </div>

        {parseNum(f.list_price) > 0 && (
          <p className="text-right text-sm text-muted-foreground">
            Đơn giá: <b className="num text-foreground">{vnd(parseNum(f.list_price))} đ</b>
          </p>
        )}

        {!isBoss && (
          <p className="flex gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
            <Info className="size-4 shrink-0" />
            Mã bạn tạo ở trạng thái <b>Chờ duyệt</b> và chưa dùng được khi lập đơn.
            Ban Giám đốc duyệt xong mới có hiệu lực.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={save} disabled={busy || !ready}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {isBoss ? 'Thêm mã' : 'Gửi đề xuất'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const Fld = ({ label, children }) => (
  <div className="space-y-1.5"><Label>{label}</Label>{children}</div>
)

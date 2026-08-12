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
import { parseNum, vnd, loiTiengViet } from '@/lib/format'
import { Loader2, Save, Info, Plus, X, Check } from 'lucide-react'
import { toast } from 'sonner'

const EMPTY = { material_code: '', process_code: '', thickness_code: '', size_code: '', unit: 'Cái', list_price: '', note: '' }

export default function NewItemDialog({ open, onOpenChange, cat, isBoss, userId, onSaved }) {
  const [f, setF] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [quick, setQuick] = useState(null)   // 'size' | 'thickness' | null

  useEffect(() => { if (open) { setF(EMPTY); setQuick(null) } }, [open])

  /* ---------- Tao nhanh KICH THUOC ngay tai day ---------- */
  const addSize = async ({ name, width_mm, height_mm }) => {
    if (!name.trim()) { toast.error('Nhập tên kích thước, ví dụ 50x200mm'); return null }
    const nums = cat.sizes.map(x => parseInt(x.code, 10)).filter(n => !isNaN(n))
    const code = String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0')
    const { error } = await supabase.from('item_sizes').insert({
      code, name: name.trim(),
      width_mm: parseFloat(width_mm) || null,
      height_mm: parseFloat(height_mm) || null,
      sort_order: (cat.sizes.length + 1) * 10
    })
    if (error) {
      toast.error(/row-level security/i.test(error.message)
        ? 'Bạn không có quyền thêm kích thước. Nhờ Kế toán hoặc Giám đốc.'
        : error.message)
      return null
    }
    toast.success(`Đã thêm kích thước ${code} · ${name.trim()}`)
    await cat.reload()
    return code
  }

  /* ---------- Tao nhanh DO DAY ---------- */
  const addThickness = async ({ value_mm }) => {
    const v = parseFloat(String(value_mm).replace(',', '.'))
    if (isNaN(v) || v <= 0) { toast.error('Nhập độ dày hợp lệ, ví dụ 0.65'); return null }
    if (v > 9.99) { toast.error('Độ dày tối đa 9.99mm với mã 3 số.'); return null }
    const code = String(Math.round(v * 100)).padStart(3, '0')
    const { error } = await supabase.from('item_thicknesses').insert({
      code, value_mm: v, name: `${v}mm`, sort_order: Math.round(v * 100)
    })
    if (error) {
      if (/duplicate key/.test(error.message)) { toast.error(`Độ dày ${v}mm đã có trong danh mục.`); return null }
      toast.error(/row-level security/i.test(error.message)
        ? 'Bạn không có quyền thêm độ dày. Nhờ Kế toán hoặc Giám đốc.'
        : error.message)
      return null
    }
    toast.success(`Đã thêm độ dày ${code} · ${v}mm`)
    await cat.reload()
    return code
  }

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
    if (error) return toast.error(loiTiengViet(error))
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
          <Fld label="Độ dày *" onAdd={() => setQuick(quick === 'thickness' ? null : 'thickness')}>
            <Select value={f.thickness_code} onChange={e => setF({ ...f, thickness_code: e.target.value })}>
              <option value="">-- chọn --</option>
              {cat.thicknesses.filter(x => x.is_active).map(t =>
                <option key={t.code} value={t.code}>{t.code} · {t.name}</option>)}
            </Select>
          </Fld>
          <Fld label="Kích thước *" onAdd={() => setQuick(quick === 'size' ? null : 'size')}>
            <Select value={f.size_code} onChange={e => setF({ ...f, size_code: e.target.value })}>
              <option value="">-- chọn --</option>
              {cat.sizes.filter(x => x.is_active).map(s =>
                <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
            </Select>
          </Fld>

          {quick === 'thickness' && (
            <QuickAdd title="Thêm độ dày mới" onClose={() => setQuick(null)}
              fields={[{ k: 'value_mm', ph: 'Độ dày (mm) — vd 0.65', autoFocus: true }]}
              hint="Mã tự tính = mm × 100. Nhập 0.65 sẽ ra mã 065."
              onSave={async (v) => {
                const code = await addThickness(v)
                if (code) { setF(x => ({ ...x, thickness_code: code })); setQuick(null) }
              }} />
          )}

          {quick === 'size' && (
            <QuickAdd title="Thêm kích thước mới" onClose={() => setQuick(null)}
              fields={[
                { k: 'name', ph: 'Tên kích thước — vd 50x200mm', autoFocus: true },
                { k: 'width_mm', ph: 'Rộng (mm)' },
                { k: 'height_mm', ph: 'Cao (mm)' }
              ]}
              hint="Mã tự tăng theo thứ tự: 002, 003, 004..."
              onSave={async (v) => {
                const code = await addSize(v)
                if (code) { setF(x => ({ ...x, size_code: code })); setQuick(null) }
              }} />
          )}

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

const Fld = ({ label, children, onAdd }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      {onAdd && (
        <button type="button" onClick={onAdd}
          className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
          <Plus className="size-3" /> Thêm
        </button>
      )}
    </div>
    {children}
  </div>
)

/** Form tao nhanh mot muc danh muc ngay trong hop thoai them ma hang */
function QuickAdd({ title, fields, hint, onSave, onClose }) {
  const [v, setV] = useState({})
  const [busy, setBusy] = useState(false)
  const submit = async () => { setBusy(true); await onSave(v); setBusy(false) }
  return (
    <div className="space-y-2 rounded-xl border-2 border-primary/30 bg-primary/5 p-3 sm:col-span-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {fields.map((fl, i) => (
          <Input key={fl.k} placeholder={fl.ph} autoFocus={fl.autoFocus}
            className={i === 0 && fields.length === 3 ? 'sm:col-span-3' : ''}
            value={v[fl.k] ?? ''} onChange={e => setV({ ...v, [fl.k]: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }} />
        ))}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <Button size="sm" onClick={submit} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        Lưu &amp; chọn luôn
      </Button>
    </div>
  )
}

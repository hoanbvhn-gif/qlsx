import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Plus, Loader2, Lock, Unlock, Info } from 'lucide-react'
import { toast } from 'sonner'

/** Sinh ma tiep theo dang so: 001 -> 002. Do dai giu nguyen. */
const nextNumeric = (list, len) => {
  const nums = list.map(x => parseInt(x.code, 10)).filter(n => !isNaN(n))
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return String(next).padStart(len, '0')
}

const GROUPS = [
  {
    table: 'item_materials', key: 'materials', title: 'Chất liệu', width: 2,
    desc: 'Mã 2 ký tự chữ — AL, IN, CU...', codeMode: 'text',
    fields: [{ k: 'name', label: 'Tên chất liệu', ph: 'vd: Nhôm' }]
  },
  {
    table: 'item_processes', key: 'processes', title: 'Kiểu gia công', width: 2,
    desc: 'Mã 2 ký tự chữ — AM (ăn mòn), UV (in UV)...', codeMode: 'text',
    fields: [{ k: 'name', label: 'Tên kiểu gia công', ph: 'vd: Khắc laser' }]
  },
  {
    table: 'item_thicknesses', key: 'thicknesses', title: 'Độ dày', width: 3,
    desc: 'Mã = mm × 100. Nhập số mm, mã tự tính.', codeMode: 'thickness',
    fields: [{ k: 'value_mm', label: 'Độ dày (mm)', ph: 'vd: 0.65' }]
  },
  {
    table: 'item_sizes', key: 'sizes', title: 'Kích thước', width: 3,
    desc: 'Mã tự tăng 001, 002... Thêm cỡ mới chỉ cần 1 dòng.', codeMode: 'auto',
    fields: [
      { k: 'name', label: 'Tên kích thước', ph: 'vd: 50x200mm' },
      { k: 'width_mm', label: 'Rộng (mm)', ph: '50' },
      { k: 'height_mm', label: 'Cao (mm)', ph: '200' }
    ]
  }
]

export default function CatalogManager({ cat, isBoss }) {
  if (cat.loading) return <Skeleton className="h-64 w-full" />
  return (
    <div className="space-y-5">
      {!isBoss && (
        <p className="flex gap-2 rounded-xl border bg-muted/50 p-3 text-sm text-muted-foreground">
          <Info className="size-4 shrink-0" />
          Chỉ Ban Giám đốc được sửa danh mục thành phần. Bạn đang ở chế độ chỉ xem.
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {GROUPS.map(g => (
          <Section key={g.key} g={g} list={cat[g.key]} isBoss={isBoss} reload={cat.reload} />
        ))}
      </div>
    </div>
  )
}

function Section({ g, list, isBoss, reload }) {
  const [f, setF] = useState({ code: '', name: '', value_mm: '', width_mm: '', height_mm: '' })
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)

  const previewCode = (() => {
    if (g.codeMode === 'auto') return nextNumeric(list, g.width)
    if (g.codeMode === 'thickness') {
      const v = parseFloat(String(f.value_mm).replace(',', '.'))
      if (isNaN(v)) return '---'
      return String(Math.round(v * 100)).padStart(3, '0')
    }
    return (f.code || '').toUpperCase().padEnd(g.width, '·').slice(0, g.width)
  })()

  const add = async () => {
    const row = { sort_order: (list.length + 1) * 10 }

    if (g.codeMode === 'auto') {
      row.code = nextNumeric(list, g.width)
      if (!f.name.trim()) return toast.error('Nhập tên kích thước.')
      row.name = f.name.trim()
      row.width_mm = parseFloat(f.width_mm) || null
      row.height_mm = parseFloat(f.height_mm) || null
    } else if (g.codeMode === 'thickness') {
      const v = parseFloat(String(f.value_mm).replace(',', '.'))
      if (isNaN(v) || v < 0) return toast.error('Nhập độ dày hợp lệ, ví dụ 0.65')
      if (v > 9.99) return toast.error('Độ dày tối đa 9.99mm với mã 3 số.')
      row.code = String(Math.round(v * 100)).padStart(3, '0')
      row.value_mm = v
      row.name = `${v}mm`
      row.sort_order = Math.round(v * 100)
    } else {
      const c = (f.code || '').trim().toUpperCase()
      if (c.length !== g.width) return toast.error(`Mã phải đúng ${g.width} ký tự.`)
      if (!/^[A-Z]+$/.test(c)) return toast.error('Mã chỉ gồm chữ cái A-Z.')
      if (!f.name.trim()) return toast.error('Nhập tên.')
      row.code = c
      row.name = f.name.trim()
    }

    setBusy(true)
    const { error } = await supabase.from(g.table).insert(row)
    setBusy(false)
    if (error) {
      if (/duplicate key/.test(error.message)) return toast.error(`Mã ${row.code} đã tồn tại.`)
      return toast.error(error.message)
    }
    toast.success(`Đã thêm ${row.code} · ${row.name}`)
    setF({ code: '', name: '', value_mm: '', width_mm: '', height_mm: '' })
    setAdding(false)
    reload()
  }

  const toggleActive = async (row) => {
    const { error } = await supabase.from(g.table).update({ is_active: !row.is_active }).eq('code', row.code)
    if (error) return toast.error(error.message)
    reload()
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>{g.title} <span className="text-muted-foreground">({list.length})</span></CardTitle>
          <CardDescription>{g.desc}</CardDescription>
        </div>
        {isBoss && !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Thêm
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && isBoss && (
          <div className="space-y-2 rounded-xl border bg-muted/40 p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Mã sẽ là</span>
              <code className="rounded bg-background px-2 py-1 font-mono text-sm font-bold">{previewCode}</code>
              {g.codeMode !== 'text' && <span className="text-xs text-muted-foreground">(tự sinh)</span>}
            </div>
            {g.codeMode === 'text' && (
              <Input placeholder={`Mã ${g.width} ký tự`} maxLength={g.width} className="font-mono uppercase"
                value={f.code} onChange={e => setF({ ...f, code: e.target.value.toUpperCase() })} />
            )}
            {g.fields.map(fl => (
              <Input key={fl.k} placeholder={fl.ph} value={f[fl.k]}
                onChange={e => setF({ ...f, [fl.k]: e.target.value })} />
            ))}
            <div className="flex gap-2">
              <Button size="sm" onClick={add} disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />} Lưu
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Hủy</Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {list.map(x => (
            <button key={x.code} type="button" disabled={!isBoss}
              onClick={() => isBoss && toggleActive(x)}
              className={cn('flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition',
                x.is_active ? 'bg-background' : 'bg-muted opacity-50 line-through',
                isBoss && 'hover:bg-accent')}>
              <code className="font-mono font-bold">{x.code}</code>
              <span>{x.name}</span>
              {isBoss && (x.is_active
                ? <Unlock className="size-3 text-emerald-600" />
                : <Lock className="size-3 text-muted-foreground" />)}
            </button>
          ))}
        </div>

        {isBoss && (
          <p className="text-xs text-muted-foreground">
            Bấm vào một mục để tạm khóa — mục bị khóa không hiện khi tạo mã mới,
            nhưng mã cũ đã dùng vẫn giữ nguyên.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

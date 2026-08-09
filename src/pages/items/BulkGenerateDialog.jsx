import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Loader2, Layers, Check } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Sinh ma hang loat theo TO HOP.
 * Vi du: chon Nhom + An mon + 5 do day + 2 kich thuoc  ->  10 ma trong 1 lan bam.
 * Ma da ton tai se tu dong bo qua.
 */
export default function BulkGenerateDialog({ open, onOpenChange, cat, existing, userId, onSaved }) {
  const [mats, setMats] = useState([])
  const [procs, setProcs] = useState([])
  const [thicks, setThicks] = useState([])
  const [sizes, setSizes] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) { setMats([]); setProcs([]); setThicks([]); setSizes([]) }
  }, [open])

  const toggle = (arr, setArr, code) =>
    setArr(arr.includes(code) ? arr.filter(x => x !== code) : [...arr, code])

  const have = useMemo(
    () => new Set(existing.map(i => `${i.material_code}${i.process_code}${i.thickness_code}${i.size_code}`)),
    [existing])

  const combos = useMemo(() => {
    const out = []
    for (const m of mats) for (const p of procs) for (const t of thicks) for (const s of sizes)
      out.push({ material_code: m, process_code: p, thickness_code: t, size_code: s, code: `${m}${p}${t}${s}` })
    return out
  }, [mats, procs, thicks, sizes])

  const fresh = combos.filter(c => !have.has(c.code))
  const dup = combos.length - fresh.length

  const generate = async () => {
    if (!fresh.length) return toast.error('Không có mã mới nào để tạo.')
    setBusy(true)
    const payload = fresh.map(c => ({
      material_code: c.material_code, process_code: c.process_code,
      thickness_code: c.thickness_code, size_code: c.size_code,
      item_name: '',            // trigger ben database tu dat ten
      status: 'approved', created_by: userId
    }))
    const { error } = await supabase.from('items').insert(payload)
    setBusy(false)
    if (error) return toast.error(error.message)
    toast.success(`Đã tạo ${fresh.length} mã hàng mới`)
    onSaved?.(); onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sinh mã hàng loạt theo tổ hợp</DialogTitle>
          <DialogDescription>
            Tích chọn nhiều thành phần — hệ thống nhân chéo và tạo toàn bộ mã còn thiếu
          </DialogDescription>
        </DialogHeader>

        <Group label="Chất liệu" list={cat.materials} sel={mats}
          onToggle={c => toggle(mats, setMats, c)} />
        <Group label="Kiểu gia công" list={cat.processes} sel={procs}
          onToggle={c => toggle(procs, setProcs, c)} />
        <Group label="Độ dày" list={cat.thicknesses} sel={thicks}
          onToggle={c => toggle(thicks, setThicks, c)} />
        <Group label="Kích thước" list={cat.sizes} sel={sizes}
          onToggle={c => toggle(sizes, setSizes, c)} />

        <div className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/40 p-3 text-center">
          <Stat k="Tổ hợp" v={combos.length} />
          <Stat k="Tạo mới" v={fresh.length} tone="text-emerald-600" />
          <Stat k="Đã có, bỏ qua" v={dup} tone="text-muted-foreground" />
        </div>

        {!!fresh.length && (
          <div className="max-h-40 overflow-y-auto rounded-xl border p-2.5">
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Mã sẽ được tạo</p>
            <div className="flex flex-wrap gap-1">
              {fresh.slice(0, 120).map(c => (
                <code key={c.code} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{c.code}</code>
              ))}
              {fresh.length > 120 && (
                <span className="text-xs text-muted-foreground">+{fresh.length - 120} mã nữa</span>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={generate} disabled={busy || !fresh.length}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Layers className="size-4" />}
            Tạo {fresh.length} mã
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Group({ label, list, sel, onToggle }) {
  const active = list.filter(x => x.is_active)
  const all = active.length > 0 && sel.length === active.length
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label} <span className="text-muted-foreground">({sel.length})</span></Label>
        <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => active.forEach(x => { if (all === sel.includes(x.code)) onToggle(x.code) })}>
          {all ? 'Bỏ chọn hết' : 'Chọn hết'}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {active.map(x => {
          const on = sel.includes(x.code)
          return (
            <button key={x.code} type="button" onClick={() => onToggle(x.code)}
              className={cn('flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
                on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent')}>
              {on && <Check className="size-3" />}
              <span className="font-mono">{x.code}</span>
              <span className="opacity-80">{x.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const Stat = ({ k, v, tone = '' }) => (
  <div><p className="text-xs text-muted-foreground">{k}</p><p className={cn('text-xl font-bold', tone)}>{v}</p></div>
)

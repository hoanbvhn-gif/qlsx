import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEntities } from '@/hooks/useEntities'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { loiTiengViet } from '@/lib/format'
import { Building2, Store, Save, Loader2, Star, Info } from 'lucide-react'
import { toast } from 'sonner'

const ICON = { CT: Building2, HKD: Store }

/**
 * Khai bao thong tin hai don vi phat hanh hoa don.
 * Thong tin nay dung khi in hoa don va khi lap to khai thue.
 */
export default function EntitySettings() {
  const { entities, reload } = useEntities()
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    setForm(Object.fromEntries(entities.map(e => [e.id, { ...e }])))
  }, [entities])

  const set = (id, k, v) => setForm(f => ({ ...f, [id]: { ...f[id], [k]: v } }))

  const luu = async (id) => {
    const e = form[id]
    setBusy(id)
    const { error } = await supabase.from('issuing_entities').update({
      name: (e.name ?? '').trim(),
      short_name: (e.short_name ?? '').trim(),
      tax_code: (e.tax_code ?? '').trim() || null,
      address: (e.address ?? '').trim() || null,
      phone: (e.phone ?? '').trim() || null,
      bank_account: (e.bank_account ?? '').trim() || null,
      default_vat_rate: Number(e.default_vat_rate) || 0,
      updated_at: new Date().toISOString()
    }).eq('id', id)
    setBusy(null)
    if (error) return toast.error(loiTiengViet(error))
    toast.success(`Đã lưu thông tin ${e.short_name}`)
    reload()
  }

  const datMacDinh = async (id) => {
    setBusy(id)
    await supabase.from('issuing_entities').update({ is_default: false }).neq('id', id)
    const { error } = await supabase.from('issuing_entities').update({ is_default: true }).eq('id', id)
    setBusy(null)
    if (error) return toast.error(loiTiengViet(error))
    toast.success('Đã đặt làm đơn vị mặc định khi lập đơn')
    reload()
  }

  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle>Đơn vị xuất hóa đơn</CardTitle>
        <CardDescription>
          Khai báo mã số thuế và địa chỉ của từng pháp nhân — dùng khi in hóa đơn và lập tờ khai thuế
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-2">
        {entities.map(e => {
          const Icon = ICON[e.code] ?? Building2
          const f = form[e.id] ?? e
          return (
            <div key={e.id} className={cn('space-y-3 rounded-xl border-2 p-4',
              e.code === 'HKD' ? 'border-orange-200' : 'border-indigo-200')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className={cn('size-5',
                    e.code === 'HKD' ? 'text-orange-600' : 'text-indigo-600')} />
                  <span className="font-semibold">{e.short_name}</span>
                </div>
                {e.is_default ? (
                  <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    <Star className="mr-1 size-3" /> Mặc định
                  </Badge>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => datMacDinh(e.id)} disabled={busy === e.id}>
                    Đặt mặc định
                  </Button>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Tên đầy đủ (in trên hóa đơn)</Label>
                <Input value={f.name ?? ''} onChange={ev => set(e.id, 'name', ev.target.value)}
                  placeholder="CÔNG TY TNHH ..." />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Tên ngắn</Label>
                  <Input value={f.short_name ?? ''} onChange={ev => set(e.id, 'short_name', ev.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Mã số thuế</Label>
                  <Input value={f.tax_code ?? ''} onChange={ev => set(e.id, 'tax_code', ev.target.value)}
                    placeholder="0101234567" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Địa chỉ</Label>
                <Input value={f.address ?? ''} onChange={ev => set(e.id, 'address', ev.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Điện thoại</Label>
                  <Input value={f.phone ?? ''} onChange={ev => set(e.id, 'phone', ev.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Thuế suất mặc định (%)</Label>
                  <Input inputMode="decimal" value={f.default_vat_rate ?? 0}
                    onChange={ev => set(e.id, 'default_vat_rate', ev.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tài khoản ngân hàng</Label>
                <Input value={f.bank_account ?? ''} onChange={ev => set(e.id, 'bank_account', ev.target.value)}
                  placeholder="Vietcombank - 0123456789" />
              </div>

              <Button onClick={() => luu(e.id)} disabled={busy === e.id} className="w-full">
                {busy === e.id ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Lưu {e.short_name}
              </Button>
            </div>
          )
        })}

        <p className="flex gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground lg:col-span-2">
          <Info className="size-4 shrink-0" />
          <span>
            <b>Thuế suất mặc định</b> là con số tự điền cho mỗi dòng hàng khi Kinh doanh chọn đơn vị này.
            Hộ kinh doanh cá thể thường nộp thuế theo tỷ lệ trên doanh thu, không có thuế GTGT khấu trừ
            nên để <b>0%</b>. Nhân viên vẫn sửa được thuế suất từng dòng nếu trường hợp cụ thể cần khác.
          </span>
        </p>
      </CardContent>
    </Card>
  )
}

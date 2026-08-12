import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEntities, entityTone } from '@/hooks/useEntities'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { loiTiengViet } from '@/lib/format'
import { toast } from 'sonner'

/**
 * Nhan don vi xuat hoa don. Ke toan / Giam doc bam vao doi duoc ngay tai cho.
 * Vai tro khac chi nhin thay nhan.
 */
export default function EntitySwitch({ order, canEdit, onChanged, className }) {
  const { entities } = useEntities()
  const [sua, setSua] = useState(false)
  const [busy, setBusy] = useState(false)

  const doi = async (id) => {
    if (!id || id === order.entity_id) { setSua(false); return }
    setBusy(true)
    const { error } = await supabase.from('orders').update({ entity_id: id }).eq('id', order.id ?? order.order_id)
    setBusy(false); setSua(false)
    if (error) return toast.error(loiTiengViet(error))
    const e = entities.find(x => x.id === id)
    toast.success(`Đơn ${order.order_code} → xuất hóa đơn ${e?.short_name}`)
    onChanged?.()
  }

  const ten = order.entity?.short_name ?? order.entity_name
  const ma  = order.entity?.code ?? order.entity_code

  if (sua && canEdit) {
    return (
      <Select className="h-8 w-40 text-xs" autoFocus disabled={busy}
        defaultValue={order.entity_id ?? ''}
        onChange={e => doi(e.target.value)}
        onBlur={() => setSua(false)}>
        {entities.map(e => <option key={e.id} value={e.id}>{e.short_name}</option>)}
      </Select>
    )
  }

  return (
    <button type="button" disabled={!canEdit}
      onClick={() => setSua(true)}
      title={canEdit ? 'Bấm để đổi đơn vị xuất hóa đơn' : undefined}
      className={cn('inline-flex', canEdit && 'cursor-pointer', className)}>
      <Badge className={cn(entityTone(ma), canEdit && 'hover:brightness-95')}>
        {ten ?? 'Chưa gán'}
      </Badge>
    </button>
  )
}

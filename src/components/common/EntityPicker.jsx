import { cn } from '@/lib/utils'
import { Building2, Store, Check } from 'lucide-react'

const ICON = { CT: Building2, HKD: Store }

/**
 * Chon DON VI XUAT HOA DON cho don hang.
 * Hai phap nhan co MST va che do thue khac nhau nen phai chon ngay khi lap don.
 */
export default function EntityPicker({ entities, value, onChange, disabled }) {
  if (!entities.length) return null

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {entities.map(e => {
        const Icon = ICON[e.code] ?? Building2
        const chon = value === e.id
        return (
          <button key={e.id} type="button" disabled={disabled}
            onClick={() => onChange(e)}
            className={cn(
              'flex items-start gap-2.5 rounded-xl border-2 p-3 text-left transition',
              chon
                ? (e.code === 'HKD'
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-indigo-400 bg-indigo-50')
                : 'border-border hover:bg-accent',
              disabled && 'cursor-not-allowed opacity-60')}>
            <Icon className={cn('mt-0.5 size-5 shrink-0',
              chon ? (e.code === 'HKD' ? 'text-orange-600' : 'text-indigo-600') : 'text-muted-foreground')} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-medium">
                {e.short_name}
                {chon && <Check className={cn('size-4',
                  e.code === 'HKD' ? 'text-orange-600' : 'text-indigo-600')} />}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {e.tax_code ? `MST ${e.tax_code}` : 'Chưa khai mã số thuế'}
                {' · '}VAT mặc định {e.default_vat_rate}%
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

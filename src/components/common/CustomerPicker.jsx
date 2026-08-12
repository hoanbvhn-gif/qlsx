import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn, noAccent } from '@/lib/utils'
import { Search, X, UserPlus, Building2, Check } from 'lucide-react'

/**
 * O TEN KHACH HANG co goi y.
 * Go ten (khong dau cung duoc) -> hien khach da co trong he thong.
 * Chon mot khach -> tu dien ma KH, MST, dia chi, dien thoai.
 * Khong khop ai -> la khach moi, he thong tu cap ma.
 */
export default function CustomerPicker({
  customers, value, daChon, onPick, onFreeText, onClear
}) {
  const [q, setQ] = useState(value ?? '')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const boxRef = useRef(null)

  useEffect(() => { setQ(value ?? '') }, [value])

  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const results = useMemo(() => {
    const key = noAccent(q)
    if (!key) return customers.slice(0, 20)
    const words = key.split(/\s+/).filter(Boolean)
    return customers
      .filter(c => {
        const hay = noAccent(`${c.customer_code} ${c.name} ${c.tax_code ?? ''} ${c.phone ?? ''}`)
        return words.every(w => hay.includes(w))
      })
      .slice(0, 25)
  }, [customers, q])

  const khop = customers.some(c => noAccent(c.name) === noAccent(q))

  const chon = (c) => { setQ(c.name); setOpen(false); onPick(c) }

  const onKey = (e) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter' && results[hi]) { e.preventDefault(); chon(results[hi]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  /* ----- Da chon mot khach co san ----- */
  if (daChon) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
        <Building2 className="size-4 shrink-0 text-emerald-700" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-emerald-900">{value}</p>
          <p className="text-xs text-emerald-700">Khách hàng có sẵn trong hệ thống</p>
        </div>
        <button type="button" onClick={() => { setQ(''); onClear() }}
          title="Bỏ chọn, nhập khách khác"
          className="shrink-0 rounded-md p-1 text-emerald-700 transition hover:bg-emerald-100">
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div ref={boxRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="pl-9"
        placeholder="Gõ tên khách hàng — vd: Minh Long, an phat..."
        value={q}
        onChange={e => { setQ(e.target.value); setHi(0); setOpen(true); onFreeText(e.target.value) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
      />

      {open && (
        <div className="absolute z-50 mt-1 max-h-72 w-full min-w-[22rem] overflow-y-auto rounded-xl border bg-background p-1 shadow-lg">
          {results.length > 0 && (
            <p className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
              {q ? `${results.length} khách hàng khớp` : `${customers.length} khách hàng đã có`}
            </p>
          )}

          {results.map((c, i) => (
            <button key={c.id} type="button"
              onMouseEnter={() => setHi(i)} onClick={() => chon(c)}
              className={cn('flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition',
                i === hi ? 'bg-accent' : 'hover:bg-accent/60')}>
              <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.customer_code}
                  {c.tax_code ? ` · MST ${c.tax_code}` : ''}
                  {c.phone ? ` · ${c.phone}` : ''}
                </p>
              </div>
            </button>
          ))}

          {q.trim() && !khop && (
            <button type="button" onClick={() => setOpen(false)}
              className="mt-1 flex w-full items-start gap-2.5 rounded-lg border-t px-2.5 py-2.5 text-left transition hover:bg-accent/60">
              <UserPlus className="mt-0.5 size-4 shrink-0 text-sky-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">Khách hàng mới: &quot;{q.trim()}&quot;</p>
                <p className="text-xs text-muted-foreground">
                  Hệ thống sẽ tự cấp mã khách hàng khi lưu đơn
                </p>
              </div>
              <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            </button>
          )}

          {!results.length && !q.trim() && (
            <p className="px-2.5 py-6 text-center text-xs text-muted-foreground">
              Chưa có khách hàng nào. Gõ tên để tạo khách đầu tiên.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn, noAccent } from '@/lib/utils'
import { vnd } from '@/lib/format'
import { Search, X } from 'lucide-react'

/**
 * O chon ma hang: go MA (ALAM050001) hoac TEN TIENG VIET ('nhom an mon 0.5')
 * deu ra goi y. Khong dau cung tim duoc.
 */
export default function ItemPicker({ items, value, onPick, onFreeText, placeholder = 'Mã hàng hoặc tên...', className }) {
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
    if (!key) return items.slice(0, 30)
    const words = key.split(/\s+/).filter(Boolean)
    return items
      .map(it => {
        const hay = noAccent(`${it.item_code} ${it.item_name}`)
        if (!words.every(w => hay.includes(w))) return null
        // ma khop tu dau duoc uu tien len truoc
        const score = noAccent(it.item_code).startsWith(key) ? 0
          : hay.startsWith(key) ? 1 : 2
        return { it, score }
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score)
      .slice(0, 40)
      .map(x => x.it)
  }, [items, q])

  const choose = (it) => {
    setQ(it.item_code); setOpen(false); onPick(it)
  }

  const onKey = (e) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter' && results[hi]) { e.preventDefault(); choose(results[hi]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-9 pl-8 pr-7 font-mono text-xs uppercase"
        placeholder={placeholder}
        value={q}
        onChange={e => { setQ(e.target.value); setHi(0); setOpen(true); onFreeText?.(e.target.value) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
      />
      {q && (
        <button type="button" title="Xóa"
          onClick={() => { setQ(''); onFreeText?.(''); setOpen(true) }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          <X className="size-3.5" />
        </button>
      )}

      {open && (
        <div className="absolute z-50 mt-1 max-h-72 w-[min(26rem,80vw)] overflow-y-auto rounded-xl border bg-background p-1 shadow-lg">
          {results.length ? results.map((it, i) => (
            <button key={it.id} type="button"
              onMouseEnter={() => setHi(i)}
              onClick={() => choose(it)}
              className={cn('flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition',
                i === hi ? 'bg-accent' : 'hover:bg-accent/60')}>
              <code className="shrink-0 font-mono text-xs font-bold">{it.item_code}</code>
              <span className="min-w-0 flex-1 truncate text-xs">{it.item_name}</span>
              {it.list_price > 0 && (
                <span className="num shrink-0 text-xs font-medium text-muted-foreground">{vnd(it.list_price)}</span>
              )}
            </button>
          )) : (
            <p className="px-2.5 py-3 text-center text-xs text-muted-foreground">
              Không tìm thấy mã hàng nào khớp
            </p>
          )}
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn, noAccent } from '@/lib/utils'
import { vnd } from '@/lib/format'
import { Search, Plus, X, PackageSearch } from 'lucide-react'

/**
 * O tim san pham lon dat tren bang hang hoa.
 * Go "tem nhom"      -> ra toan bo tem nhom
 * Go "40x160"        -> ra moi mat hang co kich thuoc do
 * Go "an mon 0.5"    -> loc theo gia cong + do day
 * Bam mot dong = them thang vao don.
 */
export default function ProductSearchBox({ items, onAdd }) {
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const [focus, setFocus] = useState(false)
  const boxRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setFocus(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const results = useMemo(() => {
    const key = noAccent(q)
    const words = key.split(/\s+/).filter(Boolean)
    const pool = items.map(it => ({
      it,
      hay: noAccent(`${it.item_code} ${it.item_name} ${it.material?.name ?? ''} ${it.process?.name ?? ''} ${it.thickness?.name ?? ''} ${it.size?.name ?? ''}`)
    }))
    if (!words.length) return pool.slice(0, 50).map(x => x.it)
    return pool
      .filter(x => words.every(w => x.hay.includes(w)))
      .sort((a, b) => {
        const ac = noAccent(a.it.item_code).startsWith(key) ? 0 : 1
        const bc = noAccent(b.it.item_code).startsWith(key) ? 0 : 1
        return ac - bc || a.it.item_code.localeCompare(b.it.item_code)
      })
      .slice(0, 60)
      .map(x => x.it)
  }, [items, q])

  const pick = (it) => { onAdd(it); setHi(0); inputRef.current?.focus() }

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocus(true); setHi(h => Math.min(h + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter' && results[hi]) { e.preventDefault(); pick(results[hi]) }
    else if (e.key === 'Escape') setFocus(false)
  }

  return (
    <div ref={boxRef} className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          className="h-12 pl-11 pr-10 text-base"
          placeholder="Tìm sản phẩm — gõ 'tem nhôm', '40x160', 'ăn mòn 0.5', hoặc mã ALAM..."
          value={q}
          onChange={e => { setQ(e.target.value); setHi(0); setFocus(true) }}
          onFocus={() => setFocus(true)}
          onKeyDown={onKey}
        />
        {q && (
          <button type="button" onClick={() => { setQ(''); inputRef.current?.focus() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        )}
      </div>

      {focus && (
        <div className="rounded-xl border bg-background shadow-sm">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">
              {q ? `${results.length} sản phẩm khớp` : `${items.length} sản phẩm trong danh mục`}
            </p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              ↑↓ chọn · Enter thêm vào đơn · Esc đóng
            </p>
          </div>

          <div className="max-h-80 overflow-y-auto p-1.5">
            {results.length ? results.map((it, i) => (
              <button key={it.id} type="button"
                onMouseEnter={() => setHi(i)} onClick={() => pick(it)}
                className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition',
                  i === hi ? 'bg-accent' : 'hover:bg-accent/60')}>
                <code className="w-[6.5rem] shrink-0 font-mono text-sm font-bold">{it.item_code}</code>
                <span className="min-w-0 flex-1 truncate text-sm">{it.item_name}</span>
                <div className="hidden shrink-0 items-center gap-1 md:flex">
                  <Tag>{it.material?.name}</Tag>
                  <Tag>{it.process?.name}</Tag>
                  {it.thickness?.code !== '000' && <Tag>{it.thickness?.name}</Tag>}
                  <Tag>{it.size?.name}</Tag>
                </div>
                <span className="num w-24 shrink-0 text-right text-sm font-medium">
                  {it.list_price > 0 ? vnd(it.list_price) : '--'}
                </span>
                <span className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
                  <Plus className="size-3" /> Thêm
                </span>
              </button>
            )) : (
              <div className="flex flex-col items-center gap-1.5 px-3 py-8 text-center">
                <PackageSearch className="size-7 text-muted-foreground/50" />
                <p className="text-sm font-medium">Không tìm thấy sản phẩm nào</p>
                <p className="text-xs text-muted-foreground">
                  Thử từ khóa ngắn hơn, hoặc dùng nút &quot;Thêm dòng trống&quot; để nhập hàng ngoài danh mục
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const Tag = ({ children }) => children
  ? <span className="whitespace-nowrap rounded border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{children}</span>
  : null

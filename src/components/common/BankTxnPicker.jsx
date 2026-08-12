import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn, noAccent } from '@/lib/utils'
import { vnd, dmy } from '@/lib/format'
import { Landmark, Search, X, Check, Sparkles, Loader2 } from 'lucide-react'

/**
 * O TIM KHOAN TIEN VE tu bang ke ngan hang.
 * Go ngay (12/08) hoac so tien (1500000) hoac ten khach -> ra cac khoan CHUA DUNG.
 * Chon mot khoan -> tu dien so tien, ngay, so chung tu, noi dung CK vao but toan.
 * Khoan da gan voi but toan khac se khong con trong danh sach.
 */
export default function BankTxnPicker({ order, value, soTienGhi, onPick, onClear }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const boxRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('v_tien_ve_chua_khop')
      .select('*').order('posting_date', { ascending: false }).limit(300)
    setRows(data ?? []); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  /** Khoan con lai dung bang so tien con no cua don -> goi y len dau */
  const conNo = Number(order?.debt_amount ?? 0)
  const conLai = (r) => Number(r.con_lai ?? r.amount_in)
  const goiY = useMemo(
    () => (conNo > 0 ? rows.filter(r => conLai(r) === conNo).slice(0, 3) : []),
    [rows, conNo])

  const results = useMemo(() => {
    const key = q.trim()
    if (!key) return rows.slice(0, 40)

    // Go toan so -> tim theo so tien (bo dau cham, phay)
    const soTien = key.replace(/[.,\s]/g, '')
    const laSo = /^\d+$/.test(soTien)

    // Go dang ngay: 12/08 hoac 12-08 hoac 12/08/2026
    const mNgay = key.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/)

    return rows.filter(r => {
      if (laSo && (String(Math.round(Number(r.amount_in))).includes(soTien)
                || String(Math.round(conLai(r))).includes(soTien))) return true
      if (mNgay) {
        const d = new Date(r.posting_date)
        const [, dd, mm, yy] = mNgay
        if (d.getDate() === +dd && d.getMonth() + 1 === +mm) {
          if (!yy) return true
          const y = +yy < 100 ? 2000 + +yy : +yy
          return d.getFullYear() === y
        }
        return false
      }
      const hay = noAccent(`${r.counterparty ?? ''} ${r.content ?? ''} ${r.bank_ref}`)
      return noAccent(key).split(/\s+/).every(w => hay.includes(w))
    }).slice(0, 40)
  }, [rows, q])

  const chon = (r) => { setOpen(false); setQ(''); onPick(r) }

  const onKey = (e) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter' && results[hi]) { e.preventDefault(); chon(results[hi]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  /* ---------- Da chon mot khoan ---------- */
  if (value) {
    const ghi = Number(soTienGhi ?? 0)
    const lech = ghi > 0 && ghi !== Number(value.con_lai ?? value.amount_in)
    return (
      <div className="space-y-1.5 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3">
        <div className="flex items-start gap-2">
          <Landmark className="mt-0.5 size-4 shrink-0 text-emerald-700" />
          <div className="min-w-0 flex-1">
            <p className="num text-sm font-semibold text-emerald-900">
              {vnd(value.amount_in)} đ · {dmy(value.posting_date)}
            </p>
            {Number(value.con_lai ?? value.amount_in) < Number(value.amount_in) && (
              <p className="num text-xs font-medium text-emerald-800">
                Còn chưa phân bổ {vnd(value.con_lai)} đ
              </p>
            )}
            <p className="truncate text-xs text-emerald-800">{value.counterparty}</p>
            <p className="truncate text-xs text-emerald-700">{value.content}</p>
            <p className="font-mono text-[11px] text-emerald-600">{value.bank_ref}</p>
          </div>
          <button type="button" onClick={onClear} title="Bỏ chọn khoản này"
            className="shrink-0 rounded-md p-1 text-emerald-700 transition hover:bg-emerald-100">
            <X className="size-4" />
          </button>
        </div>
        {lech && (
          <p className="text-xs text-sky-700">
            Ghi {vnd(ghi)} đ trong khoản {vnd(value.amount_in)} đ — phần còn lại vẫn dùng được cho đơn khác.
          </p>
        )}
      </div>
    )
  }

  return (
    <div ref={boxRef} className="space-y-2">
      {/* Goi y nhanh: khoan dung bang so tien con no */}
      {!!goiY.length && (
        <div className="space-y-1.5 rounded-lg border border-sky-200 bg-sky-50 p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-sky-900">
            <Sparkles className="size-3.5" /> Khoản còn đúng {vnd(conNo)} đ — vừa hết nợ của đơn
          </p>
          {goiY.map(r => (
            <button key={r.id} type="button" onClick={() => chon(r)}
              className="flex w-full items-center gap-2 rounded-md bg-background p-2 text-left text-xs transition hover:bg-accent">
              <Check className="size-3.5 shrink-0 text-sky-600" />
              <span className="num shrink-0 font-semibold">{vnd(conLai(r))}</span>
              <span className="shrink-0 text-muted-foreground">{dmy(r.posting_date)}</span>
              <span className="min-w-0 flex-1 truncate">{r.counterparty}</span>
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Tìm khoản tiền về — gõ 12/08 hoặc 1500000 hoặc tên khách..."
          value={q}
          onChange={e => { setQ(e.target.value); setHi(0); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey} />
      </div>

      {open && (
        <div className="max-h-64 overflow-y-auto rounded-xl border bg-background p-1 shadow-sm">
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <p className="text-xs text-muted-foreground">
              {loading ? 'Đang tải...' : `${results.length} khoản tiền về còn dùng được`}
            </p>
            {loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>

          {results.map((r, i) => (
            <button key={r.id} type="button"
              onMouseEnter={() => setHi(i)} onClick={() => chon(r)}
              className={cn('flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition',
                i === hi ? 'bg-accent' : 'hover:bg-accent/60')}>
              <Landmark className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-2">
                  <span className="num text-sm font-semibold">{vnd(conLai(r))} đ</span>
                  <span className="text-xs text-muted-foreground">{dmy(r.posting_date)}</span>
                  {conLai(r) < Number(r.amount_in) && (
                    <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                      còn lại của {vnd(r.amount_in)}
                    </Badge>
                  )}
                  {conLai(r) === conNo && (
                    <Badge className="border-sky-200 bg-sky-50 text-sky-700">vừa hết nợ</Badge>
                  )}
                </p>
                <p className="truncate text-xs font-medium">{r.counterparty}</p>
                <p className="truncate text-xs text-muted-foreground">{r.content}</p>
              </div>
            </button>
          ))}

          {!loading && !results.length && (
            <p className="px-2.5 py-6 text-center text-xs text-muted-foreground">
              Không tìm thấy khoản nào. Kiểm tra đã nhập bảng kê ngân hàng của kỳ này chưa,
              hoặc khoản đó đã được ghi sổ rồi.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

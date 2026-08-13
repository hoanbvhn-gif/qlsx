import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { traMST, mstHopLe, chuanHoaMST } from '@/lib/mst'
import { cn } from '@/lib/utils'
import { Search, Loader2, CheckCircle2, AlertTriangle, Building2, MapPin } from 'lucide-react'
import { toast } from 'sonner'

/**
 * O NHAP MA SO THUE co tra cuu thong tin doanh nghiep.
 *
 * Go du 10 so la tu tra, khong phai bam gi.
 *
 * QUAN TRONG: ten tra ve KHONG de len o "Ten khach hang".
 * Ten goi noi bo ("Tuan Hung", "intec") de tim don va goi dien;
 * ten dang ky thue de xuat hoa don. Hai viec khac nhau, giu rieng.
 */
export default function MstInput({
  value, onChange, onFound, tenPhapLy, diaChiPhapLy,
  disabled, label = 'Mã số thuế'
}) {
  const [dangTra, setDangTra] = useState(false)
  const [kq, setKq] = useState(null)
  const daTra = useRef('')

  const tra = async (mst, tuDong) => {
    const ma = chuanHoaMST(mst)
    if (!mstHopLe(ma)) {
      if (!tuDong) toast.error('Mã số thuế phải có 10 số.')
      return
    }
    daTra.current = ma
    setDangTra(true)
    const r = await traMST(ma)
    setDangTra(false)
    setKq(r)
    if (r.ok) onFound?.(r)
    else if (!tuDong) toast.error(r.loi)
  }

  // Go du so la tu tra, khong bat nguoi dung bam nut
  useEffect(() => {
    const ma = chuanHoaMST(value)
    if (!mstHopLe(ma)) { setKq(null); return }
    if (daTra.current === ma) return
    const t = setTimeout(() => tra(ma, true), 500)
    return () => clearTimeout(t)
  }, [value])

  // Da luu tu truoc (khach cu) thi van hien, khoi phai tra lai
  const ten    = kq?.ok ? kq.ten    : (tenPhapLy || '')
  const diaChi = kq?.ok ? kq.diaChi : (diaChiPhapLy || '')
  const trangThai = kq?.ok ? kq.trangThai : null

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input value={value} disabled={disabled} placeholder="0101234567"
          onChange={e => onChange(e.target.value)} />
        <Button type="button" variant="outline" size="icon" disabled={disabled || dangTra}
          title="Tra cứu tên doanh nghiệp theo mã số thuế"
          onClick={() => { daTra.current = ''; tra(value, false) }}>
          {dangTra ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
        </Button>
      </div>

      {dangTra && (
        <p className="text-xs text-muted-foreground">Đang tra cứu bên Cục Thuế...</p>
      )}

      {!dangTra && ten && (
        <div className="space-y-1 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs">
          <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
            Thông tin xuất hóa đơn
          </p>
          <p className="flex items-start gap-1.5">
            <Building2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
            <span className="font-medium text-emerald-900">{ten}</span>
          </p>
          {diaChi && (
            <p className="flex items-start gap-1.5 text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />{diaChi}
            </p>
          )}
          {trangThai && (
            <p className={cn('flex items-center gap-1.5 text-[11px]',
              /đang hoạt động/i.test(trangThai) ? 'text-emerald-700' : 'text-rose-600')}>
              {/đang hoạt động/i.test(trangThai)
                ? <CheckCircle2 className="size-3" />
                : <AlertTriangle className="size-3" />}
              {trangThai}
            </p>
          )}
          <p className="border-t border-emerald-200 pt-1 text-[11px] text-muted-foreground">
            Tên khách hàng ở trên giữ nguyên tên gọi nội bộ — không bị đè.
          </p>
        </div>
      )}

      {!dangTra && kq && !kq.ok && mstHopLe(value) && (
        <p className="flex items-start gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {kq.loi}
        </p>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { traMST, mstHopLe, chuanHoaMST } from '@/lib/mst'
import { cn } from '@/lib/utils'
import { Search, Loader2, CheckCircle2, AlertTriangle, Building2 } from 'lucide-react'
import { toast } from 'sonner'

/**
 * O NHAP MA SO THUE co tra cuu ten doanh nghiep.
 *
 * Go du 10 so la tu tra, khong phai bam gi. Tra ra thi hien ten day du
 * de nguoi dung bam ap vao o Ten khach hang.
 * Tra khong ra thi khong lam gi ca — ten go tay giu nguyen.
 */
export default function MstInput({
  value, onChange, onFound, onRevert, tenHienTai, disabled, label = 'Mã số thuế'
}) {
  const [dangTra, setDangTra] = useState(false)
  const [kq, setKq] = useState(null)
  const [tenCu, setTenCu] = useState(null)   // ten nguoi dung go, de hoan tac
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

    if (r.ok) {
      // MST tra ra dung -> lay ten dang ky luon, khoi bat bam them nut
      const ten = (tenHienTai ?? '').trim()
      setTenCu(ten && ten.toLowerCase() !== r.ten.trim().toLowerCase() ? ten : null)
      onFound?.(r)
    } else if (!tuDong) {
      toast.error(r.loi)
    }
  }

  // Go du so la tu tra, khong bat nguoi dung bam nut
  useEffect(() => {
    const ma = chuanHoaMST(value)
    if (!mstHopLe(ma)) { setKq(null); return }
    if (daTra.current === ma) return
    const t = setTimeout(() => tra(ma, true), 500)
    return () => clearTimeout(t)
  }, [value])

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

      {!dangTra && kq?.ok && (
        <div className="space-y-1 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs">
          <p className="flex items-start gap-1.5 font-medium">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
            <span className="text-emerald-900">{kq.ten}</span>
          </p>
          {kq.diaChi && (
            <p className="flex items-start gap-1.5 text-muted-foreground">
              <Building2 className="mt-0.5 size-3.5 shrink-0" />{kq.diaChi}
            </p>
          )}
          {kq.trangThai && (
            <p className={cn('text-[11px]',
              /đang hoạt động/i.test(kq.trangThai) ? 'text-emerald-700' : 'text-rose-600')}>
              {kq.trangThai}
            </p>
          )}
          {tenCu && (
            <div className="flex flex-wrap items-center gap-2 border-t border-emerald-200 pt-1.5">
              <span className="text-muted-foreground">
                Đã thay tên bạn gõ (<b>{tenCu}</b>) bằng tên đăng ký.
              </span>
              <button type="button"
                onClick={() => { onRevert?.(tenCu); setTenCu(null) }}
                className="rounded-md border border-emerald-300 bg-white px-2 py-0.5 font-medium text-emerald-800 transition hover:bg-emerald-100">
                Giữ tên cũ
              </button>
            </div>
          )}
        </div>
      )}

      {!dangTra && kq && !kq.ok && mstHopLe(value) && (
        <p className="flex items-start gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {kq.loi} Tên khách hàng vẫn dùng đúng cái bạn gõ.
        </p>
      )}
    </div>
  )
}

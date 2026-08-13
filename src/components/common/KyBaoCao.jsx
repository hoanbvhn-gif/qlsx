import { useMemo, useState } from 'react'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { dmy } from '@/lib/format'
import { CalendarRange } from 'lucide-react'

/**
 * CHON KY BAO CAO — thang, quy, nam hoac khoang ngay tu chon.
 *
 * Tra ve { tu, den, nhan } qua onChange. tu/den la chuoi 'YYYY-MM-DD',
 * lay tron ca hai dau (>= tu va <= den).
 */
const d2s = (d) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}
const dauThang = (y, m) => new Date(y, m, 1)
const cuoiThang = (y, m) => new Date(y, m + 1, 0)

/** Danh sach ky dung san, tinh theo hom nay */
export function cacKy(homNay = new Date()) {
  const y = homNay.getFullYear()
  const m = homNay.getMonth()
  const q = Math.floor(m / 3)

  const ky = (ma, ten, tu, den) => ({ ma, ten, tu: d2s(tu), den: d2s(den) })

  return [
    ky('thang_nay',   'Tháng này',      dauThang(y, m),           cuoiThang(y, m)),
    ky('thang_truoc', 'Tháng trước',    dauThang(y, m - 1),       cuoiThang(y, m - 1)),
    ky('quy_nay',     `Quý ${q + 1}`,   dauThang(y, q * 3),       cuoiThang(y, q * 3 + 2)),
    ky('quy_truoc',   'Quý trước',      dauThang(y, q * 3 - 3),   cuoiThang(y, q * 3 - 1)),
    ky('nam_nay',     `Năm ${y}`,       dauThang(y, 0),           cuoiThang(y, 11)),
    ky('nam_truoc',   `Năm ${y - 1}`,   dauThang(y - 1, 0),       cuoiThang(y - 1, 11)),
    ky('nam_qua',     '12 tháng qua',   dauThang(y, m - 11),      cuoiThang(y, m))
  ]
}

export default function KyBaoCao({ value, onChange }) {
  const ds = useMemo(() => cacKy(), [])
  const [ma, setMa] = useState('thang_nay')
  const [tu, setTu] = useState(value?.tu ?? ds[0].tu)
  const [den, setDen] = useState(value?.den ?? ds[0].den)

  const doiKy = (k) => {
    setMa(k)
    if (k === 'tuy_chon') { onChange({ tu, den, nhan: `${dmy(tu)} — ${dmy(den)}` }); return }
    const x = ds.find(z => z.ma === k)
    if (!x) return
    setTu(x.tu); setDen(x.den)
    onChange({ tu: x.tu, den: x.den, nhan: x.ten })
  }

  const doiNgay = (loai, v) => {
    const t = loai === 'tu' ? v : tu
    const d = loai === 'den' ? v : den
    if (loai === 'tu') setTu(v); else setDen(v)
    setMa('tuy_chon')
    if (t && d) onChange({ tu: t, den: d, nhan: `${dmy(t)} — ${dmy(d)}` })
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label className="flex items-center gap-1.5 text-xs">
          <CalendarRange className="size-3.5" /> Kỳ báo cáo
        </Label>
        <Select className="w-44" value={ma} onChange={e => doiKy(e.target.value)}>
          {ds.map(k => <option key={k.ma} value={k.ma}>{k.ten}</option>)}
          <option value="tuy_chon">Tự chọn ngày...</option>
        </Select>
      </div>

      {ma === 'tuy_chon' && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Từ ngày</Label>
            <Input type="date" className="w-40" value={tu}
              onChange={e => doiNgay('tu', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Đến ngày</Label>
            <Input type="date" className="w-40" value={den}
              onChange={e => doiNgay('den', e.target.value)} />
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Chia khoang thoi gian thanh cac moc de ve bieu do.
 * Ky ngan thi chia theo NGAY, dai hon thi theo THANG, rat dai thi theo NAM
 * — de bieu do luon co so cot vua nhin, khong bao gio dac kin hay trong tron.
 */
export function chiaMoc(tu, den) {
  const t = new Date(tu + 'T00:00:00')
  const d = new Date(den + 'T00:00:00')
  const soNgay = Math.round((d - t) / 86400000) + 1

  if (soNgay <= 62) {
    const moc = []
    for (let i = 0; i < soNgay; i++) {
      const x = new Date(t.getTime() + i * 86400000)
      moc.push({ key: d2s(x), nhan: `${x.getDate()}/${x.getMonth() + 1}` })
    }
    return { kieu: 'ngay', moc }
  }

  if (soNgay <= 750) {
    const moc = []
    const x = new Date(t.getFullYear(), t.getMonth(), 1)
    while (x <= d) {
      moc.push({
        key: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`,
        nhan: `T${x.getMonth() + 1}${x.getFullYear() !== d.getFullYear() ? `/${String(x.getFullYear()).slice(2)}` : ''}`
      })
      x.setMonth(x.getMonth() + 1)
    }
    return { kieu: 'thang', moc }
  }

  const moc = []
  for (let y = t.getFullYear(); y <= d.getFullYear(); y++) {
    moc.push({ key: String(y), nhan: String(y) })
  }
  return { kieu: 'nam', moc }
}

/** Ngay cua don hang thuoc moc nao */
export function mocCuaNgay(ngay, kieu) {
  const s = String(ngay).slice(0, 10)
  if (kieu === 'ngay') return s
  if (kieu === 'thang') return s.slice(0, 7)
  return s.slice(0, 4)
}

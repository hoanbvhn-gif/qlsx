import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, DESIGN_BUCKET } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import PageHeader from '@/components/common/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { vnd, parseNum } from '@/lib/format'
import { Plus, Trash2, Upload, Save, Send, Loader2, Paperclip, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

const UNITS = ['Cái', 'Bộ', 'Chiếc', 'Kg', 'Tấn', 'Mét', 'M2', 'Thùng', 'Hộp', 'Tờ']
const VAT_RATES = [0, 5, 8, 10]

const blankLine = (n) => ({
  key: crypto.randomUUID(), line_no: n,
  item_code: '', item_name: '', spec: '',
  quantity: '1', unit: 'Cái', unit_price: '', vat_rate: 8
})

export default function NewOrder() {
  const { profile } = useAuth()
  const nav = useNavigate()

  const [customers, setCustomers] = useState([])
  const [head, setHead] = useState({
    customer_id: '', customer_code: '', customer_name: '',
    customer_tax_code: '', customer_address: '', customer_phone: '',
    order_date: new Date().toISOString().slice(0, 10), note: ''
  })
  const [lines, setLines] = useState([blankLine(1)])
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [previewCode, setPreviewCode] = useState('')

  useEffect(() => {
    supabase.from('customers').select('*').order('name').then(({ data }) => setCustomers(data ?? []))
    const d = new Date()
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    setPreviewCode(`NN${dd}${mm}${d.getFullYear()}`)
  }, [])

  /* ---------- Dong hang hoa ---------- */
  const addLine = () => setLines(l => [...l, blankLine(l.length + 1)])
  const delLine = (key) =>
    setLines(l => (l.length === 1 ? l : l.filter(x => x.key !== key).map((x, i) => ({ ...x, line_no: i + 1 }))))
  const setLine = (key, patch) => setLines(l => l.map(x => (x.key === key ? { ...x, ...patch } : x)))

  /* ---------- Tinh tien ---------- */
  const totals = useMemo(() => {
    let sub = 0, vat = 0
    for (const l of lines) {
      const amt = parseNum(l.quantity) * parseNum(l.unit_price)
      sub += amt
      vat += amt * (Number(l.vat_rate) || 0) / 100
    }
    return { sub, vat, total: sub + vat }
  }, [lines])

  const pickCustomer = (id) => {
    const c = customers.find(x => x.id === id)
    if (!c) return setHead(h => ({ ...h, customer_id: '' }))
    setHead(h => ({
      ...h, customer_id: c.id, customer_code: c.customer_code, customer_name: c.name,
      customer_tax_code: c.tax_code ?? '', customer_address: c.address ?? '', customer_phone: c.phone ?? ''
    }))
  }

  /* ---------- Kiem tra truoc khi luu ---------- */
  const validate = (forSubmit) => {
    if (!head.customer_name.trim()) return 'Chưa nhập tên khách hàng.'
    const ok = lines.filter(l => l.item_name.trim() && parseNum(l.quantity) > 0)
    if (!ok.length) return 'Đơn hàng phải có ít nhất 1 dòng hàng hóa hợp lệ.'
    // RANG BUOC BAT BUOC theo quy trinh
    if (forSubmit && !file) return 'Bắt buộc đính kèm file thiết kế Market trước khi gửi Kế toán duyệt.'
    return null
  }

  const save = async (forSubmit) => {
    const err = validate(forSubmit)
    if (err) return toast.error(err)
    setBusy(true)
    let orderId = null
    try {
      /* 1. Sinh ma don: STT + DD + MM + YYYY  (vd 0108082026) */
      const { data: code, error: eCode } =
        await supabase.rpc('next_order_code', { p_date: head.order_date })
      if (eCode) throw eCode

      /* 2. Khach hang moi -> tao ho so */
      let customerId = head.customer_id || null
      if (!customerId) {
        const { data: c, error: eC } = await supabase.from('customers').insert({
          customer_code: head.customer_code || 'KH' + Date.now().toString().slice(-6),
          name: head.customer_name, tax_code: head.customer_tax_code,
          address: head.customer_address, phone: head.customer_phone, created_by: profile.id
        }).select('id').single()
        if (eC) throw eC
        customerId = c.id
      }

      /* 3. Upload file thiet ke Market len Supabase Storage */
      let designPath = null, designName = null
      if (file) {
        const clean = file.name.replace(/[^\w.\-]/g, '_')
        designPath = `${code}/${Date.now()}_${clean}`
        const { error: eU } = await supabase.storage
          .from(DESIGN_BUCKET).upload(designPath, file, { upsert: false })
        if (eU) throw eU
        designName = file.name
      }

      /* 4. Tao don hang */
      const { data: order, error: eO } = await supabase.from('orders').insert({
        order_code: code,
        order_date: head.order_date,
        customer_id: customerId,
        customer_name: head.customer_name,
        customer_tax_code: head.customer_tax_code,
        customer_address: head.customer_address,
        customer_phone: head.customer_phone,
        sales_id: profile.id,
        status: forSubmit ? 'pending_accounting' : 'draft',
        design_file_path: designPath,
        design_file_name: designName,
        design_uploaded_at: designPath ? new Date().toISOString() : null,
        note: head.note
      }).select('id, order_code').single()
      if (eO) throw eO
      orderId = order.id

      /* 5. Chi tiet hang hoa */
      const payload = lines
        .filter(l => l.item_name.trim() && parseNum(l.quantity) > 0)
        .map((l, i) => ({
          order_id: order.id, line_no: i + 1,
          item_code: l.item_code || null, item_name: l.item_name, spec: l.spec || null,
          quantity: parseNum(l.quantity), unit: l.unit,
          unit_price: parseNum(l.unit_price), vat_rate: Number(l.vat_rate) || 0
        }))
      const { error: eI } = await supabase.from('order_items').insert(payload)
      if (eI) throw eI

      toast.success(forSubmit
        ? `Đã gửi đơn ${order.order_code} sang Kế toán duyệt`
        : `Đã lưu nháp đơn ${order.order_code}`)
      nav('/kinhdoanh/don-hang')
    } catch (e) {
      if (orderId) await supabase.from('orders').delete().eq('id', orderId)  // rollback thu cong
      toast.error('Lỗi: ' + (e.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Lập đơn hàng mới"
        desc={`Mã đơn sẽ tự sinh theo quy tắc [STT][Ngày][Tháng][Năm] — ví dụ ${previewCode.replace('NN', '01')}`}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* ----- Thong tin chung ----- */}
          <Card>
            <CardHeader><CardTitle>1. Thông tin khách hàng</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Chọn khách hàng có sẵn</Label>
                <Select value={head.customer_id} onChange={e => pickCustomer(e.target.value)}>
                  <option value="">-- Khách hàng mới (nhập tay bên dưới) --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.customer_code} · {c.name}</option>
                  ))}
                </Select>
              </div>
              <F label="Mã khách hàng" value={head.customer_code}
                 onChange={v => setHead(h => ({ ...h, customer_code: v }))} placeholder="KH001" />
              <F label="Tên khách hàng *" value={head.customer_name}
                 onChange={v => setHead(h => ({ ...h, customer_name: v }))} placeholder="Công ty TNHH ..." />
              <F label="Mã số thuế" value={head.customer_tax_code}
                 onChange={v => setHead(h => ({ ...h, customer_tax_code: v }))} placeholder="0101234567" />
              <F label="Số điện thoại" value={head.customer_phone}
                 onChange={v => setHead(h => ({ ...h, customer_phone: v }))} placeholder="09xxxxxxxx" />
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Địa chỉ</Label>
                <Input value={head.customer_address}
                  onChange={e => setHead(h => ({ ...h, customer_address: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Ngày lập đơn</Label>
                <Input type="date" value={head.order_date}
                  onChange={e => setHead(h => ({ ...h, order_date: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          {/* ----- Bang hang hoa dong ----- */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>2. Chi tiết hàng hóa</CardTitle>
              <Button size="sm" variant="outline" onClick={addLine}>
                <Plus className="size-4" /> Thêm dòng
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Desktop: dang bang */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="w-8 py-2 text-left">#</th>
                      <th className="w-28 px-1.5 py-2 text-left">Mã hàng</th>
                      <th className="min-w-[180px] px-1.5 py-2 text-left">Tên hàng hóa *</th>
                      <th className="w-24 px-1.5 py-2 text-right">SL</th>
                      <th className="w-24 px-1.5 py-2 text-left">ĐVT</th>
                      <th className="w-32 px-1.5 py-2 text-right">Đơn giá</th>
                      <th className="w-20 px-1.5 py-2 text-right">VAT</th>
                      <th className="w-32 px-1.5 py-2 text-right">Thành tiền</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={l.key} className="border-b last:border-0">
                        <td className="py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-1.5"><Input className="h-9" value={l.item_code}
                          onChange={e => setLine(l.key, { item_code: e.target.value })} /></td>
                        <td className="px-1.5"><Input className="h-9" value={l.item_name}
                          onChange={e => setLine(l.key, { item_name: e.target.value })} /></td>
                        <td className="px-1.5"><Input className="h-9 text-right" inputMode="decimal" value={l.quantity}
                          onChange={e => setLine(l.key, { quantity: e.target.value })} /></td>
                        <td className="px-1.5">
                          <Select className="h-9" value={l.unit} onChange={e => setLine(l.key, { unit: e.target.value })}>
                            {UNITS.map(u => <option key={u}>{u}</option>)}
                          </Select>
                        </td>
                        <td className="px-1.5"><Input className="h-9 text-right" inputMode="decimal" value={l.unit_price}
                          onChange={e => setLine(l.key, { unit_price: e.target.value })} /></td>
                        <td className="px-1.5">
                          <Select className="h-9" value={l.vat_rate} onChange={e => setLine(l.key, { vat_rate: e.target.value })}>
                            {VAT_RATES.map(v => <option key={v} value={v}>{v}%</option>)}
                          </Select>
                        </td>
                        <td className="num px-1.5 text-right font-medium">
                          {vnd(parseNum(l.quantity) * parseNum(l.unit_price))}
                        </td>
                        <td className="pl-1">
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive"
                            onClick={() => delLine(l.key)} disabled={lines.length === 1}>
                            <Trash2 className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: dang the */}
              <div className="space-y-3 md:hidden">
                {lines.map((l, i) => (
                  <div key={l.key} className="rounded-xl border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Dòng {i + 1}</span>
                      <Button variant="ghost" size="icon" onClick={() => delLine(l.key)} disabled={lines.length === 1}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Mã hàng" value={l.item_code} onChange={e => setLine(l.key, { item_code: e.target.value })} />
                      <Select value={l.unit} onChange={e => setLine(l.key, { unit: e.target.value })}>
                        {UNITS.map(u => <option key={u}>{u}</option>)}
                      </Select>
                      <Input className="col-span-2" placeholder="Tên hàng hóa" value={l.item_name}
                        onChange={e => setLine(l.key, { item_name: e.target.value })} />
                      <Input placeholder="Số lượng" inputMode="decimal" value={l.quantity}
                        onChange={e => setLine(l.key, { quantity: e.target.value })} />
                      <Input placeholder="Đơn giá" inputMode="decimal" value={l.unit_price}
                        onChange={e => setLine(l.key, { unit_price: e.target.value })} />
                      <Select value={l.vat_rate} onChange={e => setLine(l.key, { vat_rate: e.target.value })}>
                        {VAT_RATES.map(v => <option key={v} value={v}>VAT {v}%</option>)}
                      </Select>
                      <div className="num flex items-center justify-end pr-1 text-sm font-semibold">
                        {vnd(parseNum(l.quantity) * parseNum(l.unit_price))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="outline" className="w-full md:hidden" onClick={addLine}>
                <Plus className="size-4" /> Thêm dòng hàng hóa
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ----- Cot phai: file + tong ket ----- */}
        <div className="space-y-5">
          <Card className={file ? '' : 'border-amber-300 bg-amber-50/40'}>
            <CardHeader><CardTitle>3. File thiết kế Market *</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!file && (
                <p className="flex gap-2 rounded-lg bg-amber-100/70 p-2.5 text-xs text-amber-800">
                  <AlertTriangle className="size-4 shrink-0" />
                  Bắt buộc có file thiết kế thì đơn mới gửi được sang Kế toán.
                </p>
              )}
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition hover:bg-accent">
                <Upload className="size-6 text-muted-foreground" />
                <span className="text-sm font-medium">{file ? 'Chọn file khác' : 'Tải file lên'}</span>
                <span className="text-xs text-muted-foreground">PDF, AI, CDR, PSD, JPG, PNG · tối đa 25MB</span>
                <input type="file" className="hidden"
                  accept=".pdf,.ai,.cdr,.psd,.jpg,.jpeg,.png,.zip,.rar"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f && f.size > 25 * 1024 * 1024) return toast.error('File vượt quá 25MB')
                    setFile(f ?? null)
                  }} />
              </label>
              {file && (
                <div className="flex items-center gap-2 rounded-lg border bg-background p-2.5 text-sm">
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:sticky lg:top-20">
            <CardHeader><CardTitle>4. Tổng kết</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5 text-sm">
                <Row k="Cộng tiền hàng" v={vnd(totals.sub)} />
                <Row k="Tiền thuế GTGT" v={vnd(totals.vat)} />
                <div className="my-2 h-px bg-border" />
                <Row k="Tổng thanh toán" v={vnd(totals.total) + ' đ'} bold />
              </div>
              <div className="space-y-1.5">
                <Label>Ghi chú</Label>
                <Textarea rows={3} value={head.note}
                  onChange={e => setHead(h => ({ ...h, note: e.target.value }))}
                  placeholder="Yêu cầu đặc biệt, thời hạn giao..." />
              </div>
              <div className="grid gap-2">
                <Button onClick={() => save(true)} disabled={busy} size="lg">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Gửi Kế toán duyệt
                </Button>
                <Button variant="outline" onClick={() => save(false)} disabled={busy}>
                  <Save className="size-4" /> Lưu nháp
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

const F = ({ label, value, onChange, placeholder }) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <Input value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
  </div>
)
const Row = ({ k, v, bold }) => (
  <div className={`flex justify-between ${bold ? 'text-base font-bold' : ''}`}>
    <span className={bold ? '' : 'text-muted-foreground'}>{k}</span><span className="num">{v}</span>
  </div>
)

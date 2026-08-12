import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import PageHeader from '@/components/common/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import DesignLinksDialog from '@/components/common/DesignLinksDialog'
import OrderReviewDialog from '@/components/common/OrderReviewDialog'
import ProductSearchBox from '@/components/common/ProductSearchBox'
import ItemPicker from '@/components/common/ItemPicker'
import AnhMau from '@/components/common/AnhMau'
import CustomerPicker from '@/components/common/CustomerPicker'
import EntityPicker from '@/components/common/EntityPicker'
import ChungTu from '@/components/common/ChungTu'
import BankTxnPicker from '@/components/common/BankTxnPicker'
import DesignFilesEditor, { blankFile, isValidFile } from '@/components/common/DesignFilesEditor'
import { useItems } from '@/hooks/useItems'
import { useEntities } from '@/hooks/useEntities'
import { vnd, dmy, parseNum, loiTiengViet } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Plus, Trash2, Save, Send, Loader2, Info, PackagePlus, RefreshCw, HandCoins, Receipt } from 'lucide-react'
import { toast } from 'sonner'

const UNITS = ['Cái', 'Bộ', 'Chiếc', 'Kg', 'Tấn', 'Mét', 'M2', 'Thùng', 'Hộp', 'Tờ']
const VAT_RATES = [0, 5, 8, 10]

const blankLine = () => ({
  key: crypto.randomUUID(),
  item_code: '', item_name: '', spec: '',
  quantity: '1', unit: 'Cái', unit_price: '', vat_rate: 8,
  delivery_date: '', image_url: '', file_url: '', file_name: ''
})

export default function NewOrder() {
  const { profile } = useAuth()
  const nav = useNavigate()

  const [customers, setCustomers] = useState([])
  const [head, setHead] = useState({
    customer_id: '', customer_code: '', customer_name: '',
    customer_tax_code: '', customer_address: '', customer_phone: '',
    order_date: new Date().toISOString().slice(0, 10), note: '',
    deposit_expected: '', deposit_note: '', deposit_proof_path: '', deposit_bank_txn_id: null
  })
  const [lines, setLines] = useState([])
  const [files, setFiles] = useState([blankFile()])
  const [busy, setBusy] = useState(false)
  const [savedOrder, setSavedOrder] = useState(null)
  const [review, setReview] = useState(false)

  // Coc: khach chuyen khoan (chi ra khoan trong bang ke) hay dua tien mat
  const [cachCoc, setCachCoc] = useState('chua')   // chua | ck | tm
  const [khoanCoc, setKhoanCoc] = useState(null)

  const doiCachCoc = (v) => {
    setCachCoc(v)
    setKhoanCoc(null)
    setHead(h => ({
      ...h, deposit_bank_txn_id: null, deposit_expected: '',
      deposit_note: v === 'tm' ? 'Tiền mặt' : ''
    }))
  }

  /** Chon khoan tien ve -> tu dien so tien coc va hinh thuc */
  const chonKhoanCoc = (r) => {
    setKhoanCoc(r)
    setHead(h => ({
      ...h,
      deposit_bank_txn_id: r.id,
      deposit_expected: String(Math.round(Number(r.con_lai ?? r.amount_in))),
      deposit_note: `Chuyển khoản ${r.bank_name ?? ''} ${dmy(r.posting_date)} · ${r.bank_ref}`.trim()
    }))
  }

  const { items: catalogItems } = useItems({ onlyApproved: true })
  const { entities } = useEntities()

  // Don vi xuat hoa don — mac dinh lay don vi duoc danh dau mac dinh
  const [entity, setEntity] = useState(null)
  useEffect(() => {
    if (!entity && entities.length) setEntity(entities.find(e => e.is_default) ?? entities[0])
  }, [entities, entity])

  /** Doi don vi -> ap thue suat mac dinh cho cac dong CHUA sua thue */
  const doiDonVi = (e) => {
    setEntity(e)
    setLines(ls => ls.map(l => ({ ...l, vat_rate: e.default_vat_rate })))
    toast.success(`Chuyển sang xuất hóa đơn ${e.short_name} · VAT ${e.default_vat_rate}%`)
  }

  const [maGoiY, setMaGoiY] = useState('')

  const capMaKhachMoi = useCallback(async () => {
    const { data } = await supabase.rpc('next_customer_code')
    if (data) { setMaGoiY(data); setHead(h => (h.customer_id ? h : { ...h, customer_code: data })) }
  }, [])

  useEffect(() => {
    supabase.from('customers').select('*').order('name').then(({ data }) => setCustomers(data ?? []))
    capMaKhachMoi()
  }, [capMaKhachMoi])

  /* ---------- Dong hang hoa ---------- */
  const vatMacDinh = () => (entity ? Number(entity.default_vat_rate) : 8)

  const addFromCatalog = (it) => {
    setLines(l => {
      // da co trong don thi cong don so luong thay vi them dong trung
      const idx = l.findIndex(x => x.item_code === it.item_code)
      if (idx >= 0) {
        const next = [...l]
        next[idx] = { ...next[idx], quantity: String(parseNum(next[idx].quantity) + 1) }
        toast.success(`${it.item_code} — tăng số lượng lên ${parseNum(next[idx].quantity)}`)
        return next
      }
      toast.success(`Đã thêm ${it.item_code}`)
      return [...l, {
        ...blankLine(), vat_rate: vatMacDinh(),
        item_code: it.item_code, item_name: it.item_name,
        unit: it.unit || 'Cái',
        unit_price: it.list_price > 0 ? String(it.list_price) : ''
      }]
    })
  }
  const addBlank = () => setLines(l => [...l, { ...blankLine(), vat_rate: vatMacDinh() }])
  const delLine = (key) => setLines(l => l.filter(x => x.key !== key))
  const setLine = (key, patch) => setLines(l => l.map(x => (x.key === key ? { ...x, ...patch } : x)))

  const validFiles = useMemo(() => files.filter(isValidFile), [files])

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

  const validate = (forSubmit) => {
    if (!head.customer_name.trim()) return 'Chưa nhập tên khách hàng.'
    const ok = lines.filter(l => l.item_name.trim() && parseNum(l.quantity) > 0)
    if (!ok.length) return 'Đơn hàng phải có ít nhất 1 dòng hàng hóa hợp lệ.'
    return null
  }

  const save = async (forSubmit) => {
    const err = validate(forSubmit)
    if (err) return toast.error(err)
    setBusy(true)
    let orderId = null
    try {
      /* 1. Ma don sinh NGAY LUC LUU -> khong nhay coc so thu tu */
      const { data: code, error: eCode } =
        await supabase.rpc('next_order_code', { p_date: head.order_date })
      if (eCode) throw eCode

      /* 2. Khach hang: chon san thi dung luon, chua co thi tao moi.
            Neu ma go vao trung khach da ton tai -> dung khach do, khong tao trung. */
      let customerId = head.customer_id || null
      if (!customerId) {
        const maNhap = (head.customer_code || '').trim().toUpperCase()

        // Ma nay da co trong he thong chua?
        let daCo = null
        if (maNhap) {
          const { data } = await supabase.rpc('tim_khach_theo_ma', { p_code: maNhap })
          daCo = data?.[0] ?? null
        }

        if (daCo) {
          // Trung ma nhung ten khac han -> co the la go nham, dung lai de hoi
          const a = daCo.name.trim().toLowerCase()
          const b = head.customer_name.trim().toLowerCase()
          if (a !== b) {
            throw new Error(
              `Mã ${maNhap} đang là của khách "${daCo.name}". ` +
              `Nếu đúng khách này thì chọn từ danh sách phía trên; ` +
              `nếu là khách khác thì xóa ô mã để hệ thống tự cấp mã mới.`)
          }
          customerId = daCo.id
        } else {
          const { data: maMoi } = await supabase.rpc('next_customer_code')
          const { data: c, error: eC } = await supabase.from('customers').insert({
            customer_code: maNhap || maMoi || ('KH' + Date.now().toString().slice(-6)),
            name: head.customer_name, tax_code: head.customer_tax_code,
            address: head.customer_address, phone: head.customer_phone, created_by: profile.id
          }).select('id').single()
          if (eC) throw eC
          customerId = c.id
        }
      }

      const primary = validFiles[0] ?? null
      const primaryRef = primary
        ? (primary.source === 'link' ? primary.file_url.trim() : `storage:${primary.storage_path}`)
        : null

      /* 3. Don hang */
      const { data: order, error: eO } = await supabase.from('orders').insert({
        order_code: code,
        order_date: head.order_date,
        customer_id: customerId,
        customer_name: head.customer_name,
        customer_tax_code: head.customer_tax_code,
        customer_address: head.customer_address,
        customer_phone: head.customer_phone,
        sales_id: profile.id,
        entity_id: entity?.id ?? null,
        status: forSubmit ? 'pending_accounting' : 'draft',
        design_file_path: primaryRef,
        design_file_name: primary ? (primary.file_name.trim() || 'Thiết kế') : null,
        design_uploaded_at: primary ? new Date().toISOString() : null,
        deposit_expected: parseNum(head.deposit_expected),
        deposit_note: head.deposit_note || null,
        deposit_proof_path: head.deposit_proof_path || null,
        deposit_bank_txn_id: head.deposit_bank_txn_id,
        note: head.note
      }).select('id, order_code').single()
      if (eO) throw eO
      orderId = order.id

      /* 4. Chi tiet hang hoa */
      const payloadItems = lines
        .filter(l => l.item_name.trim() && parseNum(l.quantity) > 0)
        .map((l, i) => ({
          order_id: order.id, line_no: i + 1,
          item_code: l.item_code || null, item_name: l.item_name, spec: l.spec || null,
          quantity: parseNum(l.quantity), unit: l.unit,
          unit_price: parseNum(l.unit_price), vat_rate: Number(l.vat_rate) || 0,
          delivery_date: l.delivery_date || null,
          image_url: l.image_url || null,
          file_url: l.file_url || null,
          file_name: l.file_name || null
        }))
      const { error: eI } = await supabase.from('order_items').insert(payloadItems)
      if (eI) throw eI

      /* 5. Thiet ke Market */
      if (validFiles.length) {
        const payloadFiles = validFiles.map((f, i) => ({
          order_id: order.id, line_no: i + 1,
          source: f.source,
          file_name: f.file_name.trim() || `Thiết kế ${i + 1}`,
          file_url: f.source === 'link' ? f.file_url.trim() : null,
          storage_path: f.source === 'upload' ? f.storage_path : null,
          file_size: f.file_size ?? null,
          note: f.note?.trim() || null
        }))
        const { error: eF } = await supabase.from('order_files').insert(payloadFiles)
        if (eF) throw eF
      }

      if (forSubmit) {
        toast.success(`Đã gửi đơn ${order.order_code} sang Kế toán duyệt`)
        nav('/kinhdoanh/don-hang')
      } else {
        toast.success(`Đã lưu nháp đơn ${order.order_code}`)
        setSavedOrder({
          id: order.id, order_code: order.order_code, order_date: head.order_date,
          status: 'draft', customer_name: head.customer_name, customer_code: head.customer_code
        })
      }
    } catch (e) {
      if (orderId) await supabase.from('orders').delete().eq('id', orderId)
      toast.error(loiTiengViet(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Lập đơn hàng mới"
        desc="Mã đơn tự sinh khi bấm Lưu — số thứ tự liên tục 0001, 0002, 0003..." />

      <div className="space-y-5">
        {/* ============ 0. DON VI XUAT HOA DON ============ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="size-4" /> Đơn vị xuất hóa đơn
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <EntityPicker entities={entities} value={entity?.id} onChange={doiDonVi} />
            <p className="text-xs text-muted-foreground">
              Chọn đúng ngay từ đầu để sổ sách hai đơn vị không lẫn nhau.
              Kế toán và Ban Giám đốc vẫn đổi được sau nếu cần.
            </p>
          </CardContent>
        </Card>

        {/* ============ 1. KHACH HANG ============ */}
        <Card>
          <CardHeader><CardTitle>1. Thông tin khách hàng</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label>Tên khách hàng *</Label>
              <CustomerPicker
                customers={customers}
                value={head.customer_name}
                daChon={!!head.customer_id}
                onPick={c => setHead(h => ({
                  ...h, customer_id: c.id, customer_code: c.customer_code, customer_name: c.name,
                  customer_tax_code: c.tax_code ?? '', customer_address: c.address ?? '',
                  customer_phone: c.phone ?? ''
                }))}
                onFreeText={v => setHead(h => ({ ...h, customer_id: '', customer_name: v }))}
                onClear={() => setHead(h => ({
                  ...h, customer_id: '', customer_code: maGoiY, customer_name: '',
                  customer_tax_code: '', customer_address: '', customer_phone: ''
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Gõ tên để tìm khách đã có. Không có trong danh sách thì cứ gõ tên mới,
                hệ thống tự tạo khách hàng.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Mã khách hàng</Label>
                {!head.customer_id && (
                  <button type="button" onClick={capMaKhachMoi}
                    className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <RefreshCw className="size-3" /> Cấp mã mới
                  </button>
                )}
              </div>
              <Input value={head.customer_code} placeholder={maGoiY || 'KH001'}
                disabled={!!head.customer_id}
                onChange={e => setHead(h => ({ ...h, customer_code: e.target.value.toUpperCase() }))} />
            </div>
            <F label="Mã số thuế" value={head.customer_tax_code}
               onChange={v => setHead(h => ({ ...h, customer_tax_code: v }))} placeholder="0101234567" />
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Địa chỉ</Label>
              <Input value={head.customer_address}
                onChange={e => setHead(h => ({ ...h, customer_address: e.target.value }))} />
            </div>
            <F label="Số điện thoại" value={head.customer_phone}
               onChange={v => setHead(h => ({ ...h, customer_phone: v }))} placeholder="09xxxxxxxx" />
            <div className="space-y-1.5">
              <Label>Ngày lập đơn</Label>
              <Input type="date" value={head.order_date}
                onChange={e => setHead(h => ({ ...h, order_date: e.target.value }))} />
            </div>
          </CardContent>
        </Card>

        {/* ============ 2. HANG HOA — TOAN CHIEU NGANG ============ */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>2. Chi tiết hàng hóa</CardTitle>
            <Button size="sm" variant="outline" onClick={addBlank}>
              <Plus className="size-4" /> Thêm dòng trống
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProductSearchBox items={catalogItems} onAdd={addFromCatalog} />

            {!lines.length ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
                <PackagePlus className="size-8 text-muted-foreground/50" />
                <p className="font-medium">Chưa có hàng hóa nào</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Gõ vào ô tìm kiếm phía trên — ví dụ <b>tem nhôm</b> hoặc <b>40x160</b> — rồi bấm
                  vào sản phẩm để thêm vào đơn. Hàng ngoài danh mục thì dùng
                  &quot;Thêm dòng trống&quot;.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="w-10 py-2.5 text-left">#</th>
                        <th className="w-44 px-2 py-2.5 text-left">Mã hàng</th>
                        <th className="min-w-[260px] px-2 py-2.5 text-left">Tên hàng hóa *</th>
                        <th className="w-28 px-2 py-2.5 text-right">Số lượng</th>
                        <th className="w-28 px-2 py-2.5 text-left">ĐVT</th>
                        <th className="w-36 px-2 py-2.5 text-right">Đơn giá</th>
                        <th className="w-24 px-2 py-2.5 text-right">VAT</th>
                        <th className="w-36 px-2 py-2.5 text-right">Thành tiền</th>
                        <th className="w-36 px-2 py-2.5 text-left">Ngày giao</th>
                        <th className="w-28 px-2 py-2.5 text-center">Ảnh mẫu</th>
                        <th className="w-12" />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, i) => (
                        <tr key={l.key} className="border-b last:border-0">
                          <td className="py-2 text-muted-foreground">{i + 1}</td>
                          <td className="px-2">
                            <ItemPicker items={catalogItems} value={l.item_code}
                              onPick={it => setLine(l.key, {
                                item_code: it.item_code, item_name: it.item_name,
                                unit: it.unit || 'Cái',
                                unit_price: it.list_price > 0 ? String(it.list_price) : ''
                              })}
                              onFreeText={v => setLine(l.key, { item_code: v })} />
                          </td>
                          <td className="px-2">
                            <Input className="h-9" value={l.item_name}
                              onChange={e => setLine(l.key, { item_name: e.target.value })} />
                          </td>
                          <td className="px-2">
                            <Input className="h-9 text-right" inputMode="decimal" value={l.quantity}
                              onChange={e => setLine(l.key, { quantity: e.target.value })} />
                          </td>
                          <td className="px-2">
                            <Select className="h-9" value={l.unit}
                              onChange={e => setLine(l.key, { unit: e.target.value })}>
                              {UNITS.map(u => <option key={u}>{u}</option>)}
                            </Select>
                          </td>
                          <td className="px-2">
                            <Input className="h-9 text-right" inputMode="decimal" value={l.unit_price}
                              onChange={e => setLine(l.key, { unit_price: e.target.value })} />
                          </td>
                          <td className="px-2">
                            <Select className="h-9" value={l.vat_rate}
                              onChange={e => setLine(l.key, { vat_rate: e.target.value })}>
                              {VAT_RATES.map(v => <option key={v} value={v}>{v}%</option>)}
                            </Select>
                          </td>
                          <td className="num px-2 text-right font-semibold">
                            {vnd(parseNum(l.quantity) * parseNum(l.unit_price))}
                          </td>
                          <td className="px-2">
                            <Input className="h-9 text-xs" type="date" value={l.delivery_date}
                              onChange={e => setLine(l.key, { delivery_date: e.target.value })} />
                          </td>
                          <td className="px-2">
                            <div className="flex justify-center">
                              <AnhMau value={l.image_url} ten={l.item_name}
                                onChange={v => setLine(l.key, { image_url: v })} />
                            </div>
                          </td>
                          <td className="pl-1">
                            <Button variant="ghost" size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => delLine(l.key)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile / tablet */}
                <div className="space-y-3 lg:hidden">
                  {lines.map((l, i) => (
                    <div key={l.key} className="rounded-xl border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Dòng {i + 1}</span>
                        <Button variant="ghost" size="icon" onClick={() => delLine(l.key)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <ItemPicker items={catalogItems} value={l.item_code}
                            onPick={it => setLine(l.key, {
                              item_code: it.item_code, item_name: it.item_name,
                              unit: it.unit || 'Cái',
                              unit_price: it.list_price > 0 ? String(it.list_price) : ''
                            })}
                            onFreeText={v => setLine(l.key, { item_code: v })} />
                        </div>
                        <Input className="col-span-2" placeholder="Tên hàng hóa" value={l.item_name}
                          onChange={e => setLine(l.key, { item_name: e.target.value })} />
                        <Input placeholder="Số lượng" inputMode="decimal" value={l.quantity}
                          onChange={e => setLine(l.key, { quantity: e.target.value })} />
                        <Select value={l.unit} onChange={e => setLine(l.key, { unit: e.target.value })}>
                          {UNITS.map(u => <option key={u}>{u}</option>)}
                        </Select>
                        <Input placeholder="Đơn giá" inputMode="decimal" value={l.unit_price}
                          onChange={e => setLine(l.key, { unit_price: e.target.value })} />
                        <Select value={l.vat_rate} onChange={e => setLine(l.key, { vat_rate: e.target.value })}>
                          {VAT_RATES.map(v => <option key={v} value={v}>VAT {v}%</option>)}
                        </Select>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Ngày giao mặt hàng này</Label>
                          <Input type="date" value={l.delivery_date}
                            onChange={e => setLine(l.key, { delivery_date: e.target.value })} />
                        </div>
                        <div className="col-span-2 flex items-center gap-2">
                          <Label className="text-xs">Ảnh mẫu</Label>
                          <AnhMau value={l.image_url} ten={l.item_name}
                            onChange={v => setLine(l.key, { image_url: v })} />
                        </div>
                        <div className="num col-span-2 flex items-center justify-end border-t pt-2 text-sm font-semibold">
                          {vnd(parseNum(l.quantity) * parseNum(l.unit_price))} đ
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tong ket nhanh ngay duoi bang */}
                <div className="flex flex-col items-end gap-1 border-t pt-3 text-sm">
                  <Row k="Cộng tiền hàng" v={vnd(totals.sub)} />
                  <Row k="Tiền thuế GTGT" v={vnd(totals.vat)} />
                  <Row k="Tổng thanh toán" v={vnd(totals.total) + ' đ'} bold />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ============ 3 + 4 ============ */}
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className={validFiles.length ? '' : 'border-amber-300 bg-amber-50/40'}>
            <CardHeader><CardTitle>3. Thiết kế Market</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="flex gap-2 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
                <Info className="size-4 shrink-0" />
                Không bắt buộc lúc này. Bấm <b>Lưu nháp</b> để lấy mã đơn rồi bổ sung sau,
                hoặc gửi duyệt luôn và thêm thiết kế khi có.
              </p>
              <DesignFilesEditor rows={files} setRows={setFiles}
                folderHint={head.customer_code || 'don-moi'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>4. Ghi chú &amp; hoàn tất</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* ----- Tien coc khach dua ngay khi dat hang ----- */}
              <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
                <div className="flex items-center gap-2">
                  <HandCoins className="size-4 text-sky-700" />
                  <Label className="text-sky-900">Khách đặt cọc</Label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[['chua', 'Chưa cọc'], ['ck', 'Chuyển khoản'], ['tm', 'Tiền mặt']].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => doiCachCoc(v)}
                      className={cn('rounded-lg border-2 px-2 py-2 text-xs font-medium transition',
                        cachCoc === v ? 'border-sky-500 bg-white text-sky-900' : 'border-transparent bg-white/60 text-muted-foreground hover:bg-white')}>
                      {l}
                    </button>
                  ))}
                </div>

                {cachCoc === 'ck' && (
                  <BankTxnPicker
                    order={{ debt_amount: totals.total }}
                    value={khoanCoc}
                    soTienGhi={parseNum(head.deposit_expected)}
                    onPick={chonKhoanCoc}
                    onClear={() => {
                      setKhoanCoc(null)
                      setHead(h => ({ ...h, deposit_bank_txn_id: null }))
                    }} />
                )}

                {cachCoc !== 'chua' && (
                  <>
                    <Input inputMode="decimal" placeholder="Số tiền cọc" value={head.deposit_expected}
                      onChange={e => setHead(h => ({ ...h, deposit_expected: e.target.value }))} />
                    {parseNum(head.deposit_expected) > 0 && (
                      <div className="num space-y-0.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cọc</span>
                          <b className="text-sky-800">{vnd(parseNum(head.deposit_expected))} đ</b>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Còn lại phải thu</span>
                          <b className={totals.total - parseNum(head.deposit_expected) > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                            {vnd(Math.max(0, totals.total - parseNum(head.deposit_expected)))} đ
                          </b>
                        </div>
                      </div>
                    )}
                    <Input placeholder={cachCoc === 'tm' ? 'Ai đưa, đưa ở đâu' : 'Ghi chú thêm'}
                      value={head.deposit_note}
                      onChange={e => setHead(h => ({ ...h, deposit_note: e.target.value }))} />
                  </>
                )}

                {cachCoc !== 'chua' && (
                  <p className="text-xs text-sky-800">
                    {khoanCoc
                      ? <>Đã chỉ đúng khoản khách chuyển — Kế toán bấm xác nhận là vào sổ, khỏi dò sao kê.</>
                      : cachCoc === 'tm'
                        ? <>Tiền mặt là <b>lời khai</b>. Kế toán đếm tiền thực tế rồi mới xác nhận vào sổ.</>
                        : <>Chọn khoản tiền về ở trên để Kế toán khỏi phải dò lại sao kê.</>}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Ghi chú</Label>
                <Textarea rows={3} value={head.note}
                  onChange={e => setHead(h => ({ ...h, note: e.target.value }))}
                  placeholder="Yêu cầu đặc biệt, thời hạn giao..." />
              </div>

              <div className="space-y-1.5 rounded-xl border bg-muted/40 p-4 text-sm">
                <Row k="Cộng tiền hàng" v={vnd(totals.sub)} />
                <Row k="Tiền thuế GTGT" v={vnd(totals.vat)} />
                <div className="my-1 h-px bg-border" />
                <Row k="Tổng thanh toán" v={vnd(totals.total) + ' đ'} bold />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={() => save(false)} disabled={busy} size="lg">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Lưu nháp &amp; lấy mã đơn
                </Button>
                <Button variant="outline" size="lg" disabled={busy}
                  onClick={() => {
                    const err = validate(true)
                    if (err) return toast.error(err)
                    setReview(true)
                  }}>
                  <Send className="size-4" /> Xem lại &amp; gửi duyệt
                </Button>
              </div>
              {!validFiles.length && (
                <p className="text-center text-xs text-amber-700">
                  Chưa có thiết kế Market — vẫn gửi duyệt được, nhớ bổ sung sau
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <OrderReviewDialog
        open={review} onOpenChange={setReview}
        head={{ ...head, entity_name: entity?.short_name, entity_tax: entity?.tax_code }}
        lines={lines.map(l => ({ ...l, quantity: parseNum(l.quantity), unit_price: parseNum(l.unit_price) }))}
        files={validFiles}
        totals={totals}
        busy={busy}
        onConfirm={async () => { setReview(false); await save(true) }}
      />

      <DesignLinksDialog
        order={savedOrder}
        open={!!savedOrder}
        onOpenChange={v => { if (!v) { setSavedOrder(null); nav('/kinhdoanh/don-hang') } }}
        onSaved={() => {}}
      />
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
  <div className={`flex w-full max-w-xs justify-between ${bold ? 'text-base font-bold' : ''}`}>
    <span className={bold ? '' : 'text-muted-foreground'}>{k}</span><span className="num">{v}</span>
  </div>
)

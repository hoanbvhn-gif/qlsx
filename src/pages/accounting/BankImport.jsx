import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { docSaoKe } from '@/lib/bankImport'
import PageHeader from '@/components/common/PageHeader'
import StatCard from '@/components/common/StatCard'
import EmptyState from '@/components/common/EmptyState'
import ChoXacNhanBox from '@/components/common/ChoXacNhanBox'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { vnd, dmy, loiTiengViet } from '@/lib/format'
import { cn, noAccent } from '@/lib/utils'
import {
  Upload, Landmark, CheckCircle2, Clock, FileSpreadsheet, Loader2,
  Search, EyeOff, RotateCcw, Link2, PieChart
} from 'lucide-react'
import { toast } from 'sonner'

const TRANG_THAI = {
  chua_khop:     { label: 'Chưa dùng',    tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  khop_mot_phan: { label: 'Dùng một phần', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  khop_du:       { label: 'Đã dùng hết',  tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  bo_qua:        { label: 'Bỏ qua',       tone: 'bg-slate-100 text-slate-600 border-slate-200' }
}

export default function BankImport() {
  const { profile } = useAuth()
  const ketoan = ['accounting', 'management'].includes(profile?.role)
  const inputRef = useRef(null)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('chua_khop')

  const [xemTruoc, setXemTruoc] = useState(null)
  const [dangDoc, setDangDoc] = useState(false)
  const [dangNhap, setDangNhap] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('v_tien_ve_all')
      .select('*').order('posting_date', { ascending: false }).limit(500)
    if (error) toast.error(loiTiengViet(error))
    setRows(data ?? []); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  /* ---------- Doc file sao ke ---------- */
  const chonFile = async (file) => {
    if (!file) return
    setDangDoc(true)
    try {
      const kq = await docSaoKe(file)
      if (kq.loi) { toast.error(kq.loi); setXemTruoc(null); return }

      const refs = kq.rows.map(r => r.bank_ref)
      const { data: daCo } = await supabase.from('bank_transactions')
        .select('bank_ref').in('bank_ref', refs)
      const tapDaCo = new Set((daCo ?? []).map(x => x.bank_ref))

      setXemTruoc({
        ...kq,
        tenFile: file.name,
        moi: kq.rows.filter(r => !tapDaCo.has(r.bank_ref)),
        trung: kq.rows.filter(r => tapDaCo.has(r.bank_ref))
      })
    } catch (e) {
      toast.error('Không đọc được file: ' + (e.message ?? e))
      setXemTruoc(null)
    } finally {
      setDangDoc(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const nhapVaoHeThong = async () => {
    if (!xemTruoc?.moi.length) return
    setDangNhap(true)
    const payload = xemTruoc.moi.map(r => ({ ...r, imported_by: profile.id }))
    const { error } = await supabase.from('bank_transactions').insert(payload)
    if (error) { setDangNhap(false); return toast.error(loiTiengViet(error)) }

    await supabase.rpc('ghi_nhat_ky_nhap_bang_ke', {
      p_so_moi: xemTruoc.moi.length,
      p_so_bo_qua: xemTruoc.trung.length,
      p_tu: xemTruoc.tu, p_den: xemTruoc.den
    })
    setDangNhap(false)
    toast.success(`Đã nhập ${xemTruoc.moi.length} giao dịch mới`
      + (xemTruoc.trung.length ? `, bỏ qua ${xemTruoc.trung.length} giao dịch đã có` : ''))
    setXemTruoc(null); load()
  }

  const boQua = async (r) => {
    const { error } = await supabase.from('bank_transactions')
      .update({ ignored: !r.ignored, ignore_reason: r.ignored ? null : 'Không liên quan đơn hàng' })
      .eq('id', r.id)
    if (error) return toast.error(loiTiengViet(error))
    load()
  }

  /* ---------- Loc ---------- */
  const nhom = useMemo(() => {
    const key = noAccent(q)
    const so = q.replace(/[.,\s]/g, '')
    const loc = rows.filter(r => !key ||
      noAccent(`${r.counterparty ?? ''} ${r.content ?? ''} ${r.bank_ref} ${r.cac_don ?? ''} ${r.cac_khach ?? ''}`).includes(key) ||
      (/^\d+$/.test(so) && String(Math.round(Number(r.amount_in))).includes(so)))
    return {
      chua_khop: loc.filter(r => r.trang_thai === 'chua_khop' || r.trang_thai === 'khop_mot_phan'),
      khop:      loc.filter(r => r.trang_thai === 'khop_du'),
      bo_qua:    loc.filter(r => r.trang_thai === 'bo_qua'),
      all:       loc
    }
  }, [rows, q])

  const tong = useMemo(() => {
    const chuaDung = rows.filter(r => !r.ignored && Number(r.con_lai) > 0.01)
    return {
      conLai: chuaDung.reduce((a, r) => a + Number(r.con_lai), 0),
      soConLai: chuaDung.length,
      cho: rows.reduce((a, r) => a + Number(r.so_cho_xac_nhan ?? 0), 0),
      tongVe: rows.reduce((a, r) => a + Number(r.amount_in), 0)
    }
  }, [rows])

  const TAB = [
    ['chua_khop', 'Còn dùng được'],
    ['khop', 'Đã dùng hết'],
    ['bo_qua', 'Bỏ qua'],
    ['all', 'Tất cả']
  ]

  return (
    <>
      <PageHeader
        title={ketoan ? 'Bảng kê ngân hàng' : 'Tiền về ngân hàng'}
        desc={ketoan
          ? 'Nhập sao kê để đối chiếu tiền về với bút toán thu tiền'
          : 'Các khoản khách chuyển về tài khoản công ty — chọn đơn của bạn để ghi nhận'}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={load}><RotateCcw className="size-4" /> Tải lại</Button>
            {ketoan && (
              <>
                <Button onClick={() => inputRef.current?.click()} disabled={dangDoc}>
                  {dangDoc ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  Nhập bảng kê
                </Button>
                <input ref={inputRef} type="file" className="hidden" accept=".xlsx,.xls,.csv"
                  onChange={e => chonFile(e.target.files?.[0])} />
              </>
            )}
          </div>
        } />

      {ketoan && <ChoXacNhanBox onDone={load} />}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng tiền về" value={vnd(tong.tongVe)} icon={Landmark} />
        <StatCard label="Chưa phân bổ" value={vnd(tong.conLai)} icon={Clock} tone="text-amber-600"
          sub={`${tong.soConLai} khoản còn dùng được`} />
        <StatCard label="Chờ xác nhận" value={tong.cho} icon={PieChart} tone="text-sky-600"
          sub="bút toán kinh doanh gửi lên" />
        <StatCard label="Số giao dịch" value={rows.length} icon={FileSpreadsheet} />
      </div>

      {/* ---------- Xem truoc ---------- */}
      {xemTruoc && (
        <Card className="mb-5 border-2 border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5" /> Xem trước · {xemTruoc.tenFile}
            </CardTitle>
            <CardDescription>
              {xemTruoc.tenNganHang || 'Ngân hàng'}
              {xemTruoc.soTaiKhoan ? ` · TK ${xemTruoc.soTaiKhoan}` : ''}
              {xemTruoc.tu ? ` · từ ${dmy(xemTruoc.tu)} đến ${dmy(xemTruoc.den)}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <ONho k="Giao dịch tiền về" v={xemTruoc.rows.length} />
              <ONho k="Thêm mới" v={xemTruoc.moi.length} tone="text-emerald-600" />
              <ONho k="Đã có, bỏ qua" v={xemTruoc.trung.length} tone="text-muted-foreground" />
            </div>

            {!!xemTruoc.moi.length && (
              <div className="max-h-64 overflow-y-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ngày</TableHead>
                      <TableHead className="text-right">Số tiền</TableHead>
                      <TableHead>Đơn vị chuyển</TableHead>
                      <TableHead>Nội dung</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {xemTruoc.moi.map(r => (
                      <TableRow key={r.bank_ref}>
                        <TableCell className="whitespace-nowrap">{dmy(r.posting_date)}</TableCell>
                        <TableCell className="num text-right font-semibold text-emerald-700">
                          {vnd(r.amount_in)}
                        </TableCell>
                        <TableCell className="min-w-[180px]">{r.counterparty}</TableCell>
                        <TableCell className="max-w-[320px] truncate text-xs text-muted-foreground">
                          {r.content}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={nhapVaoHeThong} disabled={dangNhap || !xemTruoc.moi.length}>
                {dangNhap ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Nhập {xemTruoc.moi.length} giao dịch
              </Button>
              <Button variant="outline" onClick={() => setXemTruoc(null)}>Hủy</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------- Danh sach ---------- */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Tìm theo số tiền, tên đơn vị chuyển, nội dung, mã đơn..."
          value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {loading ? <Skeleton className="h-64 w-full" /> : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            {TAB.map(([k, label]) => (
              <TabsTrigger key={k} value={k} className="gap-1.5">
                {label}
                <span className={cn('rounded-full px-1.5 text-[11px] font-semibold',
                  tab === k ? 'bg-muted text-foreground' : 'bg-muted/70 text-muted-foreground')}>
                  {nhom[k].length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {TAB.map(([k]) => (
            <TabsContent key={k} value={k}>
              {!nhom[k].length ? (
                <EmptyState icon={Landmark} title="Không có giao dịch nào"
                  desc={k === 'chua_khop'
                    ? 'Mọi khoản tiền về đều đã được ghi vào đơn hàng.'
                    : 'Đổi tab hoặc bỏ bớt tìm kiếm.'} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ngày về</TableHead>
                      <TableHead className="text-right">Số tiền</TableHead>
                      <TableHead className="text-right">Còn lại</TableHead>
                      <TableHead>Đơn vị chuyển</TableHead>
                      <TableHead>Nội dung chuyển khoản</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Đã ghi vào đơn</TableHead>
                      {ketoan && <TableHead className="text-right">Bỏ qua</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nhom[k].map(r => {
                      const t = TRANG_THAI[r.trang_thai] ?? {}
                      return (
                        <TableRow key={r.id} className={cn(r.ignored && 'opacity-60')}>
                          <TableCell className="whitespace-nowrap">
                            {dmy(r.posting_date)}
                            <span className="block font-mono text-[11px] text-muted-foreground">{r.bank_ref}</span>
                          </TableCell>
                          <TableCell className="num text-right font-semibold text-emerald-700">
                            {vnd(r.amount_in)}
                          </TableCell>
                          <TableCell className={cn('num text-right font-medium',
                            Number(r.con_lai) > 0.01 ? 'text-amber-700' : 'text-muted-foreground')}>
                            {vnd(r.con_lai)}
                          </TableCell>
                          <TableCell className="min-w-[170px]">{r.counterparty}</TableCell>
                          <TableCell className="max-w-[300px]">
                            <span className="line-clamp-2 text-xs text-muted-foreground">{r.content}</span>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge className={t.tone}>{t.label}</Badge>
                              {Number(r.so_cho_xac_nhan) > 0 && (
                                <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                                  <Clock className="size-3" /> {r.so_cho_xac_nhan} chờ duyệt
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {r.cac_don ? (
                              <div className="text-xs">
                                <p className="flex items-center gap-1 font-mono font-medium">
                                  <Link2 className="size-3" />{r.cac_don}
                                </p>
                                <p className="truncate text-muted-foreground">{r.cac_khach}</p>
                              </div>
                            ) : <span className="text-xs text-muted-foreground">--</span>}
                          </TableCell>
                          {ketoan && (
                            <TableCell className="text-right">
                              {!Number(r.so_but_toan) && (
                                <Button size="sm" variant="ghost" onClick={() => boQua(r)}
                                  title={r.ignored ? 'Đưa lại vào danh sách chờ' : 'Khoản này không liên quan đơn hàng'}>
                                  <EyeOff className={cn('size-4', r.ignored && 'text-muted-foreground')} />
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <p className="mt-4 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
        {ketoan ? (
          <>
            <b>Cách dùng:</b> tải sao kê từ ngân hàng (file Excel) rồi bấm <b>Nhập bảng kê</b>.
            Hệ thống chỉ lấy các khoản <b>tiền về</b>, chống trùng theo số bút toán nên nhập lại
            cùng một file cũng không sinh dữ liệu thừa.
            <br /><br />
            Kinh doanh gắn khoản tiền vào đơn của họ, bạn kiểm rồi bấm <b>Xác nhận</b> ở khung
            vàng phía trên — lúc đó tiền mới vào công nợ. Khoản không liên quan đơn hàng
            (hoàn tiền nhà cung cấp, chuyển nội bộ) thì bấm <b>Bỏ qua</b>.
          </>
        ) : (
          <>
            <b>Cách dùng:</b> đây là các khoản khách chuyển về tài khoản công ty.
            Thấy khoản của khách mình, sang <b>Đơn hàng của tôi</b> → bấm <b>Tiền về</b> ở đơn
            tương ứng để gắn khoản đó vào đơn. Kế toán xác nhận là công nợ tự trừ.
            <br /><br />
            Một khoản chuyển chia được cho <b>nhiều đơn</b>, và một đơn nhận được <b>nhiều lần
            chuyển</b> — cột <b>Còn lại</b> cho biết khoản đó còn bao nhiêu chưa gắn vào đơn nào.
          </>
        )}
      </p>
    </>
  )
}

const ONho = ({ k, v, tone = '' }) => (
  <div className="rounded-lg border bg-muted/40 p-3 text-center">
    <p className="text-xs text-muted-foreground">{k}</p>
    <p className={cn('text-xl font-bold', tone)}>{v}</p>
  </div>
)

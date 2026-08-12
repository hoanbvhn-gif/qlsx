import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useOrders } from '@/hooks/useOrders'
import PageHeader from '@/components/common/PageHeader'
import StatCard from '@/components/common/StatCard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import EmptyState from '@/components/common/EmptyState'
import { cn } from '@/lib/utils'
import { useEntities, entityTone } from '@/hooks/useEntities'
import { vnd, dmy, STATUS, DEPT_OF_STATUS } from '@/lib/format'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts'
import { TrendingUp, Wallet, AlertTriangle, Receipt, Factory, Clock, CheckCircle2, Users, Building2, Store } from 'lucide-react'

const COLORS = ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6', '#94a3b8']
const fmtAxis = v => (v >= 1e9 ? (v / 1e9).toFixed(1) + ' tỷ' : (v / 1e6).toFixed(0) + ' tr')

export default function Analytics() {
  const { orders, loading } = useOrders()
  const [year, setYear] = useState(new Date().getFullYear())

  // Cong no THUC (hang da giao chua thu), ton san xuat, hieu suat NVKD
  const [debts, setDebts] = useState([])
  const [wip, setWip] = useState([])
  const [perf, setPerf] = useState([])
  const [theoDV, setTheoDV] = useState([])      // tong hop theo don vi phat hanh
  const [locDV, setLocDV] = useState('')        // '' = ca hai don vi
  const { entities } = useEntities()

  useEffect(() => {
    supabase.from('v_cong_no_thuc').select('*').order('so_ngay_no', { ascending: false })
      .then(({ data }) => setDebts(data ?? []))
    supabase.from('v_ton_san_xuat').select('*').order('so_ngay_ke_tu_duyet', { ascending: false })
      .then(({ data }) => setWip(data ?? []))
    supabase.from('v_kd_hieu_suat').select('*').order('doanh_thu', { ascending: false })
      .then(({ data }) => setPerf(data ?? []))
    supabase.from('v_theo_don_vi').select('*')
      .then(({ data }) => setTheoDV(data ?? []))
  }, [])

  const tongCongNo = useMemo(() => debts.reduce((a, r) => a + Number(r.debt_amount), 0), [debts])
  const tongTon = useMemo(() => wip.reduce((a, r) => a + Number(r.total_amount), 0), [wip])
  const treHan = useMemo(() => wip.filter(r => r.so_ngay_tre_han > 0).length, [wip])

  const live = useMemo(() => orders.filter(o =>
    !['draft', 'cancelled'].includes(o.status) && (!locDV || o.entity_id === locDV)
  ), [orders, locDV])
  const years = useMemo(() =>
    [...new Set(orders.map(o => new Date(o.order_date).getFullYear()))].sort((a, b) => b - a), [orders])
  const inYear = useMemo(() => live.filter(o => new Date(o.order_date).getFullYear() === Number(year)), [live, year])

  const kpi = useMemo(() => ({
    revenue: inYear.reduce((a, o) => a + Number(o.total_amount), 0),
    collected: inYear.reduce((a, o) => a + Number(o.paid_amount), 0),
    debt: inYear.reduce((a, o) => a + Number(o.debt_amount), 0),
    count: inYear.length
  }), [inYear])

  const byMonth = useMemo(() => {
    const arr = Array.from({ length: 12 }, (_, i) => ({ thang: `T${i + 1}`, doanhthu: 0, dathu: 0, congno: 0 }))
    inYear.forEach(o => {
      const m = new Date(o.order_date).getMonth()
      arr[m].doanhthu += Number(o.total_amount)
      arr[m].dathu += Number(o.paid_amount)
      arr[m].congno += Number(o.debt_amount)
    })
    return arr
  }, [inYear])

  const byQuarter = useMemo(() => {
    const arr = [1, 2, 3, 4].map(q => ({ quy: `Quý ${q}`, doanhthu: 0, sodon: 0 }))
    inYear.forEach(o => {
      const q = Math.floor(new Date(o.order_date).getMonth() / 3)
      arr[q].doanhthu += Number(o.total_amount)
      arr[q].sodon += 1
    })
    return arr
  }, [inYear])

  const bySales = useMemo(() => {
    const m = new Map()
    inYear.forEach(o => {
      const k = o.sales?.full_name ?? 'Không rõ'
      const c = m.get(k) ?? { nvkd: k, doanhthu: 0, dathu: 0, congno: 0, sodon: 0 }
      c.doanhthu += Number(o.total_amount); c.dathu += Number(o.paid_amount)
      c.congno += Number(o.debt_amount); c.sodon += 1
      m.set(k, c)
    })
    return [...m.values()].sort((a, b) => b.doanhthu - a.doanhthu)
  }, [inYear])

  const byStatus = useMemo(() => {
    const m = new Map()
    orders.filter(o => o.status !== 'cancelled')
      .forEach(o => m.set(o.status, (m.get(o.status) ?? 0) + 1))
    return [...m.entries()].map(([k, v]) => ({
      name: STATUS[k]?.label ?? k, key: k, value: v, bophan: DEPT_OF_STATUS[k]
    }))
  }, [orders])

  const bottleneck = useMemo(
    () => [...byStatus].sort((a, b) => b.value - a.value)[0], [byStatus])

  if (loading) return <Skeleton className="h-96 w-full" />

  return (
    <>
      <PageHeader
        title="Báo cáo tổng hợp"
        desc="Doanh số, công nợ và tình trạng luân chuyển đơn hàng"
        action={
          <div className="flex flex-wrap gap-2">
            <Select className="w-48" value={locDV} onChange={e => setLocDV(e.target.value)}>
              <option value="">Cả hai đơn vị</option>
              {entities.map(e => <option key={e.id} value={e.id}>{e.short_name}</option>)}
            </Select>
            <Select className="w-36" value={year} onChange={e => setYear(e.target.value)}>
              {(years.length ? years : [new Date().getFullYear()]).map(y => <option key={y} value={y}>Năm {y}</option>)}
            </Select>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Doanh thu ${year}`} value={vnd(kpi.revenue)} icon={TrendingUp} sub={`${kpi.count} đơn hàng`} />
        <StatCard label="Đã thu" value={vnd(kpi.collected)} icon={Wallet} tone="text-emerald-600"
          sub={kpi.revenue ? `${((kpi.collected / kpi.revenue) * 100).toFixed(1)}% doanh thu` : ''} />
        <StatCard label="Công nợ phải thu" value={vnd(tongCongNo)} icon={AlertTriangle} tone="text-rose-600"
          sub={`${debts.length} đơn đã giao chưa thu đủ`} />
        <StatCard label="Đang ở Sản xuất" value={vnd(tongTon)} icon={Factory} tone="text-indigo-600"
          sub={`${wip.length} đơn${treHan ? ` · ${treHan} đơn trễ hạn` : ''}`} />
      </div>

      <Tabs defaultValue="thang" className="mt-5">
        <TabsList className="flex-wrap">
          <TabsTrigger value="thang">Theo tháng</TabsTrigger>
          <TabsTrigger value="quy">Theo quý</TabsTrigger>
          <TabsTrigger value="nvkd">Biểu đồ NVKD</TabsTrigger>
          <TabsTrigger value="donvi">So sánh 2 đơn vị</TabsTrigger>
          <TabsTrigger value="hieusuat">Doanh thu &amp; công nợ NVKD</TabsTrigger>
          <TabsTrigger value="congno">Chi tiết công nợ</TabsTrigger>
          <TabsTrigger value="tonsx">Tồn sản xuất</TabsTrigger>
        </TabsList>

        <TabsContent value="thang">
          <Card>
            <CardHeader><CardTitle>Doanh thu / Đã thu / Công nợ theo tháng · {year}</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="thang" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={fmtAxis} />
                  <Tooltip formatter={v => vnd(v) + ' đ'} />
                  <Legend />
                  <Line type="monotone" dataKey="doanhthu" name="Doanh thu" stroke="#0ea5e9" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="dathu" name="Đã thu" stroke="#10b981" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="congno" name="Công nợ" stroke="#ef4444" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quy">
          <Card>
            <CardHeader><CardTitle>Doanh thu theo quý · {year}</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byQuarter}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="quy" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={fmtAxis} />
                  <Tooltip formatter={v => vnd(v) + ' đ'} />
                  <Bar dataKey="doanhthu" name="Doanh thu" radius={[8, 8, 0, 0]} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nvkd">
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader><CardTitle>Doanh số theo nhân viên kinh doanh</CardTitle></CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bySales} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                    <XAxis type="number" fontSize={12} tickFormatter={fmtAxis} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="nvkd" width={110} fontSize={12} axisLine={false} tickLine={false} />
                    <Tooltip formatter={v => vnd(v) + ' đ'} />
                    <Legend />
                    <Bar dataKey="doanhthu" name="Doanh thu" radius={[0, 6, 6, 0]} fill="#0ea5e9" />
                    <Bar dataKey="congno" name="Công nợ" radius={[0, 6, 6, 0]} fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Bảng xếp hạng</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {bySales.map((s, i) => (
                  <div key={s.nvkd} className="flex items-center gap-3 rounded-lg border p-2.5">
                    <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-bold">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.nvkd}</p>
                      <p className="text-xs text-muted-foreground">{s.sodon} đơn</p>
                    </div>
                    <div className="num shrink-0 text-right">
                      <p className="text-sm font-semibold">{vnd(s.doanhthu)}</p>
                      <p className="text-xs text-rose-600">nợ {vnd(s.congno)}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------- SO SANH HAI DON VI PHAT HANH ---------- */}
        <TabsContent value="donvi">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              {theoDV.map(d => {
                const Icon = d.code === 'HKD' ? Store : Building2
                return (
                  <Card key={d.entity_id} className={cn('border-2',
                    d.code === 'HKD' ? 'border-orange-200' : 'border-indigo-200')}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2">
                        <Icon className={cn('size-5',
                          d.code === 'HKD' ? 'text-orange-600' : 'text-indigo-600')} />
                        {d.short_name}
                      </CardTitle>
                      <CardDescription>
                        {d.tax_code ? `MST ${d.tax_code}` : 'Chưa khai mã số thuế'} · {d.so_don} đơn hàng
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1.5 text-sm">
                      <Dong k="Tiền hàng" v={vnd(d.tien_hang)} />
                      <Dong k="Tiền thuế GTGT" v={vnd(d.tien_thue)} />
                      <div className="my-1 h-px bg-border" />
                      <Dong k="Doanh thu" v={vnd(d.doanh_thu)} bold />
                      <Dong k="Đã thu" v={vnd(d.da_thu)} tone="text-emerald-600" />
                      <Dong k="Công nợ (đã giao)" v={vnd(d.cong_no)} tone="text-rose-600" bold />
                      <Dong k="Đang chạy" v={vnd(d.dang_chay)} tone="text-indigo-600" />
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Đối chiếu hai đơn vị</CardTitle>
                <CardDescription>
                  Số liệu tách rời theo pháp nhân phát hành hóa đơn — dùng khi lập tờ khai thuế
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Đơn vị</TableHead>
                      <TableHead className="text-right">Số đơn</TableHead>
                      <TableHead className="text-right">Tiền hàng</TableHead>
                      <TableHead className="text-right">Thuế GTGT</TableHead>
                      <TableHead className="text-right">Doanh thu</TableHead>
                      <TableHead className="text-right">Đã thu</TableHead>
                      <TableHead className="text-right">Công nợ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {theoDV.map(d => (
                      <TableRow key={d.entity_id}>
                        <TableCell>
                          <Badge className={entityTone(d.code)}>{d.short_name}</Badge>
                          {d.tax_code && <span className="block text-xs text-muted-foreground">MST {d.tax_code}</span>}
                        </TableCell>
                        <TableCell className="num text-right">{d.so_don}</TableCell>
                        <TableCell className="num text-right">{vnd(d.tien_hang)}</TableCell>
                        <TableCell className="num text-right">{vnd(d.tien_thue)}</TableCell>
                        <TableCell className="num text-right font-medium">{vnd(d.doanh_thu)}</TableCell>
                        <TableCell className="num text-right text-emerald-600">{vnd(d.da_thu)}</TableCell>
                        <TableCell className="num text-right font-semibold text-rose-600">{vnd(d.cong_no)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Tổng cộng</TableCell>
                      <TableCell className="num text-right">{theoDV.reduce((a, d) => a + Number(d.so_don), 0)}</TableCell>
                      <TableCell className="num text-right">{vnd(theoDV.reduce((a, d) => a + Number(d.tien_hang), 0))}</TableCell>
                      <TableCell className="num text-right">{vnd(theoDV.reduce((a, d) => a + Number(d.tien_thue), 0))}</TableCell>
                      <TableCell className="num text-right">{vnd(theoDV.reduce((a, d) => a + Number(d.doanh_thu), 0))}</TableCell>
                      <TableCell className="num text-right text-emerald-700">{vnd(theoDV.reduce((a, d) => a + Number(d.da_thu), 0))}</TableCell>
                      <TableCell className="num text-right text-rose-600">{vnd(theoDV.reduce((a, d) => a + Number(d.cong_no), 0))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------- DOANH THU & CONG NO THEO NVKD ---------- */}
        <TabsContent value="hieusuat">
          <Card>
            <CardHeader>
              <CardTitle>Doanh thu và công nợ theo nhân viên kinh doanh</CardTitle>
              <CardDescription>
                Công nợ chỉ tính đơn <b>đã giao hàng</b> mà chưa thu đủ tiền. Đơn chưa giao xếp vào
                cột &quot;Đang chạy&quot; — chưa phải công nợ.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!perf.length ? <EmptyState icon={Users} title="Chưa có dữ liệu" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nhân viên</TableHead>
                      <TableHead className="text-right">Số đơn</TableHead>
                      <TableHead className="text-right">Doanh thu</TableHead>
                      <TableHead className="text-right">Đã thu</TableHead>
                      <TableHead className="text-right">Công nợ</TableHead>
                      <TableHead className="text-right">Đang chạy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perf.map(r => (
                      <TableRow key={r.sales_id}>
                        <TableCell className="font-medium">
                          {r.sales_name}
                          {r.employee_code && <span className="block text-xs text-muted-foreground">{r.employee_code}</span>}
                        </TableCell>
                        <TableCell className="num text-right">{r.so_don}</TableCell>
                        <TableCell className="num text-right font-medium">{vnd(r.doanh_thu)}</TableCell>
                        <TableCell className="num text-right text-emerald-600">{vnd(r.da_thu)}</TableCell>
                        <TableCell className="text-right">
                          <span className={cn('num font-semibold', Number(r.cong_no) > 0 ? 'text-rose-600' : 'text-muted-foreground')}>
                            {vnd(r.cong_no)}
                          </span>
                          {r.so_don_con_no > 0 && (
                            <span className="block text-xs text-muted-foreground">{r.so_don_con_no} đơn</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="num text-indigo-600">{vnd(r.dang_chay)}</span>
                          {r.so_don_dang_sx > 0 && (
                            <span className="block text-xs text-muted-foreground">{r.so_don_dang_sx} đơn ở SX</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Tổng cộng</TableCell>
                      <TableCell className="num text-right">{perf.reduce((a, r) => a + Number(r.so_don), 0)}</TableCell>
                      <TableCell className="num text-right">{vnd(perf.reduce((a, r) => a + Number(r.doanh_thu), 0))}</TableCell>
                      <TableCell className="num text-right text-emerald-700">{vnd(perf.reduce((a, r) => a + Number(r.da_thu), 0))}</TableCell>
                      <TableCell className="num text-right text-rose-600">{vnd(perf.reduce((a, r) => a + Number(r.cong_no), 0))}</TableCell>
                      <TableCell className="num text-right text-indigo-600">{vnd(perf.reduce((a, r) => a + Number(r.dang_chay), 0))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- CHI TIET CONG NO ---------- */}
        <TabsContent value="congno">
          <Card>
            <CardHeader>
              <CardTitle>Chi tiết công nợ ({debts.length} đơn)</CardTitle>
              <CardDescription>
                Hàng đã giao nhưng chưa thu đủ tiền — sắp xếp theo số ngày nợ giảm dần
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!debts.length ? (
                <EmptyState icon={CheckCircle2} title="Không có công nợ"
                  desc="Mọi đơn đã giao đều đã thu đủ tiền." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã đơn</TableHead>
                      <TableHead>Khách hàng</TableHead>
                      <TableHead>NVKD</TableHead>
                      <TableHead>Ngày giao</TableHead>
                      <TableHead className="text-right">Số ngày nợ</TableHead>
                      <TableHead className="text-right">Tổng tiền</TableHead>
                      <TableHead className="text-right">Đã thu</TableHead>
                      <TableHead className="text-right">Còn nợ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debts.map(r => (
                      <TableRow key={r.order_id}>
                        <TableCell className="font-mono font-medium">{r.order_code}</TableCell>
                        <TableCell className="min-w-[180px]">
                          {r.customer_name}
                          {r.tax_code && <span className="block text-xs text-muted-foreground">MST {r.tax_code}</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.sales_name || '--'}</TableCell>
                        <TableCell className="whitespace-nowrap">{dmy(r.delivered_at)}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={cn(
                            r.so_ngay_no > 60 ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : r.so_ngay_no > 30 ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-muted text-muted-foreground')}>
                            {r.so_ngay_no} ngày
                          </Badge>
                        </TableCell>
                        <TableCell className="num text-right">{vnd(r.total_amount)}</TableCell>
                        <TableCell className="num text-right text-emerald-600">{vnd(r.paid_amount)}</TableCell>
                        <TableCell className="num text-right font-semibold text-rose-600">{vnd(r.debt_amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={7}>Tổng công nợ phải thu</TableCell>
                      <TableCell className="num text-right text-rose-600">{vnd(tongCongNo)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- TON SAN XUAT ---------- */}
        <TabsContent value="tonsx">
          <Card>
            <CardHeader>
              <CardTitle>Đơn còn tồn ở Sản xuất ({wip.length} đơn)</CardTitle>
              <CardDescription>
                Đã duyệt xuống Sản xuất nhưng chưa giao xong{treHan ? ` — ${treHan} đơn đã quá hạn giao` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!wip.length ? (
                <EmptyState icon={CheckCircle2} title="Sản xuất đã xong hết"
                  desc="Không còn đơn nào tồn đọng." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã đơn</TableHead>
                      <TableHead>Khách hàng</TableHead>
                      <TableHead>NVKD</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead className="text-right">Ngày kể từ duyệt</TableHead>
                      <TableHead>Hạn giao</TableHead>
                      <TableHead className="text-right">Giá trị</TableHead>
                      <TableHead className="text-center">Thiết kế</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wip.map(r => (
                      <TableRow key={r.order_id} className={cn(r.so_ngay_tre_han > 0 && 'bg-rose-50/50')}>
                        <TableCell className="font-mono font-medium">{r.order_code}</TableCell>
                        <TableCell className="min-w-[170px]">{r.customer_name}</TableCell>
                        <TableCell className="text-muted-foreground">{r.sales_name || '--'}</TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                        <TableCell className="num text-right">
                          <span className={cn(r.so_ngay_ke_tu_duyet > 14 && 'font-semibold text-amber-700')}>
                            {r.so_ngay_ke_tu_duyet ?? '--'}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.estimated_delivery_date ? (
                            <>
                              {dmy(r.estimated_delivery_date)}
                              {r.so_ngay_tre_han > 0 && (
                                <span className="block text-xs font-semibold text-rose-600">
                                  trễ {r.so_ngay_tre_han} ngày
                                </span>
                              )}
                            </>
                          ) : <span className="text-muted-foreground">chưa có</span>}
                        </TableCell>
                        <TableCell className="num text-right font-medium">{vnd(r.total_amount)}</TableCell>
                        <TableCell className="text-center">
                          {r.co_thiet_ke
                            ? <CheckCircle2 className="mx-auto size-4 text-emerald-600" />
                            : <Clock className="mx-auto size-4 text-amber-600" />}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={6}>Tổng giá trị đang ở Sản xuất</TableCell>
                      <TableCell className="num text-right">{vnd(tongTon)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="mt-5">
        <CardHeader><CardTitle>Phân bổ đơn hàng theo trạng thái (phát hiện điểm nghẽn)</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                  {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [`${v} đơn`, n]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 self-center">
            {byStatus.sort((a, b) => b.value - a.value).map((s, i) => (
              <div key={s.key} className="flex items-center gap-3 rounded-lg border p-2.5">
                <span className="size-3 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <div className="min-w-0 flex-1">
                  <StatusBadge status={s.key} />
                  <p className="mt-0.5 text-xs text-muted-foreground">Đang ở: {s.bophan}</p>
                </div>
                <span className="num text-lg font-bold">{s.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}

const Dong = ({ k, v, bold, tone = '' }) => (
  <div className={cn('flex justify-between', bold && 'font-semibold')}>
    <span className={bold ? '' : 'text-muted-foreground'}>{k}</span>
    <span className={cn('num', tone)}>{v}</span>
  </div>
)

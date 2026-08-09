import { useMemo, useState } from 'react'
import { useOrders } from '@/hooks/useOrders'
import PageHeader from '@/components/common/PageHeader'
import StatCard from '@/components/common/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { vnd, STATUS, DEPT_OF_STATUS } from '@/lib/format'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts'
import { TrendingUp, Wallet, AlertTriangle, Receipt } from 'lucide-react'

const COLORS = ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6', '#94a3b8']
const fmtAxis = v => (v >= 1e9 ? (v / 1e9).toFixed(1) + ' tỷ' : (v / 1e6).toFixed(0) + ' tr')

export default function Analytics() {
  const { orders, loading } = useOrders()
  const [year, setYear] = useState(new Date().getFullYear())

  const live = useMemo(() => orders.filter(o => !['draft', 'cancelled'].includes(o.status)), [orders])
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
          <Select className="w-36" value={year} onChange={e => setYear(e.target.value)}>
            {(years.length ? years : [new Date().getFullYear()]).map(y => <option key={y} value={y}>Năm {y}</option>)}
          </Select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Doanh thu ${year}`} value={vnd(kpi.revenue)} icon={TrendingUp} sub={`${kpi.count} đơn hàng`} />
        <StatCard label="Đã thu" value={vnd(kpi.collected)} icon={Wallet} tone="text-emerald-600"
          sub={kpi.revenue ? `${((kpi.collected / kpi.revenue) * 100).toFixed(1)}% doanh thu` : ''} />
        <StatCard label="Công nợ phải thu" value={vnd(kpi.debt)} icon={AlertTriangle} tone="text-rose-600" />
        <StatCard label="Điểm nghẽn hiện tại" value={bottleneck?.value ?? 0} icon={Receipt}
          sub={bottleneck ? `${bottleneck.name} · ${bottleneck.bophan}` : ''} tone="text-amber-600" />
      </div>

      <Tabs defaultValue="thang" className="mt-5">
        <TabsList>
          <TabsTrigger value="thang">Theo tháng</TabsTrigger>
          <TabsTrigger value="quy">Theo quý</TabsTrigger>
          <TabsTrigger value="nvkd">Theo nhân viên</TabsTrigger>
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

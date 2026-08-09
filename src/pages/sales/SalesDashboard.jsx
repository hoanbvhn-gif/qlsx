import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useOrders } from '@/hooks/useOrders'
import PageHeader from '@/components/common/PageHeader'
import StatCard from '@/components/common/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { vnd, dmy } from '@/lib/format'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { FilePlus2, Receipt, Wallet, TrendingUp, Clock } from 'lucide-react'

export default function SalesDashboard() {
  const { profile } = useAuth()
  const { orders, loading } = useOrders({ salesId: profile.id })

  const stats = useMemo(() => {
    const live = orders.filter(o => !['draft', 'cancelled'].includes(o.status))
    const now = new Date()
    const thisMonth = live.filter(o => {
      const d = new Date(o.order_date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    return {
      count: live.length,
      revenueMonth: thisMonth.reduce((s, o) => s + Number(o.total_amount), 0),
      revenueAll: live.reduce((s, o) => s + Number(o.total_amount), 0),
      debt: live.reduce((s, o) => s + Number(o.debt_amount), 0),
      pending: orders.filter(o => o.status === 'pending_accounting').length
    }
  }, [orders])

  const chart = useMemo(() => {
    const m = new Map()
    for (const o of orders) {
      if (['draft', 'cancelled'].includes(o.status)) continue
      const d = new Date(o.order_date)
      const k = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
      m.set(k, (m.get(k) ?? 0) + Number(o.total_amount))
    }
    return [...m.entries()].map(([thang, doanhso]) => ({ thang, doanhso })).slice(-6)
  }, [orders])

  return (
    <>
      <PageHeader
        title={`Xin chào, ${profile.full_name}`}
        desc="Tổng quan hiệu suất bán hàng của bạn"
        action={<Button asChild><Link to="/kinhdoanh/don-moi"><FilePlus2 className="size-4" /> Lập đơn hàng</Link></Button>}
      />

      {loading ? <Skeleton className="h-28 w-full" /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Đơn hàng đã lập" value={stats.count} icon={Receipt} sub={`${stats.pending} đơn chờ duyệt`} />
          <StatCard label="Doanh số tháng này" value={vnd(stats.revenueMonth)} icon={TrendingUp} tone="text-emerald-600" />
          <StatCard label="Tổng doanh số" value={vnd(stats.revenueAll)} icon={Wallet} />
          <StatCard label="Công nợ đang theo dõi" value={vnd(stats.debt)} icon={Clock} tone="text-rose-600" />
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Doanh số 6 tháng gần nhất</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="thang" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false}
                  tickFormatter={v => (v >= 1e9 ? (v / 1e9).toFixed(1) + ' tỷ' : (v / 1e6).toFixed(0) + ' tr')} />
                <Tooltip formatter={v => vnd(v) + ' đ'} />
                <Bar dataKey="doanhso" name="Doanh số" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Đơn hàng gần đây</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {orders.slice(0, 6).map(o => (
              <div key={o.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">#{o.order_code} · {o.customer_name}</p>
                  <p className="num text-xs text-muted-foreground">{dmy(o.order_date)} · {vnd(o.total_amount)} đ</p>
                </div>
                <StatusBadge status={o.status} />
              </div>
            ))}
            {!orders.length && !loading && <p className="py-6 text-center text-sm text-muted-foreground">Chưa có đơn hàng nào</p>}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

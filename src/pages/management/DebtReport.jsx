import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useOrders } from '@/hooks/useOrders'
import PageHeader from '@/components/common/PageHeader'
import StatCard from '@/components/common/StatCard'
import OrderDetailDialog from '@/components/common/OrderDetailDialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/badge'
import { vnd, dmy } from '@/lib/format'
import { Search, Wallet, Users, AlertTriangle, Download, ChevronRight } from 'lucide-react'

export default function DebtReport() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState(null)
  const { orders } = useOrders()
  const [sel, setSel] = useState(null)

  useEffect(() => {
    supabase.from('v_customer_debt').select('*').order('debt_amount', { ascending: false })
      .then(({ data }) => { setRows(data ?? []); setLoading(false) })
  }, [])

  const list = useMemo(() => rows.filter(r =>
    !q || `${r.customer_code} ${r.customer_name} ${r.tax_code ?? ''}`.toLowerCase().includes(q.toLowerCase())
  ), [rows, q])

  const tot = useMemo(() => ({
    debt: rows.reduce((a, r) => a + Number(r.debt_amount), 0),
    customers: rows.filter(r => Number(r.debt_amount) > 0).length,
    amount: rows.reduce((a, r) => a + Number(r.total_amount), 0)
  }), [rows])

  const exportCsv = () => {
    const head = ['Mã KH', 'Tên khách hàng', 'MST', 'Số đơn', 'Tổng tiền', 'Đã thu', 'Còn nợ', 'Đơn gần nhất']
    const body = list.map(r => [r.customer_code, r.customer_name, r.tax_code ?? '', r.total_orders,
      r.total_amount, r.paid_amount, r.debt_amount, r.last_order_date ?? ''])
    const csv = '﻿' + [head, ...body].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `cong-no-khach-hang-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <>
      <PageHeader title="Công nợ khách hàng" desc="Chi tiết phải thu theo từng khách hàng"
        action={<Button variant="outline" onClick={exportCsv}><Download className="size-4" /> Xuất Excel/CSV</Button>} />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Tổng phải thu" value={vnd(tot.debt)} icon={AlertTriangle} tone="text-rose-600" />
        <StatCard label="Khách còn nợ" value={tot.customers} icon={Users} />
        <StatCard label="Tổng doanh số lũy kế" value={vnd(tot.amount)} icon={Wallet} />
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Tìm khách hàng / mã số thuế..." value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {loading ? <Skeleton className="h-64 w-full" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Khách hàng</TableHead>
              <TableHead>MST</TableHead>
              <TableHead className="text-right">Số đơn</TableHead>
              <TableHead className="text-right">Tổng tiền</TableHead>
              <TableHead className="text-right">Đã thu</TableHead>
              <TableHead className="text-right">Còn nợ</TableHead>
              <TableHead>Đơn gần nhất</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map(r => (
              <Fragment key={r.customer_id}>
                <TableRow className="cursor-pointer"
                  onClick={() => setOpenId(openId === r.customer_id ? null : r.customer_id)}>
                  <TableCell><ChevronRight className={`size-4 transition ${openId === r.customer_id ? 'rotate-90' : ''}`} /></TableCell>
                  <TableCell className="min-w-[180px] font-medium">
                    {r.customer_name}
                    <span className="block font-mono text-xs text-muted-foreground">{r.customer_code}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.tax_code || '--'}</TableCell>
                  <TableCell className="num text-right">{r.total_orders}</TableCell>
                  <TableCell className="num text-right">{vnd(r.total_amount)}</TableCell>
                  <TableCell className="num text-right text-emerald-600">{vnd(r.paid_amount)}</TableCell>
                  <TableCell className={`num text-right font-semibold ${Number(r.debt_amount) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {vnd(r.debt_amount)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{r.last_order_date ? dmy(r.last_order_date) : '--'}</TableCell>
                </TableRow>
                {openId === r.customer_id && (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-muted/40 p-3">
                      <Card>
                        <CardHeader className="py-3"><CardTitle className="text-sm">Chi tiết đơn hàng</CardTitle></CardHeader>
                        <CardContent className="space-y-1.5">
                          {orders.filter(o => o.customer_id === r.customer_id && !['draft', 'cancelled'].includes(o.status))
                            .map(o => (
                              <div key={o.id} onClick={() => setSel(o)}
                                className="flex cursor-pointer flex-wrap items-center gap-2 rounded-lg border bg-background p-2.5 text-sm hover:bg-accent">
                                <span className="font-mono font-medium">#{o.order_code}</span>
                                <span className="text-muted-foreground">{dmy(o.order_date)}</span>
                                <StatusBadge status={o.status} />
                                <span className="num ml-auto">{vnd(o.total_amount)}</span>
                                <span className={`num w-28 text-right font-semibold ${Number(o.debt_amount) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  nợ {vnd(o.debt_amount)}
                                </span>
                              </div>
                            ))}
                        </CardContent>
                      </Card>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      )}

      <OrderDetailDialog order={sel} open={!!sel} onOpenChange={v => !v && setSel(null)} />
    </>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import PageHeader from '@/components/common/PageHeader'
import StatCard from '@/components/common/StatCard'
import EmptyState from '@/components/common/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { vnd, dmyhm, ROLE_LABEL } from '@/lib/format'
import { cn, noAccent } from '@/lib/utils'
import {
  Search, PlusCircle, PencilLine, Trash2, ScrollText, Download, RotateCcw, ChevronDown
} from 'lucide-react'
import { toast } from 'sonner'

const ACT = {
  INSERT: { label: 'Ghi mới',  tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: PlusCircle },
  UPDATE: { label: 'Sửa/Hủy', tone: 'bg-amber-50 text-amber-700 border-amber-200',       icon: PencilLine },
  DELETE: { label: 'Xóa',      tone: 'bg-rose-50 text-rose-700 border-rose-200',          icon: Trash2 }
}

const firstOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export default function AuditLog() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const [act, setAct] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('v_audit_log')
      .select('*')
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) toast.error(error.message)
    setRows(data ?? []); setLoading(false)
  }, [from, to])
  useEffect(() => { load() }, [load])

  const list = useMemo(() => {
    const key = noAccent(q)
    return rows.filter(r =>
      (!act || r.action === act) &&
      (!key || noAccent(`${r.order_code ?? ''} ${r.customer_name ?? ''} ${r.nguoi_thuc_hien ?? ''} ${r.note ?? ''}`).includes(key))
    )
  }, [rows, q, act])

  const stat = useMemo(() => ({
    ins: list.filter(r => r.action === 'INSERT').length,
    upd: list.filter(r => r.action === 'UPDATE').length,
    del: list.filter(r => r.action === 'DELETE').length
  }), [list])

  const exportCsv = () => {
    const head = ['Thời điểm', 'Thao tác', 'Người thực hiện', 'Vai trò', 'Mã đơn', 'Khách hàng', 'Số tiền', 'Diễn giải']
    const body = list.map(r => [dmyhm(r.created_at), ACT[r.action]?.label ?? r.action,
      r.nguoi_thuc_hien ?? '', ROLE_LABEL[r.vai_tro] ?? '', r.order_code ?? '',
      r.customer_name ?? '', r.so_tien ?? '', r.note ?? ''])
    const csv = '﻿' + [head, ...body]
      .map(rr => rr.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `nhat-ky_${from}_${to}.csv`
    a.click()
  }

  return (
    <>
      <PageHeader title="Nhật ký hệ thống"
        desc="Mọi thao tác ghi / sửa / xóa bút toán thu tiền đều được lưu lại, không ai xóa được"
        action={<Button variant="outline" onClick={exportCsv}><Download className="size-4" /> Xuất CSV</Button>} />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Ghi mới" value={stat.ins} icon={PlusCircle} tone="text-emerald-600" />
        <StatCard label="Sửa / Hủy" value={stat.upd} icon={PencilLine} tone="text-amber-600" />
        <StatCard label="Xóa" value={stat.del} icon={Trash2} tone="text-rose-600" />
      </div>

      <Card className="mb-4">
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Từ ngày</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Đến ngày</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Thao tác</Label>
              <Select value={act} onChange={e => setAct(e.target.value)}>
                <option value="">Tất cả</option>
                {Object.entries(ACT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Tìm mã đơn / khách hàng / người thực hiện / diễn giải..."
                value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <Button variant="ghost" onClick={load}><RotateCcw className="size-4" /> Tải lại</Button>
          </div>
        </CardContent>
      </Card>

      {loading ? <Skeleton className="h-64 w-full" />
        : !list.length ? <EmptyState icon={ScrollText} title="Chưa có thao tác nào"
            desc="Đổi khoảng thời gian để xem lịch sử cũ hơn." />
        : (
          <div className="space-y-2">
            {list.map(r => {
              const a = ACT[r.action] ?? { label: r.action, tone: '', icon: ScrollText }
              const AIcon = a.icon
              const isOpen = open === r.id
              return (
                <Card key={r.id} className={cn(r.action === 'DELETE' && 'border-rose-200')}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <Badge className={cn(a.tone, 'shrink-0')}>
                        <AIcon className="mr-1 size-3" />{a.label}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{r.note}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.order_code && <>Đơn <span className="font-mono">#{r.order_code}</span> · </>}
                          {r.customer_name && <>{r.customer_name} · </>}
                          <b>{r.nguoi_thuc_hien || 'Không rõ'}</b>
                          {r.vai_tro && ` (${ROLE_LABEL[r.vai_tro]})`} · {dmyhm(r.created_at)}
                        </p>
                      </div>
                      {r.so_tien != null && (
                        <span className="num shrink-0 text-sm font-semibold">{vnd(r.so_tien)} đ</span>
                      )}
                      <button type="button" onClick={() => setOpen(isOpen ? null : r.id)}
                        className="shrink-0 text-muted-foreground hover:text-foreground">
                        <ChevronDown className={cn('size-4 transition', isOpen && 'rotate-180')} />
                      </button>
                    </div>

                    {isOpen && (
                      <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2">
                        <JsonBox title="Trước" data={r.old_data} />
                        <JsonBox title="Sau" data={r.new_data} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
    </>
  )
}

const FIELDS = [
  ['amount', 'Số tiền'], ['payment_date', 'Ngày thu'], ['payment_type', 'Loại'],
  ['method', 'Hình thức'], ['reference_no', 'Số chứng từ'], ['transfer_note', 'Nội dung CK'],
  ['note', 'Diễn giải'], ['voided', 'Đã hủy'], ['delete_reason', 'Lý do xóa']
]

function JsonBox({ title, data }) {
  if (!data) return (
    <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
      <p className="mb-1 font-semibold uppercase">{title}</p>
      <p>Không có</p>
    </div>
  )
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-xs">
      <p className="mb-1.5 font-semibold uppercase text-muted-foreground">{title}</p>
      <div className="space-y-0.5">
        {FIELDS.filter(([k]) => data[k] !== null && data[k] !== undefined && data[k] !== '')
          .map(([k, label]) => (
            <div key={k} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{label}</span>
              <span className="truncate font-medium">
                {k === 'amount' ? vnd(data[k]) : String(data[k])}
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useItems, useItemCatalog, ITEM_STATUS, buildItemCode } from '@/hooks/useItems'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import StatCard from '@/components/common/StatCard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { vnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Search, Plus, Check, X, Package, Clock, Layers, Download, Boxes
} from 'lucide-react'
import { toast } from 'sonner'
import NewItemDialog from './NewItemDialog'
import BulkGenerateDialog from './BulkGenerateDialog'
import CatalogManager from './CatalogManager'

export default function ItemCatalog() {
  const { profile } = useAuth()
  const isBoss = profile?.role === 'management'
  // Chi Ke toan va Giam doc duoc them ma hang; KD/SX chi tra cuu
  const canAdd = ['management', 'accounting'].includes(profile?.role)
  const isAccountant = profile?.role === 'accounting'
  const { items, loading, reload } = useItems()
  const cat = useItemCatalog()

  const [q, setQ] = useState('')
  const [fMat, setFMat] = useState('')
  const [fSt, setFSt] = useState('')
  const [openNew, setOpenNew] = useState(false)
  const [openBulk, setOpenBulk] = useState(false)

  const rows = useMemo(() => items.filter(i =>
    (!fMat || i.material_code === fMat) &&
    (!fSt || i.status === fSt) &&
    (!q || `${i.item_code} ${i.item_name}`.toLowerCase().includes(q.toLowerCase()))
  ), [items, q, fMat, fSt])

  const stat = useMemo(() => ({
    total: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    approved: items.filter(i => i.status === 'approved').length,
    combos: cat.materials.length * cat.processes.length * cat.thicknesses.length * cat.sizes.length
  }), [items, cat])

  const setStatus = async (item, status, reason) => {
    const { error } = await supabase.from('items')
      .update({ status, reject_reason: reason ?? null }).eq('id', item.id)
    if (error) return toast.error(error.message)
    toast.success(status === 'approved'
      ? `Đã duyệt mã ${item.item_code}`
      : `Đã từ chối mã ${item.item_code}`)
    reload()
  }

  const exportCsv = () => {
    const head = ['Mã hàng', 'Tên sản phẩm', 'Chất liệu', 'Gia công', 'Độ dày', 'Kích thước', 'ĐVT', 'Đơn giá', 'Trạng thái']
    const body = rows.map(i => [
      i.item_code, i.item_name, i.material?.name, i.process?.name,
      i.thickness?.name, i.size?.name, i.unit, i.list_price, ITEM_STATUS[i.status]?.label
    ])
    const csv = '﻿' + [head, ...body].map(r => r.map(c => `"${c ?? ''}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `ma-hang-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <>
      <PageHeader
        title="Danh mục mã hàng"
        desc="Cấu trúc mã: [Chất liệu 2][Gia công 2][Độ dày 3][Kích thước 3] — ví dụ ALAM050001"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCsv}><Download className="size-4" /> Xuất CSV</Button>
            {isBoss && (
              <Button variant="outline" onClick={() => setOpenBulk(true)}>
                <Layers className="size-4" /> Sinh hàng loạt
              </Button>
            )}
            {canAdd && (
              <Button onClick={() => setOpenNew(true)}>
                <Plus className="size-4" /> {isBoss ? 'Thêm mã' : 'Đề xuất mã'}
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng mã hàng" value={stat.total} icon={Package} />
        <StatCard label="Đã duyệt" value={stat.approved} icon={Check} tone="text-emerald-600" />
        <StatCard label="Chờ duyệt" value={stat.pending} icon={Clock} tone="text-amber-600" />
        <StatCard label="Tổ hợp có thể tạo" value={stat.combos} icon={Boxes}
          sub={`còn ${Math.max(stat.combos - stat.total, 0)} mã chưa khai`} />
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Mã hàng</TabsTrigger>
          <TabsTrigger value="catalog">Danh mục thành phần</TabsTrigger>
          <TabsTrigger value="rule">Quy tắc đánh mã</TabsTrigger>
        </TabsList>

        {/* ---------- TAB 1: DANH SACH MA HANG ---------- */}
        <TabsContent value="items">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Tìm mã hàng / tên sản phẩm..."
                value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <Select className="sm:w-44" value={fMat} onChange={e => setFMat(e.target.value)}>
              <option value="">Mọi chất liệu</option>
              {cat.materials.map(m => <option key={m.code} value={m.code}>{m.code} · {m.name}</option>)}
            </Select>
            <Select className="sm:w-40" value={fSt} onChange={e => setFSt(e.target.value)}>
              <option value="">Mọi trạng thái</option>
              {Object.entries(ITEM_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </div>

          {loading ? <Skeleton className="h-64 w-full" />
            : !rows.length ? <EmptyState title="Không có mã hàng"
                desc={canAdd ? 'Đổi bộ lọc hoặc thêm mã mới.' : 'Đổi bộ lọc để xem mã khác.'} />
            : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã hàng</TableHead>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead>Phân rã</TableHead>
                    <TableHead className="text-right">Đơn giá</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    {isBoss && <TableHead className="text-right">Duyệt</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(i => (
                    <TableRow key={i.id} className={cn(!i.is_active && 'opacity-50')}>
                      <TableCell className="font-mono font-semibold tracking-tight">{i.item_code}</TableCell>
                      <TableCell className="min-w-[170px]">{i.item_name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Seg v={i.material?.name} />
                          <Seg v={i.process?.name} />
                          <Seg v={i.thickness?.name} />
                          <Seg v={i.size?.name} />
                        </div>
                      </TableCell>
                      <TableCell className="num text-right">{i.list_price > 0 ? vnd(i.list_price) : '--'}</TableCell>
                      <TableCell>
                        <Badge className={ITEM_STATUS[i.status]?.tone}>{ITEM_STATUS[i.status]?.label}</Badge>
                      </TableCell>
                      {isBoss && (
                        <TableCell className="text-right">
                          {i.status !== 'approved' ? (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="success" onClick={() => setStatus(i, 'approved')}>
                                <Check className="size-4" /> Duyệt
                              </Button>
                              {i.status === 'pending' && (
                                <Button size="sm" variant="ghost" className="text-destructive"
                                  onClick={() => setStatus(i, 'rejected', 'Không phù hợp')}>
                                  <X className="size-4" />
                                </Button>
                              )}
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost" className="text-muted-foreground"
                              onClick={() => setStatus(i, 'pending')}>Bỏ duyệt</Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </TabsContent>

        {/* ---------- TAB 2: DANH MUC THANH PHAN ---------- */}
        <TabsContent value="catalog">
          <CatalogManager cat={cat} isBoss={isBoss} isAccountant={isAccountant} />
        </TabsContent>

        {/* ---------- TAB 3: QUY TAC ---------- */}
        <TabsContent value="rule">
          <Card>
            <CardHeader>
              <CardTitle>Quy tắc đánh mã hàng</CardTitle>
              <CardDescription>Mã gồm 10 ký tự, ghép từ 4 đoạn có độ dài cố định</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-end gap-1 font-mono">
                {[['AL', 'Chất liệu', '2 ký tự'], ['AM', 'Gia công', '2 ký tự'],
                  ['050', 'Độ dày', '3 số'], ['001', 'Kích thước', '3 số']].map(([v, k, w]) => (
                  <div key={k} className="text-center">
                    <div className="rounded-lg border-2 border-primary/40 bg-primary/5 px-3 py-2 text-lg font-bold">{v}</div>
                    <p className="mt-1 font-sans text-xs font-medium">{k}</p>
                    <p className="font-sans text-[10px] text-muted-foreground">{w}</p>
                  </div>
                ))}
                <div className="ml-3 pb-6 text-sm font-sans text-muted-foreground">
                  → <b className="font-mono text-base text-foreground">ALAM050001</b>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <p className="font-semibold">Vì sao độ dày dùng 3 số?</p>
                <p className="text-muted-foreground">
                  Độ dày ghi bằng <b>mm × 100</b>: 0.5mm → <code>050</code>, 0.65mm → <code>065</code>,
                  3.0mm → <code>300</code>. Cách cũ dùng <code>05</code> và <code>065</code> dài ngắn khác
                  nhau nên khi viết liền máy không tách được đoạn. Cố định 3 số là hết nhập nhằng,
                  đồng thời ghi được tới 9.99mm với bước 0.01mm.
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <p className="font-semibold">Vì sao chất liệu ép 2 ký tự?</p>
                <p className="text-muted-foreground">
                  Trước đây <code>AL</code> (nhôm) và <code>ALU</code> (alu) dài khác nhau, ghép liền
                  sẽ trùng lặp cách đọc. Nay alu đổi thành <code>AU</code>, mọi chất liệu đều 2 ký tự.
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <p className="font-semibold">Thêm kích thước mới về sau</p>
                <p className="text-muted-foreground">
                  Vào tab <b>Danh mục thành phần</b> → mục Kích thước → thêm một dòng, mã tự tăng
                  (<code>002</code>, <code>003</code>...). Sau đó dùng <b>Sinh hàng loạt</b> để tạo
                  toàn bộ mã của cỡ mới chỉ trong một lần bấm. Ba số cho phép tới <b>999 cỡ</b>.
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <p className="font-semibold">Tên sản phẩm sinh tự động từ mã</p>
                <p className="text-muted-foreground">
                  Tên hàng <b>không có ô nhập tay</b> — hệ thống ghép từ đúng 4 đoạn của mã, nên
                  hai mã khác nhau chắc chắn có tên khác nhau. Tránh được cảnh hai dòng cùng tên
                  &quot;Tem nhôm 40x160mm&quot; trên hóa đơn mà không biết dòng nào là hàng nào.
                </p>
              </div>

              <div className="space-y-2 rounded-xl border bg-muted/40 p-3 text-sm">
                <p className="font-semibold">Ví dụ đọc mã</p>
                <p className="text-muted-foreground">
                  <code className="font-mono font-semibold text-foreground">INUV080001</code> →
                  <b> IN</b> Inox · <b>UV</b> In UV · <b>080</b> dày 0.8mm · <b>001</b> cỡ 40x160mm
                  <br />→ <b className="text-foreground">Tem inox in UV 0.8mm 40x160mm</b>
                </p>
                <p className="text-muted-foreground">
                  <code className="font-mono font-semibold text-foreground">DCUV000001</code> →
                  decal không có độ dày nên đoạn đó là <code>000</code> và được bỏ khỏi tên
                  <br />→ <b className="text-foreground">Tem decal in UV 40x160mm</b>
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <p className="font-semibold">Ai được thêm mã?</p>
                <p className="text-muted-foreground">
                  <b>Kế toán</b> thêm mã ở trạng thái <i>Chờ duyệt</i>. <b>Ban Giám đốc</b> thêm mã
                  có hiệu lực ngay và là người duy nhất được bấm Duyệt. Kinh doanh và Sản xuất chỉ tra cứu.
                  Quy tắc này khóa ở tầng database nên không thể lách qua giao diện.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <NewItemDialog open={openNew} onOpenChange={setOpenNew} cat={cat} isBoss={isBoss}
        userId={profile?.id} onSaved={reload} />
      <BulkGenerateDialog open={openBulk} onOpenChange={setOpenBulk} cat={cat}
        existing={items} userId={profile?.id} onSaved={reload} />
    </>
  )
}

const Seg = ({ v }) => v
  ? <span className="rounded border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{v}</span>
  : null

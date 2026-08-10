import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { ROLE_LABEL, dmy, vnd } from '@/lib/format'
import { cn, noAccent } from '@/lib/utils'
import {
  Search, ShieldCheck, Lock, Unlock, Trash2, AlertTriangle, Users, UserX, Info
} from 'lucide-react'
import { toast } from 'sonner'

const ROLE_TONE = {
  management: 'bg-violet-50 text-violet-700 border-violet-200',
  accounting: 'bg-sky-50 text-sky-700 border-sky-200',
  sales:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  production: 'bg-amber-50 text-amber-700 border-amber-200'
}

export default function UserRoles() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all')
  const [del, setDel] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('v_nhan_su')
      .select('*').order('role').order('full_name')
    if (error) toast.error(error.message)
    setRows(data ?? []); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const timKiem = useMemo(() => {
    const key = noAccent(q)
    return rows.filter(u =>
      !key || noAccent(`${u.full_name} ${u.username} ${u.employee_code ?? ''} ${u.phone ?? ''}`).includes(key))
  }, [rows, q])

  const nhom = useMemo(() => ({
    all: timKiem,
    management: timKiem.filter(u => u.role === 'management'),
    accounting: timKiem.filter(u => u.role === 'accounting'),
    sales: timKiem.filter(u => u.role === 'sales'),
    production: timKiem.filter(u => u.role === 'production'),
    locked: timKiem.filter(u => !u.is_active)
  }), [timKiem])

  const setRole = async (u, role) => {
    if (u.id === profile.id && role !== 'management')
      return toast.error('Không thể tự hạ quyền tài khoản Giám đốc đang đăng nhập.')
    const { error } = await supabase.from('users').update({ role }).eq('id', u.id)
    if (error) return toast.error(error.message)
    toast.success(`${u.full_name} → ${ROLE_LABEL[role]}`)
    load()
  }

  const toggle = async (u) => {
    if (u.id === profile.id) return toast.error('Không thể tự khóa tài khoản đang đăng nhập.')
    const { error } = await supabase.from('users').update({ is_active: !u.is_active }).eq('id', u.id)
    if (error) return toast.error(error.message)
    toast.success(u.is_active ? `Đã khóa ${u.full_name}` : `Đã mở khóa ${u.full_name}`)
    load()
  }

  const doDelete = async () => {
    setBusy(true)
    const { error } = await supabase.from('users').delete().eq('id', del.id)
    setBusy(false)
    if (error) {
      if (/foreign key|violates/i.test(error.message))
        return toast.error('Nhân viên này đã phát sinh dữ liệu, không xóa được. Hãy khóa tài khoản.')
      return toast.error(error.message)
    }
    toast.success(`Đã xóa hồ sơ ${del.full_name}`)
    setDel(null); load()
  }

  const TAB = [
    ['all', 'Tất cả', Users],
    ['management', ROLE_LABEL.management, ShieldCheck],
    ['accounting', ROLE_LABEL.accounting, ShieldCheck],
    ['sales', ROLE_LABEL.sales, ShieldCheck],
    ['production', ROLE_LABEL.production, ShieldCheck],
    ['locked', 'Đã khóa', Lock]
  ]

  return (
    <>
      <PageHeader title="Phân quyền nhân sự"
        desc="Chỉ Ban Giám đốc được thay đổi vai trò, khóa hoặc xóa tài khoản" />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Tìm theo tên, tài khoản, mã NV, số điện thoại..."
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
                <EmptyState icon={UserX} title="Không có nhân viên nào"
                  desc={k === 'locked' ? 'Không có tài khoản nào bị khóa.' : 'Đổi tìm kiếm hoặc tạo tài khoản mới.'} />
              ) : (
                <BangNhanSu rows={nhom[k]} meId={profile.id}
                  onRole={setRole} onToggle={toggle} onDelete={setDel} />
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* ---------- Xoa nhan su ---------- */}
      <Dialog open={!!del} onOpenChange={v => !busy && !v && setDel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Xóa hồ sơ nhân sự
            </DialogTitle>
          </DialogHeader>

          {del && (
            <>
              <div className="space-y-1 rounded-xl border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between"><span>Họ tên</span><b>{del.full_name}</b></div>
                <div className="flex justify-between"><span>Tài khoản</span><b className="font-mono">{del.username}</b></div>
                <div className="flex justify-between"><span>Vai trò</span>
                  <Badge className={ROLE_TONE[del.role]}>{ROLE_LABEL[del.role]}</Badge></div>
              </div>

              {del.co_the_xoa ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Nhân viên này chưa phát sinh dữ liệu nào nên xóa được. Hồ sơ biến mất khỏi
                  danh sách và không đăng nhập được nữa.
                </p>
              ) : (
                <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  <p className="font-semibold">Không xóa được nhân viên này.</p>
                  <ul className="ml-4 list-disc text-xs">
                    {del.so_don > 0 && <li>Đã lập <b>{del.so_don}</b> đơn hàng ({vnd(del.doanh_thu)} đ)</li>}
                    {del.so_don_da_duyet > 0 && <li>Đã duyệt <b>{del.so_don_da_duyet}</b> đơn</li>}
                    {del.so_but_toan > 0 && <li>Đã ghi <b>{del.so_but_toan}</b> bút toán thu tiền</li>}
                  </ul>
                  <p className="text-xs">
                    Xóa đi sẽ mất dấu vết ai lập đơn, ai thu tiền — sổ sách không còn đối chiếu được.
                    Nhân viên nghỉ việc thì <b>khóa tài khoản</b>: họ không đăng nhập được nữa
                    mà lịch sử vẫn nguyên vẹn.
                  </p>
                </div>
              )}

              <p className="flex gap-2 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
                <Info className="size-4 shrink-0" />
                Sau khi xóa hồ sơ, tài khoản đăng nhập vẫn còn trong Supabase
                (<b>Authentication → Users</b>). Muốn dùng lại tên đăng nhập đó cho người khác
                thì phải xóa nốt ở bên đó.
              </p>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDel(null)} disabled={busy}>Hủy bỏ</Button>
            {del?.co_the_xoa ? (
              <Button variant="destructive" onClick={doDelete} disabled={busy}>
                <Trash2 className="size-4" /> Xóa hồ sơ
              </Button>
            ) : (
              <Button onClick={() => { toggle(del); setDel(null) }} disabled={busy}>
                <Lock className="size-4" /> Khóa tài khoản thay vì xóa
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function BangNhanSu({ rows, meId, onRole, onToggle, onDelete }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nhân viên</TableHead>
          <TableHead>Tài khoản</TableHead>
          <TableHead>Điện thoại</TableHead>
          <TableHead className="text-right">Hoạt động</TableHead>
          <TableHead className="w-52">Vai trò</TableHead>
          <TableHead className="text-right">Trạng thái</TableHead>
          <TableHead className="text-right">Xóa</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(u => (
          <TableRow key={u.id} className={cn(!u.is_active && 'bg-muted/40 text-muted-foreground')}>
            <TableCell className="font-medium">
              {u.full_name}
              {u.id === meId && <Badge className="ml-2 bg-primary text-primary-foreground">bạn</Badge>}
              <span className="block text-xs text-muted-foreground">
                {u.employee_code || '--'} · tạo {dmy(u.created_at)}
              </span>
            </TableCell>
            <TableCell className="font-mono text-xs">{u.username}</TableCell>
            <TableCell className="text-muted-foreground">{u.phone || '--'}</TableCell>
            <TableCell className="text-right text-xs">
              {u.so_don > 0 && <span className="block">{u.so_don} đơn · {vnd(u.doanh_thu)}</span>}
              {u.so_but_toan > 0 && <span className="block text-muted-foreground">{u.so_but_toan} bút toán</span>}
              {!u.so_don && !u.so_but_toan && <span className="text-muted-foreground">chưa có</span>}
            </TableCell>
            <TableCell>
              <Select className="h-9" value={u.role} onChange={e => onRole(u, e.target.value)}>
                {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </TableCell>
            <TableCell className="text-right">
              <Button size="sm" variant="ghost" onClick={() => onToggle(u)} disabled={u.id === meId}>
                {u.is_active
                  ? <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700"><Unlock className="mr-1 size-3" />Hoạt động</Badge>
                  : <Badge className="border-rose-200 bg-rose-50 text-rose-700"><Lock className="mr-1 size-3" />Đã khóa</Badge>}
              </Button>
            </TableCell>
            <TableCell className="text-right">
              <Button size="sm" variant="ghost" className="text-destructive"
                onClick={() => onDelete(u)} disabled={u.id === meId}
                title={u.co_the_xoa ? 'Xóa hồ sơ' : 'Đã phát sinh dữ liệu — nên khóa thay vì xóa'}>
                <Trash2 className="size-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

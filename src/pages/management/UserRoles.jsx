import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import PageHeader from '@/components/common/PageHeader'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ROLE_LABEL, dmy } from '@/lib/format'
import { Search, ShieldCheck, Lock, Unlock } from 'lucide-react'
import { toast } from 'sonner'

export default function UserRoles() {
  const { profile } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  const load = () => {
    setLoading(true)
    supabase.from('users').select('*').order('role').order('full_name')
      .then(({ data }) => { setUsers(data ?? []); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  const setRole = async (u, role) => {
    if (u.id === profile.id && role !== 'management')
      return toast.error('Không thể tự hạ quyền tài khoản Giám đốc đang đăng nhập.')
    const { error } = await supabase.from('users').update({ role }).eq('id', u.id)
    if (error) return toast.error(error.message)
    toast.success(`${u.full_name} → ${ROLE_LABEL[role]}`)
    load()
  }

  const toggle = async (u) => {
    const { error } = await supabase.from('users').update({ is_active: !u.is_active }).eq('id', u.id)
    if (error) return toast.error(error.message)
    load()
  }

  const list = users.filter(u => !q || `${u.full_name} ${u.username} ${u.employee_code ?? ''}`.toLowerCase().includes(q.toLowerCase()))
  const counts = Object.keys(ROLE_LABEL).map(r => ({ r, n: users.filter(u => u.role === r).length }))

  return (
    <>
      <PageHeader title="Phân quyền nhân sự" desc="Chỉ Ban Giám đốc được thay đổi vai trò tài khoản" />

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        {counts.map(c => (
          <Card key={c.r}>
            <CardContent className="flex items-center gap-3 p-4">
              <ShieldCheck className="size-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{ROLE_LABEL[c.r]}</p>
                <p className="text-xl font-bold">{c.n}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Tìm nhân viên..." value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {loading ? <Skeleton className="h-64 w-full" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nhân viên</TableHead>
              <TableHead>Tài khoản</TableHead>
              <TableHead>Điện thoại</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead className="w-52">Vai trò</TableHead>
              <TableHead className="text-right">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.full_name}
                  {u.employee_code && <span className="block text-xs text-muted-foreground">{u.employee_code}</span>}
                </TableCell>
                <TableCell className="font-mono text-xs">{u.username}</TableCell>
                <TableCell className="text-muted-foreground">{u.phone || '--'}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{dmy(u.created_at)}</TableCell>
                <TableCell>
                  <Select className="h-9" value={u.role} onChange={e => setRole(u, e.target.value)}>
                    {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => toggle(u)}>
                    {u.is_active
                      ? <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700"><Unlock className="mr-1 size-3" />Hoạt động</Badge>
                      : <Badge className="border-rose-200 bg-rose-50 text-rose-700"><Lock className="mr-1 size-3" />Đã khóa</Badge>}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}

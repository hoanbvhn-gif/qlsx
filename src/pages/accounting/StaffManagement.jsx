import { useEffect, useState } from 'react'
import { supabase, LOGIN_DOMAIN, toEmail } from '@/lib/supabase'
import PageHeader from '@/components/common/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input as SearchInput } from '@/components/ui/input'
import { ROLE_LABEL, dmy, loiTiengViet } from '@/lib/format'
import { useMemo } from 'react'
import { UserPlus, Loader2, Info, Lock, Unlock, Search } from 'lucide-react'
import { cn, noAccent } from '@/lib/utils'
import { toast } from 'sonner'

export default function StaffManagement() {
  const [users, setUsers] = useState([])
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all')
  const [f, setF] = useState({ username: '', full_name: '', employee_code: '', phone: '', role: 'sales', password: '' })

  const load = () => supabase.from('users').select('*').order('created_at', { ascending: false })
    .then(({ data }) => setUsers(data ?? []))
  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    if (f.password.length < 6) return toast.error('Mật khẩu tối thiểu 6 ký tự.')
    setBusy(true)
    // signUp tao tai khoan tren Supabase Auth; trigger tr_auth_user_created
    // tu sinh dong tuong ung trong public.users voi metadata ben duoi.
    const { error } = await supabase.auth.signUp({
      email: toEmail(f.username),
      password: f.password,
      options: {
        data: {
          username: f.username.toLowerCase(),
          full_name: f.full_name,
          employee_code: f.employee_code,
          phone: f.phone,
          role: f.role
        }
      }
    })
    setBusy(false)
    if (error) return toast.error(loiTiengViet(error))
    toast.success(`Đã tạo tài khoản ${f.username}. Bàn giao mật khẩu cho nhân viên.`)
    setF({ username: '', full_name: '', employee_code: '', phone: '', role: 'sales', password: '' })
    setTimeout(load, 800)
  }

  const toggleActive = async (u) => {
    const { error } = await supabase.from('users').update({ is_active: !u.is_active }).eq('id', u.id)
    if (error) return toast.error(error.message)
    toast.success(u.is_active ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản')
    load()
  }

  const timKiem = useMemo(() => {
    const key = noAccent(q)
    return users.filter(u =>
      !key || noAccent(`${u.full_name} ${u.username} ${u.employee_code ?? ''}`).includes(key))
  }, [users, q])

  const nhom = useMemo(() => ({
    all: timKiem,
    management: timKiem.filter(u => u.role === 'management'),
    accounting: timKiem.filter(u => u.role === 'accounting'),
    sales: timKiem.filter(u => u.role === 'sales'),
    production: timKiem.filter(u => u.role === 'production'),
    locked: timKiem.filter(u => !u.is_active)
  }), [timKiem])

  const TAB = [
    ['all', 'Tất cả'],
    ['management', ROLE_LABEL.management],
    ['accounting', ROLE_LABEL.accounting],
    ['sales', ROLE_LABEL.sales],
    ['production', ROLE_LABEL.production],
    ['locked', 'Đã khóa']
  ]

  return (
    <>
      <PageHeader title="Quản lý nhân sự" desc="Kế toán tạo tài khoản đăng nhập cho nhân viên mới" />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Tạo tài khoản mới</CardTitle>
            <CardDescription>Tên đăng nhập sẽ được ghép thành <code>@{LOGIN_DOMAIN}</code></CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="space-y-3">
              <Fld label="Tên đăng nhập *" value={f.username} onChange={v => setF({ ...f, username: v.replace(/\s/g, '') })} placeholder="nv.hoan" required />
              <Fld label="Họ tên *" value={f.full_name} onChange={v => setF({ ...f, full_name: v })} placeholder="Bùi Văn Hoàn" required />
              <div className="grid grid-cols-2 gap-3">
                <Fld label="Mã NV" value={f.employee_code} onChange={v => setF({ ...f, employee_code: v })} placeholder="NV007" />
                <Fld label="Điện thoại" value={f.phone} onChange={v => setF({ ...f, phone: v })} />
              </div>
              <div className="space-y-1.5">
                <Label>Bộ phận</Label>
                <Select value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>
                  {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </div>
              <Fld label="Mật khẩu khởi tạo *" type="password" value={f.password}
                onChange={v => setF({ ...f, password: v })} placeholder="tối thiểu 6 ký tự" required />
              <p className="flex gap-2 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
                <Info className="size-4 shrink-0" />
                Chỉ Ban Giám đốc mới được thay đổi vai trò sau khi tài khoản đã tạo.
              </p>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Tạo tài khoản
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="space-y-3">
            <CardTitle>Danh sách nhân viên ({users.length})</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <SearchInput className="pl-9" placeholder="Tìm tên, tài khoản, mã NV..."
                value={q} onChange={e => setQ(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent>
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
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      Không có nhân viên nào trong nhóm này
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tài khoản</TableHead>
                          <TableHead>Họ tên</TableHead>
                          <TableHead>Bộ phận</TableHead>
                          <TableHead>Ngày tạo</TableHead>
                          <TableHead className="text-right">TT</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {nhom[k].map(u => (
                          <TableRow key={u.id} className={cn(!u.is_active && 'bg-muted/40 text-muted-foreground')}>
                            <TableCell className="font-mono text-xs">{u.username}</TableCell>
                            <TableCell>
                              {u.full_name}
                              {u.employee_code && <span className="block text-xs text-muted-foreground">{u.employee_code}</span>}
                            </TableCell>
                            <TableCell><Badge className="bg-muted text-foreground">{ROLE_LABEL[u.role]}</Badge></TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">{dmy(u.created_at)}</TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="ghost" onClick={() => toggleActive(u)}
                                className={u.is_active ? 'text-emerald-600' : 'text-rose-600'}>
                                {u.is_active ? <Unlock className="size-4" /> : <Lock className="size-4" />}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

const Fld = ({ label, value, onChange, ...rest }) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <Input value={value} onChange={e => onChange(e.target.value)} {...rest} />
  </div>
)

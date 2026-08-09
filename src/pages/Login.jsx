import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, HOME_BY_ROLE } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Lock, User, Factory, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const { signIn, profile, session } = useAuth()
  const nav = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // Da dang nhap san -> dieu huong thang ve dashboard cua bo phan
  useEffect(() => {
    if (session && profile) nav(HOME_BY_ROLE[profile.role] ?? '/', { replace: true })
  }, [session, profile, nav])

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const p = await signIn(username, password)
      nav(HOME_BY_ROLE[p.role] ?? '/', { replace: true })   // tu dong vao dung phong ban
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Factory className="size-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Hệ thống QLSX</h1>
          <p className="mt-1 text-sm text-muted-foreground">Quản lý đơn hàng &amp; công nợ</p>
        </div>

        <Card className="rounded-2xl shadow-lg">
          <CardContent className="pt-6">
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="u">Tên đăng nhập</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="u" className="pl-9" autoComplete="username" required
                    value={username} onChange={e => setUsername(e.target.value)} placeholder="vd: nv.hoan" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p">Mật khẩu</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="p" className="pl-9 pr-9" type={show ? 'text' : 'password'}
                    autoComplete="current-password" required
                    value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                  <button type="button" onClick={() => setShow(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {err && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {err}
                </p>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Đăng nhập
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Quên mật khẩu? Liên hệ bộ phận Kế toán để được cấp lại.
        </p>
      </div>
    </div>
  )
}

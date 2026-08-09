import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABEL } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import {
  LayoutDashboard, FilePlus2, ListOrdered, CheckSquare, Wallet, Users,
  KanbanSquare, BarChart3, ShieldCheck, Menu, X, LogOut, Factory, Building2,
  Settings as SettingsIcon, Package
} from 'lucide-react'

const NAV = {
  sales: [
    { to: '/kinhdoanh',            icon: LayoutDashboard, label: 'Tổng quan', end: true },
    { to: '/kinhdoanh/don-moi',    icon: FilePlus2,       label: 'Lập đơn hàng' },
    { to: '/kinhdoanh/don-hang',   icon: ListOrdered,     label: 'Đơn hàng của tôi' },
    { to: '/kinhdoanh/tien-do',    icon: KanbanSquare,    label: 'Tiến độ đơn hàng' },
    { to: '/ma-hang',              icon: Package,         label: 'Danh mục mã hàng' }
  ],
  accounting: [
    { to: '/ketoan',               icon: LayoutDashboard, label: 'Tổng quan', end: true },
    { to: '/ketoan/duyet-don',     icon: CheckSquare,     label: 'Duyệt đơn hàng' },
    { to: '/ketoan/cong-no',       icon: Wallet,          label: 'Thu tiền & công nợ' },
    { to: '/ketoan/nhan-su',       icon: Users,           label: 'Tạo tài khoản NV' },
    { to: '/ma-hang',              icon: Package,         label: 'Danh mục mã hàng' },
    { to: '/cau-hinh',             icon: SettingsIcon,    label: 'Cấu hình hệ thống' }
  ],
  production: [
    { to: '/sanxuat',              icon: KanbanSquare,    label: 'Bảng sản xuất', end: true },
    { to: '/ma-hang',              icon: Package,         label: 'Danh mục mã hàng' }
  ],
  management: [
    { to: '/gd',                   icon: BarChart3,       label: 'Báo cáo tổng hợp', end: true },
    { to: '/gd/cong-no',           icon: Wallet,          label: 'Công nợ khách hàng' },
    { to: '/gd/phan-quyen',        icon: ShieldCheck,     label: 'Phân quyền nhân sự' },
    { to: '/ketoan/nhan-su',       icon: Users,           label: 'Tạo tài khoản NV' },
    { to: '/ketoan/duyet-don',     icon: CheckSquare,     label: 'Duyệt đơn hàng' },
    { to: '/sanxuat',              icon: KanbanSquare,    label: 'Bảng sản xuất' },
    { to: '/ma-hang',              icon: Package,         label: 'Danh mục mã hàng' },
    { to: '/cau-hinh',             icon: SettingsIcon,    label: 'Cấu hình hệ thống' }
  ]
}

const DEPT_ICON = { sales: Building2, accounting: Wallet, production: Factory, management: BarChart3 }

export default function AppLayout() {
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const items = NAV[profile?.role] ?? []
  const Icon = DEPT_ICON[profile?.role] ?? Building2

  const initials = (profile?.full_name ?? '?')
    .split(' ').slice(-2).map(w => w[0]).join('').toUpperCase()

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-background lg:flex">
        <Brand Icon={Icon} role={profile?.role} />
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map(i => <NavItem key={i.to} {...i} />)}
        </nav>
        <div className="border-t p-3 text-xs text-muted-foreground">
          QLSX v1.0 · {ROLE_LABEL[profile?.role]}
        </div>
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-background shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <Brand Icon={Icon} role={profile?.role} bare />
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X /></Button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3" onClick={() => setOpen(false)}>
              {items.map(i => <NavItem key={i.to} {...i} />)}
            </nav>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
            <Menu />
          </Button>
          <div className="flex-1 truncate">
            <p className="truncate text-sm font-semibold">{profile?.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {ROLE_LABEL[profile?.role]}{profile?.employee_code ? ` · ${profile.employee_code}` : ''}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{profile?.username}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={async () => { await signOut(); nav('/login', { replace: true }) }}>
                <LogOut className="size-4" /> Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="mx-auto w-full max-w-7xl p-4 pb-16 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Brand({ Icon, role, bare }) {
  return (
    <div className={cn('flex items-center gap-3', bare ? '' : 'h-16 border-b px-5')}>
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Icon className="size-5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold">QLSX</p>
        <p className="text-xs text-muted-foreground">{ROLE_LABEL[role]}</p>
      </div>
    </div>
  )
}

function NavItem({ to, icon: I, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground')
      }
    >
      <I className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

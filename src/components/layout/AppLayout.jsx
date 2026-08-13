import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABEL } from '@/lib/format'
import { cn } from '@/lib/utils'
import { donFileDaTatToan } from '@/lib/cleanup'
import { versionLabel, COMMIT } from '@/lib/version'
import { useBanMoi, taiLaiSach } from '@/hooks/useBanMoi'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import {
  LayoutDashboard, FilePlus2, ListOrdered, CheckSquare, Wallet, Users,
  KanbanSquare, BarChart3, ShieldCheck, Menu, X, LogOut, Factory, Building2,
  Settings as SettingsIcon, Package, Receipt, FileWarning, ScrollText, Landmark,
  RefreshCw, Sparkles
} from 'lucide-react'

const NAV = {
  sales: [
    { to: '/kinhdoanh',            icon: LayoutDashboard, label: 'Tổng quan', end: true },
    { to: '/kinhdoanh/don-moi',    icon: FilePlus2,       label: 'Lập đơn hàng' },
    { to: '/kinhdoanh/don-hang',   icon: ListOrdered,     label: 'Đơn hàng của tôi' },
    { to: '/kinhdoanh/tien-do',    icon: KanbanSquare,    label: 'Tiến độ đơn hàng' },
    { to: '/ketoan/bang-ke',       icon: Landmark,        label: 'Tiền về ngân hàng' },
    { to: '/ma-hang',              icon: Package,         label: 'Danh mục mã hàng' }
  ],
  accounting: [
    { to: '/ketoan',               icon: LayoutDashboard, label: 'Tổng quan', end: true },
    { to: '/ketoan/duyet-don',     icon: CheckSquare,     label: 'Duyệt đơn hàng' },
    { to: '/ketoan/cong-no',       icon: Wallet,          label: 'Thu tiền & công nợ' },
    { to: '/ketoan/so-thu-tien',   icon: Receipt,         label: 'Sổ thu tiền' },
    { to: '/ketoan/bang-ke',       icon: Landmark,        label: 'Bảng kê ngân hàng' },
    { to: '/ketoan/dieu-chinh',    icon: FileWarning,     label: 'Yêu cầu điều chỉnh' },
    { to: '/ketoan/nhat-ky',       icon: ScrollText,      label: 'Nhật ký hệ thống' },
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
    { to: '/gd/don-hang',          icon: ListOrdered,     label: 'Quản lý đơn hàng' },
    { to: '/gd/cong-no',           icon: Wallet,          label: 'Công nợ khách hàng' },
    { to: '/ketoan/cong-no',       icon: Wallet,          label: 'Thu tiền & ghi cọc' },
    { to: '/ketoan/so-thu-tien',   icon: Receipt,         label: 'Sổ thu tiền' },
    { to: '/ketoan/bang-ke',       icon: Landmark,        label: 'Bảng kê ngân hàng' },
    { to: '/ketoan/dieu-chinh',    icon: FileWarning,     label: 'Duyệt điều chỉnh thu tiền' },
    { to: '/ketoan/nhat-ky',       icon: ScrollText,      label: 'Nhật ký hệ thống' },
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

  // Co ban moi tren may chu chua? Kiem moi 2 phut va moi lan quay lai tab.
  const banMoi = useBanMoi()

  const initials = (profile?.full_name ?? '?')
    .split(' ').slice(-2).map(w => w[0]).join('').toUpperCase()

  // Tu don file Market cua don da giao + da thu du tien.
  // Chay 1 lan moi phien, chi voi Ke toan / Giam doc.
  const daDon = useRef(false)
  useEffect(() => {
    if (daDon.current) return
    if (!['accounting', 'management'].includes(profile?.role)) return
    daDon.current = true
    donFileDaTatToan().then(({ count, bytes }) => {
      if (count > 0) {
        toast.success(
          `Đã dọn ${count} file thiết kế của đơn đã tất toán — giải phóng ${(bytes / 1048576).toFixed(1)}MB`,
          { duration: 6000 })
      }
    })
  }, [profile?.role])

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-background lg:flex">
        <Brand Icon={Icon} role={profile?.role} />
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map(i => <NavItem key={i.to} {...i} />)}
        </nav>
        <div className="space-y-0.5 border-t p-3 text-xs text-muted-foreground">
          <p>QLSX · {ROLE_LABEL[profile?.role]}</p>
          <button type="button" onClick={taiLaiSach}
            title="Bấm để tải lại bản mới nhất (xóa bộ nhớ đệm trình duyệt)"
            className="flex items-center gap-1.5 font-mono text-[11px] transition hover:text-foreground">
            <RefreshCw className="size-3" />
            {versionLabel()}
          </button>
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
        {banMoi && (
          <div className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-3 bg-primary px-4 py-2.5 text-sm text-primary-foreground">
            <Sparkles className="size-4 shrink-0" />
            <span>
              Đã có <b>bản {banMoi}</b> — bạn đang chạy bản {versionLabel().match(/build (\S+)/)?.[1] ?? '?'}.
            </span>
            <button type="button" onClick={taiLaiSach}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1 font-semibold text-primary transition hover:bg-white/90">
              <RefreshCw className="size-3.5" /> Tải bản mới ngay
            </button>
          </div>
        )}
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

        <main className="mx-auto w-full max-w-[1500px] p-4 pb-16 sm:p-6">
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

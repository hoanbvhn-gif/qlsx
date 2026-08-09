import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth, HOME_BY_ROLE } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'

import Login from '@/pages/Login'
import SalesDashboard from '@/pages/sales/SalesDashboard'
import NewOrder from '@/pages/sales/NewOrder'
import MyOrders from '@/pages/sales/MyOrders'
import OrderProgress from '@/pages/sales/OrderProgress'
import AccountingDashboard from '@/pages/accounting/AccountingDashboard'
import ApprovalQueue from '@/pages/accounting/ApprovalQueue'
import Payments from '@/pages/accounting/Payments'
import StaffManagement from '@/pages/accounting/StaffManagement'
import KanbanBoard from '@/pages/production/KanbanBoard'
import Analytics from '@/pages/management/Analytics'
import DebtReport from '@/pages/management/DebtReport'
import UserRoles from '@/pages/management/UserRoles'

// Trang goc: dieu huong thang ve dashboard theo vai tro
function RoleHome() {
  const { profile, session, loading } = useAuth()
  if (loading) return null
  if (!session || !profile) return <Navigate to="/login" replace />
  return <Navigate to={HOME_BY_ROLE[profile.role] ?? '/login'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      {/* HashRouter: bat buoc cho GitHub Pages (khong co server rewrite) */}
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RoleHome />} />

          {/* ---------- KINH DOANH ---------- */}
          <Route path="/kinhdoanh" element={
            <ProtectedRoute allow={['sales', 'management']}><AppLayout /></ProtectedRoute>}>
            <Route index element={<SalesDashboard />} />
            <Route path="don-moi" element={<NewOrder />} />
            <Route path="don-hang" element={<MyOrders />} />
            <Route path="tien-do" element={<OrderProgress />} />
          </Route>

          {/* ---------- KE TOAN ---------- */}
          <Route path="/ketoan" element={
            <ProtectedRoute allow={['accounting', 'management']}><AppLayout /></ProtectedRoute>}>
            <Route index element={<AccountingDashboard />} />
            <Route path="duyet-don" element={<ApprovalQueue />} />
            <Route path="cong-no" element={<Payments />} />
            <Route path="nhan-su" element={<StaffManagement />} />
          </Route>

          {/* ---------- SAN XUAT ---------- */}
          <Route path="/sanxuat" element={
            <ProtectedRoute allow={['production', 'management']}><AppLayout /></ProtectedRoute>}>
            <Route index element={<KanbanBoard />} />
          </Route>

          {/* ---------- BAN GIAM DOC ---------- */}
          <Route path="/gd" element={
            <ProtectedRoute allow={['management']}><AppLayout /></ProtectedRoute>}>
            <Route index element={<Analytics />} />
            <Route path="cong-no" element={<DebtReport />} />
            <Route path="phan-quyen" element={<UserRoles />} />
          </Route>

          <Route path="*" element={<RoleHome />} />
        </Routes>
      </HashRouter>
      <Toaster position="top-right" richColors closeButton />
    </AuthProvider>
  )
}

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, HOME_BY_ROLE } from '@/context/AuthContext'
import { Loader2 } from 'lucide-react'

export function ProtectedRoute({ allow, children }) {
  const { session, profile, loading } = useAuth()
  const loc = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!session || !profile) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (allow && !allow.includes(profile.role)) return <Navigate to={HOME_BY_ROLE[profile.role]} replace />
  return children
}

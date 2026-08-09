import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, toEmail } from '@/lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)   // dong trong public.users
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid) => {
    if (!uid) { setProfile(null); return null }
    const { data, error } = await supabase.from('users').select('*').eq('id', uid).single()
    if (error) { console.error('Không tải được hồ sơ nhân viên:', error.message); setProfile(null); return null }
    setProfile(data)
    return data
  }, [])

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      await loadProfile(data.session?.user?.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s)
      await loadProfile(s?.user?.id)
      setLoading(false)
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [loadProfile])

  const signIn = async (username, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: toEmail(username),
      password
    })
    if (error) throw new Error(mapAuthError(error.message))
    const p = await loadProfile(data.user.id)
    if (!p) throw new Error('Tài khoản chưa được khởi tạo hồ sơ. Liên hệ Kế toán.')
    if (!p.is_active) { await supabase.auth.signOut(); throw new Error('Tài khoản đã bị khóa.') }
    return p
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null); setSession(null)
  }

  const value = {
    session, profile, loading,
    role: profile?.role ?? null,
    userId: session?.user?.id ?? null,
    signIn, signOut, refreshProfile: () => loadProfile(session?.user?.id)
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function mapAuthError(msg = '') {
  if (/invalid login credentials/i.test(msg)) return 'Sai tên đăng nhập hoặc mật khẩu.'
  if (/email not confirmed/i.test(msg))       return 'Tài khoản chưa được kích hoạt.'
  if (/rate limit/i.test(msg))                return 'Bạn thao tác quá nhanh, vui lòng thử lại sau.'
  return msg
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải nằm trong AuthProvider')
  return ctx
}

export const HOME_BY_ROLE = {
  management: '/gd',
  accounting: '/ketoan',
  sales: '/kinhdoanh',
  production: '/sanxuat'
}

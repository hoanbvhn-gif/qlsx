import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY trong file .env')
}

export const supabase = createClient(url ?? 'http://localhost', key ?? 'public-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
})

// Supabase Auth dung email. He thong dang nhap bang username
// => ghep username thanh <username>@<LOGIN_DOMAIN>
export const LOGIN_DOMAIN = import.meta.env.VITE_LOGIN_DOMAIN || 'congty.local'
export const toEmail = (username) =>
  username.includes('@') ? username.trim().toLowerCase() : `${username.trim().toLowerCase()}@${LOGIN_DOMAIN}`

export const DESIGN_BUCKET = 'designs'

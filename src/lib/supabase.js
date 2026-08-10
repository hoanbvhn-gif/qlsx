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

// Tu ban 1.1 he thong luu LINK thiet ke (OneDrive/Drive/o mang) thay vi upload file.
// Giu hang so nay de tuong thich neu sau nay quay lai dung Storage.
export const DESIGN_BUCKET = 'designs'

/**
 * Danh thuc may chu Supabase.
 *
 * Goi mien phi dua project ve trang thai nghi sau vai gio khong co request,
 * nen lan goi dau tien trong ngay mat 5-30 giay. Ham nay gui mot truy van
 * cuc nhe ngay khi mo trang dang nhap — trong luc nguoi dung con dang go
 * mat khau thi may chu da tinh day, bam Dang nhap la vao ngay.
 */
export async function danhThucMayChu() {
  const t0 = performance.now()
  try {
    // Truy van nhe nhat co the: lay 1 dong, khong lay du lieu that
    await supabase.from('items').select('id', { head: true, count: 'exact' }).limit(1)
    return { ok: true, ms: Math.round(performance.now() - t0) }
  } catch {
    return { ok: false, ms: Math.round(performance.now() - t0) }
  }
}

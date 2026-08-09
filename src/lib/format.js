export const vnd = (n) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(n || 0))

export const vndFull = (n) => vnd(n) + ' d'

export const num = (n, d = 2) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: d }).format(Number(n || 0))

export const dmy = (d) => {
  if (!d) return '--'
  const x = new Date(d)
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`
}

export const dmyhm = (d) => {
  if (!d) return '--'
  const x = new Date(d)
  return `${dmy(d)} ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`
}

// Chuyen chuoi nhap tay "1.250.000" hoac "1250000" -> number
export const parseNum = (s) => {
  if (typeof s === 'number') return s
  if (!s) return 0
  const v = String(s).replace(/\./g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '')
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}

export const ROLE_LABEL = {
  management: 'Ban Giám đốc',
  accounting: 'Kế toán',
  sales: 'Kinh doanh',
  production: 'Sản xuất'
}

export const STATUS = {
  draft:              { label: 'Nháp',              tone: 'bg-slate-100 text-slate-700 border-slate-200' },
  pending_accounting: { label: 'Chờ kế toán duyệt', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  rejected:           { label: 'Bị trả lại',        tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  approved:           { label: 'Đã duyệt',          tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  in_production:      { label: 'Đang sản xuất',     tone: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  completed:          { label: 'Hoàn thành SX',     tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  delivered:          { label: 'Đã giao hàng',      tone: 'bg-teal-50 text-teal-700 border-teal-200' },
  cancelled:          { label: 'Đã hủy',            tone: 'bg-zinc-100 text-zinc-500 border-zinc-200' }
}

export const DEPT_OF_STATUS = {
  draft: 'Kinh doanh',
  pending_accounting: 'Kế toán',
  rejected: 'Kinh doanh',
  approved: 'Sản xuất',
  in_production: 'Sản xuất',
  completed: 'Kinh doanh / Giao hàng',
  delivered: 'Hoàn tất',
  cancelled: '--'
}

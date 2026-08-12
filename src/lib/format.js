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

/**
 * Tinh trang thanh toan cua mot don hang.
 * Tra ve nhan, mau, phan tram da thu -> dung chung cho danh sach va chi tiet.
 */
export function payStatus(order) {
  const total = Number(order?.total_amount ?? 0)
  const paid  = Number(order?.paid_amount ?? 0)
  const debt  = Number(order?.debt_amount ?? (total - paid))
  const pct   = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0

  if (total <= 0)
    return { key: 'noprice', label: 'Chưa có giá', tone: 'bg-slate-100 text-slate-600 border-slate-200', bar: 'bg-slate-300', pct: 0, paid, debt, total }
  if (paid <= 0)
    return { key: 'unpaid', label: 'Chưa thu', tone: 'bg-rose-50 text-rose-700 border-rose-200', bar: 'bg-rose-400', pct: 0, paid, debt, total }
  if (paid >= total)
    return { key: 'paid', label: 'Đã thu đủ', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500', pct: 100, paid, debt: 0, total }
  return { key: 'partial', label: `Đã thu ${pct}%`, tone: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-400', pct, paid, debt, total }
}

/** Nhan loai but toan thu tien */
export const PAYMENT_TYPE_LABEL = {
  deposit: 'Đặt cọc',
  partial: 'Thanh toán từng phần',
  final: 'Thanh toán nốt',
  refund: 'Hoàn trả'
}

/**
 * Doi thong bao loi cua Postgres sang cau tieng Viet nhan vien hieu duoc.
 * Loi goc van giu o cuoi de tra cuu khi can.
 */
export function loiTiengViet(error) {
  const m = error?.message ?? String(error ?? '')

  if (/customers_customer_code_key/.test(m))
    return 'Mã khách hàng này đã có trong hệ thống. Hãy chọn khách hàng đó từ danh sách phía trên, hoặc để trống ô mã để hệ thống tự cấp.'
  if (/uq_items_code|uq_items_combo/.test(m))
    return 'Mã hàng này đã có trong danh mục.'
  if (/orders_order_code_key/.test(m))
    return 'Mã đơn hàng bị trùng. Bấm lưu lại một lần nữa để hệ thống cấp mã mới.'
  if (/users_username_key/.test(m))
    return 'Tên đăng nhập này đã có người dùng. Hãy chọn tên khác.'
  if (/users_email_key|already registered/i.test(m))
    return 'Email hoặc tên đăng nhập này đã được đăng ký.'
  if (/uq_amend_pending/.test(m))
    return 'Bút toán này đã có một yêu cầu điều chỉnh đang chờ Giám đốc duyệt.'
  if (/duplicate key/.test(m))
    return 'Dữ liệu bị trùng với bản ghi đã có. Kiểm tra lại mã hoặc tên vừa nhập.'
  if (/violates foreign key/.test(m))
    return 'Không thực hiện được vì dữ liệu này đang được dùng ở nơi khác.'
  if (/row-level security|not authorized|permission denied/i.test(m))
    return 'Bạn không có quyền thực hiện thao tác này.'
  if (/JWT expired|token is expired/i.test(m))
    return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'
  if (/Failed to fetch|NetworkError/i.test(m))
    return 'Mất kết nối tới máy chủ. Kiểm tra mạng rồi thử lại.'

  return m
}

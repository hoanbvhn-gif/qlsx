import * as XLSX from 'xlsx'

/**
 * Doc file sao ke ngan hang (Excel) va tach ra cac giao dich TIEN VE.
 *
 * Viet theo dinh dang MB Bank ("SAO KE CHI TIET TAI KHOAN"), nhung khong
 * do cung vi tri cot — tim hang tieu de roi anh xa theo TEN COT, nen
 * ngan hang co doi thu tu cot van doc duoc.
 */

/* Ten cot co the gap, viet thuong khong dau de so khop */
const COT = {
  ngay_gd:   ['ngay giao dich', 'transaction date', 'ngay gd'],
  ngay_ht:   ['ngay hach toan', 'posting date', 'ngay hieu luc'],
  no:        ['phat sinh no', 'debit', 'ghi no'],
  co:        ['phat sinh co', 'credit', 'ghi co'],
  so_du:     ['so du', 'balance'],
  doi_tac:   ['don vi thu huong', 'don vi chuyen', 'nguoi chuyen', 'counterparty', 'ten doi tac'],
  noi_dung:  ['noi dung', 'description', 'dien giai', 'remark'],
  but_toan:  ['but toan', 'so but toan', 'reference', 'ref no', 'so tham chieu']
}

const bo_dau = (s) => (s ?? '').toString()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/\s+/g, ' ').trim()

/** '2,510,000' -> 2510000 ; '' -> 0 */
const so = (v) => {
  if (v == null || v === '') return 0
  if (typeof v === 'number') return v
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ''))
  return isNaN(n) ? 0 : n
}

/** '12/08/2026 11:02:24' hoac '12/08/2026' -> { iso, date } */
const ngay = (v) => {
  if (!v) return null
  if (v instanceof Date) return v
  const s = String(v).trim()
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (m) {
    const [, d, mo, y, h = 0, mi = 0, se = 0] = m
    return new Date(+y, +mo - 1, +d, +h, +mi, +se)
  }
  const d2 = new Date(s)
  return isNaN(d2.getTime()) ? null : d2
}

const ymd = (d) => d
  ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  : null

/** Don noi dung CK: ngan hang hay chen khoang trang do xuong dong */
const don_noi_dung = (s) => (s ?? '').toString().replace(/\s{2,}/g, ' ').trim()

/**
 * @returns { rows, tu, den, soTaiKhoan, tenNganHang, tongDong, loi }
 */
export async function docSaoKe(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: false, raw: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })

  /* ---- Tim hang tieu de ---- */
  let hangTieuDe = -1
  for (let i = 0; i < Math.min(grid.length, 30); i++) {
    const hang = grid[i].map(bo_dau)
    if (hang.some(c => COT.ngay_gd.some(k => c.includes(k)))
     && hang.some(c => COT.co.some(k => c.includes(k)))) {
      hangTieuDe = i; break
    }
  }
  if (hangTieuDe < 0) {
    return { rows: [], loi: 'Không tìm thấy dòng tiêu đề trong file. Kiểm tra lại đúng file sao kê ngân hàng chưa.' }
  }

  /* ---- Anh xa cot theo ten ---- */
  const tieuDe = grid[hangTieuDe].map(bo_dau)
  const viTri = {}
  for (const [khoa, tenCot] of Object.entries(COT)) {
    viTri[khoa] = tieuDe.findIndex(c => c && tenCot.some(k => c.includes(k)))
  }
  if (viTri.co < 0 || viTri.but_toan < 0) {
    return { rows: [], loi: 'File thiếu cột "Phát sinh có" hoặc "Bút toán" — không đối chiếu được.' }
  }

  /* ---- Thong tin tai khoan o phan dau file ---- */
  let soTaiKhoan = '', tenNganHang = '', tu = null, den = null
  for (let i = 0; i < hangTieuDe; i++) {
    for (const o of grid[i]) {
      const t = String(o ?? '')
      const mTk = t.match(/Account No[:\s]*([0-9]{6,})/i) || t.match(/Tài khoản[/\w\s]*[:\s]*([0-9]{6,})/i)
      if (mTk) soTaiKhoan = mTk[1]
      if (/NGÂN HÀNG|BANK/i.test(t) && !tenNganHang) tenNganHang = t.split('\n')[0].trim()
      const mTu = t.match(/From[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i)
      const mDen = t.match(/To[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i)
      if (mTu) tu = ngay(mTu[1])
      if (mDen) den = ngay(mDen[1])
    }
  }

  /* ---- Doc tung dong giao dich ---- */
  const rows = []
  let tongDong = 0
  for (let i = hangTieuDe + 1; i < grid.length; i++) {
    const h = grid[i]
    const ref = String(h[viTri.but_toan] ?? '').trim()
    if (!ref) continue                                   // dong tong, dong trong, chan trang
    if (/tổng|total/i.test(String(h[viTri.ngay_ht] ?? ''))) continue

    tongDong++
    const vao = so(h[viTri.co])
    const ra  = so(h[viTri.no])
    if (vao <= 0) continue                               // chi quan tam TIEN VE

    const dGD = ngay(h[viTri.ngay_gd])
    const dHT = ngay(h[viTri.ngay_ht]) ?? dGD
    if (!dHT) continue

    rows.push({
      bank_ref: ref,
      bank_name: tenNganHang || null,
      account_no: soTaiKhoan || null,
      txn_at: dGD ? dGD.toISOString() : null,
      posting_date: ymd(dHT),
      amount_in: vao,
      amount_out: ra,
      balance: viTri.so_du >= 0 ? so(h[viTri.so_du]) : null,
      counterparty: don_noi_dung(h[viTri.doi_tac]) || null,
      content: don_noi_dung(h[viTri.noi_dung]) || null,
      raw: { stt: h[0] ?? null, hang: i + 1 }
    })
  }

  return {
    rows, tongDong, soTaiKhoan, tenNganHang,
    tu: ymd(tu), den: ymd(den),
    loi: rows.length ? null : 'Không tìm thấy giao dịch tiền về nào trong file.'
  }
}

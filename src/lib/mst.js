/**
 * TRA CUU MA SO THUE
 *
 * Nguon: api.vietqr.io — tong hop tu Trang thong tin dien tu cua Cuc Thue
 * (gdt.gov.vn), khong can dang ky, khong can khoa API.
 *
 * Du lieu ho tong hop lai nen co the cham vai ngay so voi Cuc Thue.
 * Doanh nghiep vua thanh lap hoac vua doi ten co the chua co.
 * Vi vay tra khong ra KHONG phai la loi — cu giu ten nguoi dung go.
 */

const API = 'https://api.vietqr.io/v2/business/'

/** MST Viet Nam: 10 so, hoac 13 so dang 0101234567-001 */
export function chuanHoaMST(s) {
  return (s ?? '').replace(/[^\d]/g, '')
}

export function mstHopLe(s) {
  const d = chuanHoaMST(s)
  return d.length === 10 || d.length === 13
}

/** Don vi phu thuoc (13 so) thi tra theo ma me 10 so */
function maTraCuu(s) {
  const d = chuanHoaMST(s)
  return d.length === 13 ? d.slice(0, 10) : d
}

const cache = new Map()

/**
 * @returns {Promise<{ok: boolean, ten?: string, diaChi?: string,
 *                     tenNgan?: string, trangThai?: string, loi?: string}>}
 */
export async function traMST(mst) {
  const ma = maTraCuu(mst)
  if (!mstHopLe(mst)) {
    return { ok: false, loi: 'Mã số thuế phải có 10 số (hoặc 13 số với đơn vị phụ thuộc).' }
  }
  if (cache.has(ma)) return cache.get(ma)

  let kq
  try {
    const ctrl = new AbortController()
    const hetGio = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(API + ma, { signal: ctrl.signal })
    clearTimeout(hetGio)

    if (!res.ok) throw new Error('HTTP ' + res.status)
    const j = await res.json()

    if (j?.code === '00' && j?.data?.name) {
      kq = {
        ok: true,
        ten: j.data.name,
        tenNgan: j.data.shortName || null,
        diaChi: j.data.address || null,
        trangThai: j.data.status || null
      }
    } else {
      kq = { ok: false, loi: 'Không tìm thấy mã số thuế này trong dữ liệu Cục Thuế.' }
    }
  } catch (e) {
    kq = {
      ok: false,
      loi: e.name === 'AbortError'
        ? 'Tra cứu quá lâu, mạng có thể đang chậm.'
        : 'Không kết nối được dịch vụ tra cứu. Cứ nhập tay, không ảnh hưởng gì.'
    }
  }

  // Chi nho ket qua tra duoc — tra hong thi lan sau cho thu lai
  if (kq.ok) cache.set(ma, kq)
  return kq
}

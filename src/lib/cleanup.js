import { supabase, DESIGN_BUCKET } from './supabase'

/**
 * Don file Market khoi Storage cho cac don DA GIAO va DA THU DU TIEN.
 *
 * Vi app chay tren GitHub Pages (khong co may chu chay nen), viec don duoc
 * thuc hien ngay tren trinh duyet moi khi Ke toan / Giam doc mo he thong.
 * Thuc te Ke toan dung he thong hang ngay nen hieu qua nhu tu dong.
 *
 * Chi dong 'upload' bi don. Dong 'link' khong ton dung luong -> giu mai mai.
 * Dong du lieu van con trong bang, chi mat file vat ly.
 */
export async function donFileDaTatToan({ silent = true } = {}) {
  const { data: files, error } = await supabase
    .from('v_file_can_don').select('id, storage_path, file_size, order_code')
  if (error || !files?.length) return { count: 0, bytes: 0, error }

  const paths = files.map(f => f.storage_path).filter(Boolean)
  const { error: eDel } = await supabase.storage.from(DESIGN_BUCKET).remove(paths)
  // Neu file da bien mat tu truoc, van danh dau de khong lap lai
  if (eDel && !/not found/i.test(eDel.message)) return { count: 0, bytes: 0, error: eDel }

  const { error: eMark } = await supabase.rpc('danh_dau_da_don', { p_ids: files.map(f => f.id) })
  if (eMark) return { count: 0, bytes: 0, error: eMark }

  const bytes = files.reduce((a, f) => a + Number(f.file_size ?? 0), 0)
  if (!silent) console.info(`[QLSX] Đã dọn ${files.length} file · ${(bytes / 1048576).toFixed(1)}MB`)
  return { count: files.length, bytes, error: null }
}

/** Doc thong ke dung luong dang dung */
export async function docDungLuong() {
  const { data } = await supabase.from('v_dung_luong').select('*').single()
  return data ?? {
    bytes_dang_dung: 0, mb_dang_dung: 0, phan_tram_1gb: 0,
    so_file: 0, bytes_co_the_don: 0, so_file_co_the_don: 0
  }
}

export const mb = (bytes) => (Number(bytes || 0) / 1048576).toFixed(1)

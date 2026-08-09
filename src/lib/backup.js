import { supabase } from './supabase'
import { dmy } from './format'

/** Chuyen mang object thanh CSV co BOM UTF-8 (Excel mo dung tieng Viet) */
function toCsv(rows, columns) {
  const head = columns.map(c => c.label)
  const body = rows.map(r => columns.map(c => {
    const v = typeof c.get === 'function' ? c.get(r) : r[c.key]
    return `"${String(v ?? '').replace(/"/g, '""')}"`
  }).join(','))
  return '﻿' + [head.map(h => `"${h}"`).join(','), ...body].join('\n')
}

function download(name, csv) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const wait = (ms) => new Promise(r => setTimeout(r, ms))

/**
 * Xuat sao luu toan bo du lieu ra 5 file CSV.
 * Dung de luu tru dinh ky — mo bang Excel doi chieu duoc ngay.
 */
export async function xuatSaoLuu(onProgress) {
  const stamp = new Date().toISOString().slice(0, 10)
  const buoc = [
    {
      ten: 'don-hang',
      lay: () => supabase.from('v_tat_ca_don_hang').select('*').order('order_date'),
      cols: [
        { key: 'order_code', label: 'Mã đơn' },
        { key: 'order_date', label: 'Ngày lập', get: r => dmy(r.order_date) },
        { key: 'customer_code', label: 'Mã KH' },
        { key: 'customer_name', label: 'Khách hàng' },
        { key: 'tax_code', label: 'MST' },
        { key: 'sales_name', label: 'NVKD' },
        { key: 'status', label: 'Trạng thái' },
        { key: 'subtotal', label: 'Tiền hàng' },
        { key: 'vat_amount', label: 'Thuế GTGT' },
        { key: 'total_amount', label: 'Tổng tiền' },
        { key: 'paid_amount', label: 'Đã thu' },
        { key: 'debt_amount', label: 'Còn nợ' },
        { key: 'delivered_at', label: 'Ngày giao', get: r => r.delivered_at ? dmy(r.delivered_at) : '' }
      ]
    },
    {
      ten: 'chi-tiet-hang-hoa',
      lay: () => supabase.from('order_items')
        .select('line_no, item_code, item_name, quantity, unit, unit_price, vat_rate, line_amount, line_vat, line_total, orders(order_code, order_date, customer_name)')
        .order('order_id'),
      cols: [
        { key: 'order_code', label: 'Mã đơn', get: r => r.orders?.order_code },
        { key: 'order_date', label: 'Ngày lập', get: r => dmy(r.orders?.order_date) },
        { key: 'customer_name', label: 'Khách hàng', get: r => r.orders?.customer_name },
        { key: 'line_no', label: 'Dòng' },
        { key: 'item_code', label: 'Mã hàng' },
        { key: 'item_name', label: 'Tên hàng hóa' },
        { key: 'quantity', label: 'Số lượng' },
        { key: 'unit', label: 'ĐVT' },
        { key: 'unit_price', label: 'Đơn giá' },
        { key: 'vat_rate', label: 'VAT %' },
        { key: 'line_amount', label: 'Thành tiền' },
        { key: 'line_vat', label: 'Tiền thuế' },
        { key: 'line_total', label: 'Tổng dòng' }
      ]
    },
    {
      ten: 'so-thu-tien',
      lay: () => supabase.from('v_payment_ledger').select('*').order('payment_date'),
      cols: [
        { key: 'payment_date', label: 'Ngày thu', get: r => dmy(r.payment_date) },
        { key: 'order_code', label: 'Mã đơn' },
        { key: 'customer_name', label: 'Khách hàng' },
        { key: 'payment_type', label: 'Loại' },
        { key: 'amount', label: 'Số tiền' },
        { key: 'method', label: 'Hình thức' },
        { key: 'bank_account', label: 'Tài khoản nhận' },
        { key: 'reference_no', label: 'Số chứng từ' },
        { key: 'transfer_note', label: 'Nội dung CK' },
        { key: 'reconciled', label: 'Đã đối chiếu', get: r => r.reconciled ? 'x' : '' },
        { key: 'voided', label: 'Đã hủy', get: r => r.voided ? 'x' : '' },
        { key: 'nguoi_ghi', label: 'Người ghi' }
      ]
    },
    {
      ten: 'khach-hang',
      lay: () => supabase.from('v_customer_debt').select('*').order('customer_code'),
      cols: [
        { key: 'customer_code', label: 'Mã KH' },
        { key: 'customer_name', label: 'Tên khách hàng' },
        { key: 'tax_code', label: 'MST' },
        { key: 'phone', label: 'Điện thoại' },
        { key: 'total_orders', label: 'Số đơn' },
        { key: 'total_amount', label: 'Tổng tiền' },
        { key: 'paid_amount', label: 'Đã thu' },
        { key: 'debt_amount', label: 'Còn nợ' }
      ]
    },
    {
      ten: 'ma-hang',
      lay: () => supabase.from('items')
        .select('item_code, item_name, unit, list_price, status, material_code, process_code, thickness_code, size_code')
        .order('item_code'),
      cols: [
        { key: 'item_code', label: 'Mã hàng' },
        { key: 'item_name', label: 'Tên sản phẩm' },
        { key: 'unit', label: 'ĐVT' },
        { key: 'list_price', label: 'Đơn giá niêm yết' },
        { key: 'status', label: 'Trạng thái' },
        { key: 'material_code', label: 'Chất liệu' },
        { key: 'process_code', label: 'Gia công' },
        { key: 'thickness_code', label: 'Độ dày' },
        { key: 'size_code', label: 'Kích thước' }
      ]
    }
  ]

  let tong = 0
  for (let i = 0; i < buoc.length; i++) {
    const b = buoc[i]
    onProgress?.({ index: i + 1, total: buoc.length, ten: b.ten })
    const { data, error } = await b.lay()
    if (error) throw new Error(`${b.ten}: ${error.message}`)
    download(`QLSX_${stamp}_${b.ten}.csv`, toCsv(data ?? [], b.cols))
    tong += (data ?? []).length
    await wait(400)   // tranh trinh duyet chan tai nhieu file lien tiep
  }
  return { files: buoc.length, rows: tong }
}

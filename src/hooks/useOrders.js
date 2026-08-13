import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const ORDER_SELECT = `
  id, order_code, order_date, status,
  customer_id, customer_name, customer_tax_code, customer_address, customer_phone,
  sales_id, subtotal, vat_amount, total_amount, paid_amount, pending_amount, debt_amount, is_settled,
  design_file_path, design_file_name, note, reject_reason,
  deposit_expected, deposit_note, deposit_confirmed, deposit_proof_path, deposit_bank_txn_id, cancel_reason, entity_id,
  entity:entity_id ( id, code, short_name, tax_code, default_vat_rate ),
  submitted_at, approved_at, production_started_at, estimated_delivery_date,
  completed_at, delivered_at, created_at,
  sua_sau_duyet_at, so_lan_sua,
  nguoi_sua:sua_sau_duyet_by ( full_name ),
  sales:sales_id ( full_name, employee_code ),
  order_items ( id, line_no, item_code, item_name, spec, quantity, unit, unit_price, vat_rate, line_amount, line_vat, line_total, delivery_date, image_url, file_url, file_name ),
  order_files ( id, line_no, source, file_name, file_url, storage_path, file_size, note ),
  payments (
    id, payment_date, payment_type, amount, method, reference_no, transfer_note, note, bank_account,
    reconciled, proof_path, confirmed, confirmed_at, bank_txn_id, created_by, created_at,
    nguoi_ghi:created_by ( full_name )
  )
`

export function useOrders({ statuses, salesId, autoRefresh = true } = {}) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false })
    if (statuses?.length) q = q.in('status', statuses)
    if (salesId) q = q.eq('sales_id', salesId)
    const { data, error } = await q
    if (error) setError(error.message)
    else { setOrders(data ?? []); setError(null) }
    setLoading(false)
  }, [JSON.stringify(statuses), salesId])

  useEffect(() => { load() }, [load])

  // Realtime: tien do cap nhat dong bo giua Kinh doanh / San xuat / Giam doc
  useEffect(() => {
    if (!autoRefresh) return
    const ch = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [autoRefresh, load])

  return { orders, loading, error, reload: load }
}

export { ORDER_SELECT }

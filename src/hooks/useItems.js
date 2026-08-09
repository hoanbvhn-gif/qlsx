import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const ITEM_SELECT = `
  id, item_code, item_name, unit, list_price, note, status, is_active,
  material_code, process_code, thickness_code, size_code,
  approved_at, created_at,
  material:material_code ( code, name ),
  process:process_code   ( code, name ),
  thickness:thickness_code ( code, name, value_mm ),
  size:size_code ( code, name, width_mm, height_mm )
`

/** Danh muc con: chat lieu / gia cong / do day / kich thuoc */
export function useItemCatalog() {
  const [cat, setCat] = useState({ materials: [], processes: [], thicknesses: [], sizes: [] })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [m, p, t, s] = await Promise.all([
      supabase.from('item_materials').select('*').order('sort_order'),
      supabase.from('item_processes').select('*').order('sort_order'),
      supabase.from('item_thicknesses').select('*').order('sort_order'),
      supabase.from('item_sizes').select('*').order('sort_order')
    ])
    setCat({
      materials: m.data ?? [], processes: p.data ?? [],
      thicknesses: t.data ?? [], sizes: s.data ?? []
    })
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  return { ...cat, loading, reload: load }
}

/** Danh sach ma hang. onlyApproved=true dung cho man lap don hang. */
export function useItems({ onlyApproved = false } = {}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('items').select(ITEM_SELECT).order('item_code')
    if (onlyApproved) q = q.eq('status', 'approved').eq('is_active', true)
    const { data } = await q
    setItems(data ?? [])
    setLoading(false)
  }, [onlyApproved])

  useEffect(() => { load() }, [load])
  return { items, loading, reload: load }
}

export const ITEM_STATUS = {
  pending:  { label: 'Chờ duyệt',  tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Đã duyệt',   tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Từ chối',    tone: 'bg-rose-50 text-rose-700 border-rose-200' }
}

/** Ghep ma tu 4 doan — giong het cot generated ben Postgres */
export const buildItemCode = (m, p, t, s) => `${m || '--'}${p || '--'}${t || '---'}${s || '---'}`

/** Chu thuong hoa ky tu dau: 'Ăn mòn' -> 'ăn mòn', 'In UV' -> 'in UV' */
const lcFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : '')

/**
 * Sinh ten san pham TU MA — ban JS cua ham build_item_name() ben Postgres.
 * Dung de xem truoc; gia tri that van do database quyet dinh.
 */
export function buildItemName(cat, { material_code, process_code, thickness_code, size_code }) {
  const m = cat.materials?.find(x => x.code === material_code)
  const p = cat.processes?.find(x => x.code === process_code)
  const t = cat.thicknesses?.find(x => x.code === thickness_code)
  const z = cat.sizes?.find(x => x.code === size_code)
  if (!m || !p || !t || !z) return ''
  return ['Tem', lcFirst(m.name), lcFirst(p.name), t.code === '000' ? '' : t.name, z.name]
    .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/** Doc bang app_settings ve dang object { key: value } */
export function useSettings() {
  const [settings, setSettings] = useState({})
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('app_settings').select('*').order('key')
    if (!error && data) {
      setRows(data)
      setSettings(Object.fromEntries(data.map(r => [r.key, r.value ?? ''])))
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  return { settings, rows, loading, reload: load }
}

/**
 * Sinh ten thu muc tu quy tac cau hinh.
 * Ho tro: {order_code} {dd} {mm} {yyyy} {customer} {customer_code}
 */
export function buildFolderName(pattern, ctx) {
  const d = ctx.order_date ? new Date(ctx.order_date) : new Date()
  const map = {
    '{order_code}': ctx.order_code ?? '',
    '{dd}': String(d.getDate()).padStart(2, '0'),
    '{mm}': String(d.getMonth() + 1).padStart(2, '0'),
    '{yyyy}': String(d.getFullYear()),
    '{customer}': (ctx.customer_name ?? '').trim(),
    '{customer_code}': (ctx.customer_code ?? '').trim()
  }
  let out = pattern || '{order_code}'
  for (const [k, v] of Object.entries(map)) out = out.split(k).join(v)
  return out.replace(/\s+/g, ' ').trim()
}

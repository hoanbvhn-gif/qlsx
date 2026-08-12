import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/** Danh muc don vi phat hanh hoa don: Cong ty / Ho kinh doanh */
export function useEntities() {
  const [entities, setEntities] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('issuing_entities')
      .select('*').eq('is_active', true).order('sort_order')
    setEntities(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  return { entities, loading, reload: load }
}

/** Mau nhan dien tung don vi cho de phan biet tren bang bieu */
export const ENTITY_TONE = {
  CT:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  HKD: 'bg-orange-50 text-orange-700 border-orange-200'
}
export const entityTone = (code) => ENTITY_TONE[code] ?? 'bg-muted text-muted-foreground border-border'

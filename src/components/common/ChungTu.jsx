import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Receipt, Loader2, X, Upload, ImageOff } from 'lucide-react'
import { toast } from 'sonner'

export const BUCKET_CHUNG_TU = 'chung-tu'
const MAX_MB = 5

/** Xin link xem anh co han 1 tieng cho nhieu duong dan cung luc */
export async function linkChungTu(paths) {
  const list = [...new Set((paths ?? []).filter(Boolean))]
  if (!list.length) return {}
  const { data, error } = await supabase.storage
    .from(BUCKET_CHUNG_TU).createSignedUrls(list, 3600)
  if (error || !data) return {}
  return Object.fromEntries(data.filter(d => d.signedUrl).map(d => [d.path, d.signedUrl]))
}

/**
 * O DINH ANH CHUNG TU CHUYEN KHOAN.
 * Anh nam trong kho rieng tu — trong anh co so tai khoan, so du nen khong de cong khai.
 * Moi lan xem he thong xin mot link tam thoi han 1 tieng.
 */
export default function ChungTu({ value, onChange, size = 'md', readOnly }) {
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    let alive = true
    if (!value) { setUrl(''); return }
    linkChungTu([value]).then(m => { if (alive) setUrl(m[value] ?? '') })
    return () => { alive = false }
  }, [value])

  const kich = size === 'sm' ? 'size-10' : 'size-14'

  const taiLen = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf')
      return toast.error('Chỉ nhận ảnh hoặc file PDF.')
    if (file.size > MAX_MB * 1024 * 1024)
      return toast.error(`File ${(file.size / 1048576).toFixed(1)}MB vượt quá ${MAX_MB}MB.`)

    setBusy(true)
    const sach = file.name.replace(/[^\w.\-]/g, '_')
    const d = new Date()
    const path = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}/${Date.now()}_${sach}`
    const { error } = await supabase.storage.from(BUCKET_CHUNG_TU).upload(path, file, { upsert: false })
    setBusy(false)
    if (error) return toast.error('Tải chứng từ thất bại: ' + error.message)
    onChange(path)
    toast.success('Đã đính chứng từ chuyển khoản')
  }

  /* ----- Da co chung tu ----- */
  if (value) {
    return (
      <div className="group relative inline-block">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" title="Xem chứng từ">
            <img src={url} alt="Chứng từ chuyển khoản"
              className={cn(kich, 'rounded-lg border-2 border-emerald-300 object-cover transition group-hover:brightness-90')} />
          </a>
        ) : (
          <div className={cn(kich, 'flex items-center justify-center rounded-lg border-2 border-emerald-300 bg-emerald-50')}>
            <Loader2 className="size-4 animate-spin text-emerald-600" />
          </div>
        )}
        {!readOnly && (
          <button type="button" onClick={() => onChange('')} title="Bỏ chứng từ"
            className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground opacity-0 transition group-hover:opacity-100">
            <X className="size-3" />
          </button>
        )}
      </div>
    )
  }

  /* ----- Chua co: de trang cho de nhan ----- */
  if (readOnly) {
    return (
      <div className={cn(kich, 'flex items-center justify-center rounded-lg border border-dashed')}
        title="Chưa có chứng từ">
        <ImageOff className="size-4 text-muted-foreground/40" />
      </div>
    )
  }

  return (
    <>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
        title="Đính ảnh chuyển khoản"
        className={cn(kich, 'flex flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed transition',
          busy ? 'opacity-50' : 'hover:border-primary hover:bg-accent')}>
        {busy
          ? <Loader2 className="size-4 animate-spin text-muted-foreground" />
          : <Upload className="size-4 text-muted-foreground" />}
      </button>
      <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={e => taiLen(e.target.files?.[0])} />
    </>
  )
}

/** Nhan gon hien trong bang: co anh thi hien thumbnail, chua co thi de trang */
export function ChungTuNho({ path, url }) {
  if (!path) {
    return <span className="text-xs text-muted-foreground/40">—</span>
  }
  if (!url) {
    return <div className="flex size-10 items-center justify-center rounded border">
      <Loader2 className="size-3 animate-spin text-muted-foreground" />
    </div>
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title="Xem chứng từ chuyển khoản">
      <img src={url} alt="Chứng từ"
        className="size-10 rounded border-2 border-emerald-300 object-cover transition hover:brightness-90" />
    </a>
  )
}

export { Receipt }

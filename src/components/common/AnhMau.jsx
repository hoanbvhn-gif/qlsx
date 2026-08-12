import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { ImagePlus, Loader2, X, Link2, Upload } from 'lucide-react'
import { toast } from 'sonner'

const BUCKET = 'anh-mau'
const MAX_MB = 2

/**
 * O ANH MAU cho mot dong hang hoa.
 * Anh nam trong bucket cong khai nen hien thi ngay, khong phai xin link co han.
 * Chi la anh de San xuat de hinh dung — file in goc van o muc Thiet ke Market.
 */
export default function AnhMau({ value, onChange, ten = '' }) {
  const [busy, setBusy] = useState(false)
  const [moLink, setMoLink] = useState(false)
  const [link, setLink] = useState('')
  const inputRef = useRef(null)

  const taiLen = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Chỉ nhận file ảnh (JPG, PNG, WEBP).')
    if (file.size > MAX_MB * 1024 * 1024)
      return toast.error(`Ảnh ${(file.size / 1048576).toFixed(1)}MB vượt quá ${MAX_MB}MB. Chụp nhỏ lại hoặc dùng link.`)

    setBusy(true)
    const sach = file.name.replace(/[^\w.\-]/g, '_')
    const path = `${new Date().getFullYear()}/${Date.now()}_${sach}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
    setBusy(false)
    if (error) return toast.error('Tải ảnh thất bại: ' + error.message)

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    onChange(data.publicUrl)
    toast.success('Đã thêm ảnh mẫu')
  }

  if (value) {
    return (
      <div className="group relative">
        <a href={value} target="_blank" rel="noopener noreferrer" title={ten || 'Xem ảnh lớn'}>
          <img src={value} alt={ten}
            className="size-12 rounded-lg border object-cover transition group-hover:brightness-90" />
        </a>
        <button type="button" onClick={() => onChange('')} title="Bỏ ảnh"
          className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground opacity-0 transition group-hover:opacity-100">
          <X className="size-3" />
        </button>
      </div>
    )
  }

  if (moLink) {
    return (
      <div className="flex items-center gap-1">
        <input autoFocus value={link} placeholder="Dán link ảnh..."
          onChange={e => setLink(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { onChange(link.trim()); setMoLink(false); setLink('') }
            if (e.key === 'Escape') { setMoLink(false); setLink('') }
          }}
          className="h-9 w-32 rounded-lg border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <button type="button" onClick={() => { setMoLink(false); setLink('') }}
          className="text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
        title="Tải ảnh từ máy"
        className={cn('flex size-12 items-center justify-center rounded-lg border border-dashed transition',
          busy ? 'opacity-50' : 'hover:border-primary hover:bg-accent')}>
        {busy ? <Loader2 className="size-4 animate-spin text-muted-foreground" />
              : <ImagePlus className="size-4 text-muted-foreground" />}
      </button>
      <button type="button" onClick={() => setMoLink(true)} title="Dán link ảnh"
        className="text-muted-foreground hover:text-foreground">
        <Link2 className="size-3.5" />
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => taiLen(e.target.files?.[0])} />
    </div>
  )
}

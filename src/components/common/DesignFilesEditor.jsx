import { useRef, useState } from 'react'
import { supabase, DESIGN_BUCKET } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  Plus, Trash2, Link2, Upload, ExternalLink, Loader2, AlertTriangle, HardDrive, FileCheck2
} from 'lucide-react'
import { toast } from 'sonner'

export const isUrl = (s) => /^(https?:|file:|\\\\)/i.test((s ?? '').trim())
export const blankFile = () => ({
  key: crypto.randomUUID(), source: 'link',
  file_name: '', file_url: '', storage_path: '', file_size: null, note: ''
})
/** Dong hop le = co link hop le HOAC da tai file len xong */
export const isValidFile = (r) =>
  (r.source === 'link' && isUrl(r.file_url)) || (r.source === 'upload' && !!r.storage_path)

const MAX_MB = 25
const fmtMb = (b) => (b / 1024 / 1024).toFixed(1) + 'MB'

/**
 * Bang nhap file thiet ke Market. Moi dong chon 1 trong 2 kieu:
 *   - Link  : dan duong dan Drive/OneDrive/o mang (khong ton dung luong he thong)
 *   - Tải lên: file nam trong Supabase Storage (goi mien phi 1GB)
 */
export default function DesignFilesEditor({ rows, setRows, folderHint }) {
  const add = () => setRows(r => [...r, blankFile()])
  const del = (key) => setRows(r => (r.length === 1 ? [blankFile()] : r.filter(x => x.key !== key)))
  const set = (key, patch) => setRows(r => r.map(x => (x.key === key ? { ...x, ...patch } : x)))
  const valid = rows.filter(isValidFile)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Danh sách thiết kế ({valid.length})</Label>
        <Button size="sm" variant="outline" onClick={add}><Plus className="size-4" /> Thêm</Button>
      </div>

      {!valid.length && (
        <p className="flex gap-2 rounded-lg bg-amber-100/70 p-2.5 text-xs text-amber-800">
          <AlertTriangle className="size-4 shrink-0" />
          Chưa có thiết kế nào. Đơn chưa gửi Kế toán duyệt được.
        </p>
      )}

      {rows.map((r, i) => (
        <FileRow key={r.key} row={r} index={i} folderHint={folderHint}
          onChange={patch => set(r.key, patch)} onDelete={() => del(r.key)} />
      ))}
    </div>
  )
}

function FileRow({ row, index, folderHint, onChange, onDelete }) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const inputRef = useRef(null)

  const pickFile = async (file) => {
    if (!file) return
    if (file.size > MAX_MB * 1024 * 1024)
      return toast.error(`File ${fmtMb(file.size)} vượt quá ${MAX_MB}MB. Dùng kiểu Link cho file lớn.`)

    setBusy(true); setProgress(30)
    const clean = file.name.replace(/[^\w.\-]/g, '_')
    const path = `${folderHint || 'chua-phan-loai'}/${Date.now()}_${clean}`
    const { error } = await supabase.storage.from(DESIGN_BUCKET).upload(path, file, { upsert: false })
    setProgress(100); setBusy(false)

    if (error) {
      return toast.error(/row-level security|not authorized/i.test(error.message)
        ? 'Không có quyền tải file lên. Liên hệ quản trị.'
        : 'Tải lên thất bại: ' + error.message)
    }
    onChange({
      source: 'upload', storage_path: path, file_size: file.size,
      file_name: row.file_name?.trim() || file.name, file_url: ''
    })
    toast.success(`Đã tải lên ${file.name}`)
  }

  const openUploaded = async () => {
    const { data, error } = await supabase.storage
      .from(DESIGN_BUCKET).createSignedUrl(row.storage_path, 600)
    if (error) return toast.error('Không mở được file: ' + error.message)
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  const clearUpload = () => onChange({ source: 'upload', storage_path: '', file_size: null })

  return (
    <div className="space-y-2 rounded-xl border p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">Thiết kế {index + 1}</span>
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>

      {/* Chon kieu dinh kem */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <Tab active={row.source === 'link'} onClick={() => onChange({ source: 'link' })}>
          <Link2 className="size-3.5" /> Dán link
        </Tab>
        <Tab active={row.source === 'upload'} onClick={() => onChange({ source: 'upload' })}>
          <Upload className="size-3.5" /> Tải từ máy
        </Tab>
      </div>

      <Input placeholder="Tên file — vd: 25 - nhôm 0.5 - 1t - 2k.pdf"
        value={row.file_name} onChange={e => onChange({ file_name: e.target.value })} />

      {row.source === 'link' ? (
        <>
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Dán link Google Drive / OneDrive / ổ mạng"
              value={row.file_url} onChange={e => onChange({ file_url: e.target.value })} />
          </div>
          {row.file_url.trim() && !isUrl(row.file_url) && (
            <p className="text-xs text-destructive">
              Link phải bắt đầu bằng https:// hoặc \\ (đường dẫn ổ mạng)
            </p>
          )}
          {isUrl(row.file_url) && (
            <a href={row.file_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <ExternalLink className="size-3" /> Mở thử link
            </a>
          )}
        </>
      ) : row.storage_path ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs">
          <FileCheck2 className="size-4 shrink-0 text-emerald-600" />
          <span className="min-w-0 flex-1 truncate text-emerald-800">
            Đã tải lên{row.file_size ? ` · ${fmtMb(row.file_size)}` : ''}
          </span>
          <button type="button" onClick={openUploaded} className="text-primary hover:underline">Xem</button>
          <button type="button" onClick={clearUpload} className="text-destructive hover:underline">Bỏ</button>
        </div>
      ) : (
        <>
          <label className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-5 text-center transition hover:bg-accent',
            busy && 'pointer-events-none opacity-60')}>
            {busy
              ? <Loader2 className="size-5 animate-spin text-muted-foreground" />
              : <Upload className="size-5 text-muted-foreground" />}
            <span className="text-sm font-medium">{busy ? `Đang tải lên ${progress}%` : 'Chọn file từ máy tính'}</span>
            <span className="text-xs text-muted-foreground">PDF, AI, CDR, PSD, JPG, PNG, ZIP · tối đa {MAX_MB}MB</span>
            <input ref={inputRef} type="file" className="hidden"
              accept=".pdf,.ai,.cdr,.psd,.jpg,.jpeg,.png,.zip,.rar,.eps,.svg"
              onChange={e => pickFile(e.target.files?.[0])} />
          </label>
          <p className="flex gap-2 text-xs text-muted-foreground">
            <HardDrive className="size-3.5 shrink-0" />
            File tải lên chiếm dung lượng hệ thống (gói miễn phí 1GB). Với file in khổ lớn,
            dùng kiểu <b>Dán link</b> sẽ tiết kiệm hơn.
          </p>
        </>
      )}
    </div>
  )
}

const Tab = ({ active, onClick, children }) => (
  <button type="button" onClick={onClick}
    className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition',
      active ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
    {children}
  </button>
)

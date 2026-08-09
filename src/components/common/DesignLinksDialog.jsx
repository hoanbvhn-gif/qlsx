import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSettings, buildFolderName } from '@/hooks/useSettings'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import DesignFilesEditor, { blankFile as blank, isValidFile } from '@/components/common/DesignFilesEditor'
import { Copy, Check, FolderPlus, HardDrive, Loader2, Save, Send } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Quan ly link thiet ke Market cho MOT don hang DA CO MA.
 * Dung sau khi luu nhap -> Sales biet ma don de dat ten thu muc Drive.
 */
export default function DesignLinksDialog({ order, open, onOpenChange, onSaved }) {
  const { settings } = useSettings()
  const [rows, setRows] = useState([blank()])
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!order || !open) return
    supabase.from('order_files').select('*').eq('order_id', order.id).order('line_no')
      .then(({ data }) => {
        setRows(data?.length
          ? data.map(d => ({
              key: d.id, source: d.source ?? 'link',
              file_name: d.file_name, file_url: d.file_url ?? '',
              storage_path: d.storage_path ?? '', file_size: d.file_size ?? null,
              note: d.note ?? ''
            }))
          : [blank()])
      })
  }, [order, open])

  if (!order) return null

  const driveRoot = (settings.drive_root_url ?? '').trim()
  const folderName = buildFolderName(settings.drive_pattern, {
    order_code: order.order_code,
    order_date: order.order_date,
    customer_name: order.customer_name,
    customer_code: order.customer_code
  })

  const valid = rows.filter(isValidFile)

  const copyFolder = async () => {
    try {
      await navigator.clipboard.writeText(folderName)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
      toast.success('Đã copy tên thư mục')
    } catch {
      toast.error('Trình duyệt chặn copy. Bạn bôi đen và copy thủ công nhé.')
    }
  }

  /** Luu danh sach link. submit = true thi gui luon sang Ke toan. */
  const save = async (submit) => {
    if (submit && !valid.length)
      return toast.error('Phải có ít nhất 1 thiết kế mới gửi Kế toán duyệt được.')

    setBusy(true)
    try {
      // ghi de toan bo danh sach cho gon
      const { error: eDel } = await supabase.from('order_files').delete().eq('order_id', order.id)
      if (eDel) throw eDel

      if (valid.length) {
        const payload = valid.map((r, i) => ({
          order_id: order.id, line_no: i + 1,
          source: r.source,
          file_name: r.file_name.trim() || `Thiết kế ${i + 1}`,
          file_url: r.source === 'link' ? r.file_url.trim() : null,
          storage_path: r.source === 'upload' ? r.storage_path : null,
          file_size: r.file_size ?? null,
          note: r.note?.trim() || null
        }))
        const { error: eIns } = await supabase.from('order_files').insert(payload)
        if (eIns) throw eIns
      }

      const primary = valid[0] ?? null
      const patch = {
        design_file_path: primary
          ? (primary.source === 'link' ? primary.file_url.trim() : `storage:${primary.storage_path}`)
          : null,
        design_file_name: primary ? (primary.file_name.trim() || 'Link thiết kế') : null,
        design_uploaded_at: primary ? new Date().toISOString() : null
      }
      if (submit) { patch.status = 'pending_accounting'; patch.reject_reason = null }

      const { error: eUp } = await supabase.from('orders').update(patch).eq('id', order.id)
      if (eUp) throw eUp

      toast.success(submit
        ? `Đã gửi đơn ${order.order_code} sang Kế toán duyệt`
        : 'Đã lưu link thiết kế')
      onSaved?.()
      onOpenChange(false)
    } catch (e) {
      toast.error('Lỗi: ' + (e.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Thiết kế Market · #{order.order_code}
            <StatusBadge status={order.status} />
          </DialogTitle>
          <DialogDescription>{order.customer_name}</DialogDescription>
        </DialogHeader>

        {/* ----- Buoc 1: tao thu muc tren Drive ----- */}
        <div className="space-y-2.5 rounded-xl border bg-muted/40 p-3">
          <div>
            <p className="text-xs text-muted-foreground">Tên thư mục cần tạo trên Google Drive</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border bg-background px-2.5 py-2 font-mono text-sm font-semibold">
                {folderName}
              </code>
              <Button variant="outline" size="icon" onClick={copyFolder} title="Copy tên thư mục">
                {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>

          {driveRoot ? (
            <Button variant="outline" className="w-full" asChild>
              <a href={driveRoot} target="_blank" rel="noopener noreferrer">
                <FolderPlus className="size-4" /> Mở Google Drive
              </a>
            </Button>
          ) : (
            <p className="flex gap-2 rounded-lg bg-background p-2.5 text-xs text-muted-foreground">
              <HardDrive className="size-4 shrink-0" />
              Chưa khai báo thư mục gốc Drive. Nhờ Kế toán hoặc Giám đốc vào
              <b> Cấu hình hệ thống</b> khai báo một lần.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Tạo thư mục đúng tên trên → bỏ file thiết kế vào → chia sẻ
            &quot;Ai có link đều xem được&quot; → copy link dán xuống dưới.
          </p>
        </div>

        {/* ----- Buoc 2: dan link hoac tai file len ----- */}
        <DesignFilesEditor rows={rows} setRows={setRows} folderHint={order.order_code} />

        <DialogFooter>
          <Button variant="outline" onClick={() => save(false)} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Lưu link
          </Button>
          <Button onClick={() => save(true)} disabled={busy || !valid.length}>
            <Send className="size-4" /> Gửi Kế toán duyệt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSettings, buildFolderName } from '@/hooks/useSettings'
import PageHeader from '@/components/common/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Save, Loader2, ExternalLink, FolderTree, Info } from 'lucide-react'

const isHttp = (s) => /^https?:/i.test((s ?? '').trim())
import { toast } from 'sonner'

const PLACEHOLDERS = [
  ['{order_code}', 'Mã đơn hàng — vd 0109082026'],
  ['{dd}', 'Ngày'], ['{mm}', 'Tháng'], ['{yyyy}', 'Năm'],
  ['{customer}', 'Tên khách hàng'], ['{customer_code}', 'Mã khách hàng']
]

export default function Settings() {
  const { settings, loading, reload } = useSettings()
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => { setForm(settings) }, [settings])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    const root = (form.drive_root_url ?? '').trim()
    if (root && !isHttp(root))
      return toast.error('Link thư mục Drive phải bắt đầu bằng https://')
    setBusy(true)
    for (const [key, value] of Object.entries(form)) {
      const { error } = await supabase.from('app_settings')
        .update({ value: (value ?? '').trim() }).eq('key', key)
      if (error) { setBusy(false); return toast.error(error.message) }
    }
    setBusy(false)
    toast.success('Đã lưu cấu hình')
    reload()
  }

  if (loading) return <Skeleton className="h-96 w-full" />

  const preview = buildFolderName(form.drive_pattern, {
    order_code: '0109082026', order_date: new Date(),
    customer_name: 'Cty An Phát', customer_code: 'KH001'
  })

  return (
    <>
      <PageHeader title="Cấu hình hệ thống"
        desc="Khai báo nơi lưu file thiết kế Market và quy tắc đặt tên thư mục" />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Google Drive</CardTitle>
            <CardDescription>
              File thiết kế gốc nằm trên Drive của công ty. Hệ thống chỉ lưu đường dẫn.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Link thư mục gốc chứa thiết kế Market</Label>
              <div className="flex gap-2">
                <Input value={form.drive_root_url ?? ''}
                  onChange={e => set('drive_root_url', e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/1AbC..." />
                {isHttp(form.drive_root_url) && (
                  <Button variant="outline" size="icon" asChild>
                    <a href={form.drive_root_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Mở Google Drive → vào thư mục chứa file Market → copy đường dẫn trên thanh địa chỉ.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Quy tắc đặt tên thư mục mỗi đơn hàng</Label>
              <Input value={form.drive_pattern ?? ''}
                onChange={e => set('drive_pattern', e.target.value)}
                placeholder="{order_code}" className="font-mono" />
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <FolderTree className="size-3.5" /> Xem trước tên thư mục
                </p>
                <p className="mt-1 font-mono text-sm font-semibold">{preview || '(trống)'}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tên công ty (tuỳ chọn)</Label>
              <Input value={form.company_name ?? ''}
                onChange={e => set('company_name', e.target.value)}
                placeholder="Công ty TNHH ..." />
            </div>

            <Button onClick={save} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Lưu cấu hình
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Mã thay thế dùng được</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {PLACEHOLDERS.map(([k, v]) => (
              <div key={k} className="flex items-start gap-2 rounded-lg border p-2.5">
                <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">{k}</code>
                <span className="text-xs text-muted-foreground">{v}</span>
              </div>
            ))}
            <p className="flex gap-2 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
              <Info className="size-4 shrink-0" />
              Ví dụ <code className="font-semibold">{'{yyyy}-{mm}/{order_code}'}</code> sẽ ra
              <b> 2026-08/0109082026</b> — tiện gom theo tháng khi đơn nhiều.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader><CardTitle>Quy trình chuẩn cho nhân viên Kinh doanh</CardTitle></CardHeader>
        <CardContent>
          <ol className="ml-4 list-decimal space-y-1.5 text-sm text-muted-foreground">
            <li>Vào <b>Lập đơn hàng</b>, nhập khách hàng và hàng hóa</li>
            <li>Bấm <b>Lưu nháp &amp; lấy mã đơn</b> — mã đơn được cấp, hộp thoại thiết kế mở ra</li>
            <li>Bấm <b>copy</b> tên thư mục, rồi <b>Mở Google Drive</b> và tạo thư mục đúng tên đó</li>
            <li>Bỏ file thiết kế vào thư mục, đặt chia sẻ <b>&quot;Ai có link đều xem được&quot;</b></li>
            <li>Copy link thư mục, dán vào hộp thoại rồi bấm <b>Gửi Kế toán duyệt</b></li>
            <li>Nếu đóng giữa chừng: vào <b>Đơn hàng của tôi</b> → nút <b>Thiết kế</b> để làm tiếp</li>
          </ol>
        </CardContent>
      </Card>
    </>
  )
}

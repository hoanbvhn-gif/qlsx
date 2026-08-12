import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSettings, buildFolderName } from '@/hooks/useSettings'
import PageHeader from '@/components/common/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Save, Loader2, ExternalLink, FolderTree, Info, HardDrive, Trash2,
  DatabaseBackup, Download, CheckCircle2, AlertTriangle
} from 'lucide-react'
import { donFileDaTatToan, docDungLuong, mb } from '@/lib/cleanup'
import { xuatSaoLuu } from '@/lib/backup'
import { cn } from '@/lib/utils'
import EntitySettings from './EntitySettings'
import { toast } from 'sonner'

const isHttp = (s) => /^https?:/i.test((s ?? '').trim())

const PLACEHOLDERS = [
  ['{order_code}', 'Mã đơn hàng — vd 0109082026'],
  ['{dd}', 'Ngày'], ['{mm}', 'Tháng'], ['{yyyy}', 'Năm'],
  ['{customer}', 'Tên khách hàng'], ['{customer_code}', 'Mã khách hàng']
]

export default function Settings() {
  const { settings, loading, reload } = useSettings()
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)

  const [dl, setDl] = useState(null)          // thong ke dung luong
  const [donBusy, setDonBusy] = useState(false)
  const [saoLuuBusy, setSaoLuuBusy] = useState(false)
  const [tienDo, setTienDo] = useState('')

  useEffect(() => { setForm(settings) }, [settings])
  useEffect(() => { docDungLuong().then(setDl) }, [])

  const donNgay = async () => {
    setDonBusy(true)
    const { count, bytes, error } = await donFileDaTatToan({ silent: false })
    setDonBusy(false)
    if (error) return toast.error('Lỗi khi dọn: ' + error.message)
    toast.success(count
      ? `Đã dọn ${count} file — giải phóng ${mb(bytes)}MB`
      : 'Không có file nào cần dọn')
    docDungLuong().then(setDl)
  }

  const saoLuu = async () => {
    setSaoLuuBusy(true)
    try {
      const r = await xuatSaoLuu(({ index, total, ten }) =>
        setTienDo(`Đang xuất ${index}/${total}: ${ten}`))
      toast.success(`Đã tải về ${r.files} file CSV · ${r.rows} dòng dữ liệu`)
    } catch (e) {
      toast.error('Lỗi khi sao lưu: ' + e.message)
    } finally {
      setSaoLuuBusy(false); setTienDo('')
    }
  }

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

      <EntitySettings />

      {/* ---------- DUNG LUONG ---------- */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><HardDrive className="size-4" /> Dung lượng file thiết kế</CardTitle>
            <CardDescription>
              Gói Supabase miễn phí cho 1GB. File tải lên tự được dọn khi đơn đã giao và thu đủ tiền.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!dl ? <p className="text-sm text-muted-foreground">Đang tính...</p> : (
              <>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold">{dl.mb_dang_dung}<span className="text-base font-normal text-muted-foreground"> MB</span></p>
                    <p className="text-xs text-muted-foreground">{dl.so_file} file đang lưu · trên tổng 1024 MB</p>
                  </div>
                  <span className={cn('text-lg font-semibold',
                    dl.phan_tram_1gb > 80 ? 'text-rose-600'
                      : dl.phan_tram_1gb > 60 ? 'text-amber-600' : 'text-emerald-600')}>
                    {dl.phan_tram_1gb}%
                  </span>
                </div>

                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn('h-full rounded-full transition-all',
                    dl.phan_tram_1gb > 80 ? 'bg-rose-500'
                      : dl.phan_tram_1gb > 60 ? 'bg-amber-500' : 'bg-emerald-500')}
                    style={{ width: `${Math.min(100, dl.phan_tram_1gb)}%` }} />
                </div>

                {dl.phan_tram_1gb > 80 && (
                  <p className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                    <AlertTriangle className="size-4 shrink-0" />
                    Sắp đầy. Chuyển sang dán link Google Drive cho các file mới, hoặc thu hồi
                    công nợ để đơn tất toán và file được dọn.
                  </p>
                )}

                {dl.so_file_co_the_don > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3">
                    <p className="text-sm">
                      <b>{dl.so_file_co_the_don}</b> file thuộc đơn đã tất toán
                      <span className="text-muted-foreground"> · {mb(dl.bytes_co_the_don)}MB</span>
                    </p>
                    <Button size="sm" variant="outline" onClick={donNgay} disabled={donBusy}>
                      {donBusy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      Dọn ngay
                    </Button>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
                    <CheckCircle2 className="size-4 shrink-0" />
                    Không có file nào cần dọn — mọi đơn đã tất toán đều đã được xử lý.
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  Hệ thống tự dọn mỗi khi Kế toán hoặc Giám đốc mở app. Chỉ file <b>tải lên</b> mới
                  bị dọn — dòng dán <b>link</b> không chiếm dung lượng nên giữ vĩnh viễn.
                  Dòng dữ liệu vẫn còn trong đơn để tra cứu, chỉ mất file vật lý.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* ---------- SAO LUU ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><DatabaseBackup className="size-4" /> Sao lưu dữ liệu</CardTitle>
            <CardDescription>
              Tải toàn bộ dữ liệu về máy dạng CSV — mở bằng Excel để lưu trữ hoặc đối chiếu
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5 rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Gồm 5 file</p>
              <ul className="ml-4 list-disc space-y-0.5 text-muted-foreground">
                <li>Đơn hàng — toàn bộ đơn kèm công nợ</li>
                <li>Chi tiết hàng hóa — từng dòng của mỗi đơn</li>
                <li>Sổ thu tiền — mọi bút toán kèm chứng từ</li>
                <li>Khách hàng — kèm tổng công nợ</li>
                <li>Mã hàng — danh mục sản phẩm</li>
              </ul>
            </div>

            <Button onClick={saoLuu} disabled={saoLuuBusy} className="w-full" size="lg">
              {saoLuuBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {tienDo || 'Xuất sao lưu ngay'}
            </Button>

            <p className="flex gap-2 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
              <Info className="size-4 shrink-0" />
              Trình duyệt có thể hỏi &quot;Cho phép tải nhiều file?&quot; — chọn <b>Cho phép</b>.
              Nên xuất mỗi tuần một lần và cất vào thư mục riêng theo ngày. Dữ liệu trên Supabase
              gói miễn phí <b>không có sao lưu tự động</b>, nên đây là bản dự phòng duy nhất của bạn.
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

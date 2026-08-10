# Sao lưu tự động QLSX về máy chạy 24/24

Máy sao lưu **chỉ gọi ra ngoài** tới Supabase để kéo dữ liệu về. Không cần mở port vào.
Nếu bạn đang mở port cho việc khác, cân nhắc đóng lại — máy này sắp chứa toàn bộ dữ liệu
kế toán, công nợ và khách hàng của công ty.

---

## Mỗi lần chạy tạo ra gì

```
D:\QLSX-Backup\
├── 2026-08-10\
│   ├── database.sql      ← bản dump đầy đủ, khôi phục lại được 100%
│   ├── market\           ← toàn bộ file thiết kế trong Storage
│   ├── csv\              ← 6 file mở bằng Excel để tra cứu nhanh
│   └── backup.log        ← nhật ký lần chạy
├── 2026-08-11\
└── lich-su-backup.txt    ← dòng tóm tắt mỗi ngày, xem nhanh đã chạy chưa
```

File Market ngày hôm sau **không tải lại từ đầu** — file nào không đổi thì copy từ bản
hôm trước sang. Lần đầu tải hết, các lần sau chỉ tải file mới, rất nhanh.

---

## Cài đặt — làm một lần

### Bước 1. Cài công cụ PostgreSQL

Tải bộ cài tại https://www.postgresql.org/download/windows/ → chọn phiên bản **17**.

Khi chạy bộ cài, ở màn hình **Select Components** chỉ cần tích **Command Line Tools**,
bỏ hết các mục khác (không cần cài PostgreSQL Server lên máy này).

Cài xong kiểm tra bằng cách mở PowerShell gõ:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" --version
```

Ra dòng `pg_dump (PostgreSQL) 17.x` là được.

> Phiên bản pg_dump phải **bằng hoặc mới hơn** phiên bản Postgres của Supabase.
> Dùng bản 17 là an toàn.

### Bước 2. Lấy chuỗi kết nối database

Supabase Dashboard → nút **Connect** trên thanh trên cùng → tab **Session pooler**
→ copy dòng URI.

Dạng của nó:

```
postgresql://postgres.bdbyahzzfdmbtfxtrtuy:MẬT_KHẨU@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
```

Thay `MẬT_KHẨU` bằng mật khẩu database bạn đặt lúc tạo project. Quên rồi thì vào
**Settings → Database → Reset database password** để đặt lại.

> **Bắt buộc dùng Session pooler (cổng 5432)**, không dùng Transaction pooler (6543)
> — cổng 6543 không chạy được `pg_dump`.

### Bước 3. Lấy service_role key

**Settings → API Keys → tab Legacy anon, service_role API keys** → copy dòng `service_role`.

Khóa này bỏ qua mọi phân quyền, đọc được tất cả. Chỉ để trên máy sao lưu, không gửi
cho ai, không đưa lên GitHub.

### Bước 4. Chuẩn bị thư mục và cấu hình

1. Tạo thư mục `D:\QLSX-Backup`
2. Chép 3 file `backup-qlsx.ps1`, `restore-qlsx.ps1`, `config.example.ps1` vào
   `D:\QLSX-Backup\script\`
3. Đổi tên `config.example.ps1` thành **`config.ps1`**
4. Mở `config.ps1` bằng Notepad, điền chuỗi kết nối và service_role key vào

### Bước 5. Chạy thử

Mở PowerShell, gõ:

```powershell
cd D:\QLSX-Backup\script
powershell -ExecutionPolicy Bypass -File .\backup-qlsx.ps1
```

Lần đầu tải hết file Market nên hơi lâu. Chạy xong vào `D:\QLSX-Backup\<ngày hôm nay>`
kiểm tra có đủ `database.sql`, thư mục `market`, thư mục `csv`.

Nếu báo lỗi, mở `backup.log` trong thư mục đó để xem dòng lỗi cụ thể.

### Bước 6. Đặt lịch chạy hàng ngày

Mở **Task Scheduler** (gõ "Task Scheduler" vào ô tìm kiếm Windows) →
**Create Task** (không phải Create Basic Task).

**Tab General**
- Name: `Sao luu QLSX`
- Chọn **Run whether user is logged on or not**
- Tích **Run with highest privileges**

**Tab Triggers** → New
- Daily, lúc **01:00** (giờ đêm, ít người dùng hệ thống)
- Tích **Enabled**

**Tab Actions** → New
- Action: `Start a program`
- Program/script: `powershell.exe`
- Add arguments:
  ```
  -ExecutionPolicy Bypass -NoProfile -File "D:\QLSX-Backup\script\backup-qlsx.ps1"
  ```
- Start in: `D:\QLSX-Backup\script`

**Tab Settings**
- Tích **Run task as soon as possible after a scheduled start is missed**
  (phòng khi máy tắt lúc 1h sáng)
- **If the task fails, restart every**: 30 minutes, up to 3 times

Bấm OK, nhập mật khẩu Windows khi được hỏi.

**Kiểm tra:** chuột phải task vừa tạo → **Run** → đợi vài phút → xem thư mục đã tạo chưa.

---

## Theo dõi hàng ngày

Mở `D:\QLSX-Backup\lich-su-backup.txt`, mỗi ngày một dòng:

```
2026-08-10  |  842.3 MB  |  o cung con 1843.2 GB
```

Không thấy dòng của hôm qua nghĩa là backup không chạy — kiểm tra Task Scheduler.

Đặt nhắc lịch mỗi đầu tháng mở file này liếc một cái. Backup hỏng mà không ai biết
là tình huống tệ nhất: tưởng có bản sao mà thực ra không có.

---

## Dung lượng

- Database: vài trăm MB, tăng chậm
- File Market: ~5GB/năm

Với 2TB và cấu hình mặc định (giữ 30 bản hàng ngày + bản đầu mỗi tháng trong 24 tháng),
ổ cứng dùng được trên 10 năm. Muốn giữ ít hơn thì sửa `$Global:GiuNgay` trong `config.ps1`.

Vì file Market không đổi được copy sang chứ không nhân bản lại, 30 bản hàng ngày
**không tốn 30 lần dung lượng** — chỉ phần chênh lệch mới tốn thêm.

---

## Khi cần khôi phục

1. Tạo project Supabase mới
2. Chạy lần lượt 15 file SQL trong thư mục `supabase/` để dựng cấu trúc
3. Chạy script khôi phục:

```powershell
cd D:\QLSX-Backup\script
powershell -ExecutionPolicy Bypass -File .\restore-qlsx.ps1 `
  -Ngay 2026-08-10 `
  -ChuoiKetNoiMoi "postgresql://postgres.yyyy:MATKHAU@aws-0-...pooler.supabase.com:5432/postgres"
```

4. Tải lại file Market: vào Supabase mới → Storage → bucket `designs` → kéo thả
   cả thư mục `market` vào
5. Tạo lại tài khoản đăng nhập trong **Authentication → Users**
   (bản dump giữ bảng `public.users` nhưng không giữ mật khẩu — mật khẩu nằm trong
   `auth.users` do Supabase quản lý riêng)
6. Sửa `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` trong GitHub Secrets, chạy lại
   workflow để web trỏ sang database mới

Tổng thời gian khoảng 20–30 phút. Mất phần dữ liệu phát sinh kể từ bản sao gần nhất —
đó là lý do nên chạy backup hàng ngày chứ không phải hàng tuần.

---

## Nên diễn tập một lần

Backup chưa từng thử khôi phục thì chưa phải backup. Sau khi chạy ổn định vài tuần,
nên bỏ ra một buổi tối: tạo project Supabase thứ hai, khôi phục thử vào đó, đăng nhập
kiểm tra dữ liệu có đủ không. Làm một lần rồi thì lúc có sự cố thật sẽ không luống cuống.

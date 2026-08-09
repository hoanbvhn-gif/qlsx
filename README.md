# QLSX — Hệ thống Quản lý Đơn hàng & Công nợ

Quy trình khép kín **Kinh doanh → Kế toán → Sản xuất → Ban Giám đốc**.
React + Vite + Tailwind + shadcn UI · Supabase (Postgres/Auth/Storage) · GitHub Pages.

---

## 1. Kiến trúc

```
qlsx/
├── supabase/
│   ├── 01_schema.sql     bảng, enum, trigger tính tiền, sinh mã đơn, view báo cáo
│   ├── 02_rls.sql        Row Level Security theo 4 vai trò
│   ├── 03_storage.sql    bucket "designs" chứa file thiết kế Market
│   └── 04_seed.sql       tạo tài khoản Giám đốc đầu tiên + khách hàng mẫu
├── src/
│   ├── lib/              supabase client, format tiền VNĐ / ngày, hằng số trạng thái
│   ├── context/          AuthContext (đăng nhập, hồ sơ, vai trò)
│   ├── components/ui/    bộ UI shadcn (button, input, card, table, dialog, tabs...)
│   ├── components/layout/AppLayout (sidebar + drawer mobile), ProtectedRoute
│   ├── hooks/useOrders   truy vấn đơn hàng + realtime subscription
│   └── pages/
│       ├── Login.jsx
│       ├── sales/        Tổng quan · Lập đơn · Đơn của tôi · Tiến độ
│       ├── accounting/   Tổng quan · Duyệt đơn · Thu tiền & công nợ · Tạo tài khoản
│       ├── production/   Bảng Kanban
│       └── management/   Báo cáo · Công nợ khách hàng · Phân quyền
└── .github/workflows/deploy.yml
```

### Luồng trạng thái đơn hàng

```
draft ──gửi──> pending_accounting ──duyệt──> approved ──> in_production ──> completed ──> delivered
                      └──trả lại──> rejected ──> (sửa) ──> pending_accounting
```

Ràng buộc bắt buộc: đơn **không thể** chuyển sang `pending_accounting` nếu chưa có
`design_file_path`. Được chặn ở 3 lớp: UI, CHECK constraint `chk_design_required`,
và trigger `trg_order_status_stamp`.

### Mã đơn hàng
`next_order_code()` sinh chuỗi `[STT 2 chữ số][DD][MM][YYYY]` — ví dụ đơn thứ nhất
ngày 08/08/2026 → **`0108082026`**. Số thứ tự reset theo ngày, lưu trong bảng
`order_counters` với `INSERT ... ON CONFLICT DO UPDATE` nên an toàn khi nhiều nhân
viên lập đơn cùng lúc.

### Tính tiền & công nợ
Không tính ở frontend. Postgres tự lo:

| Cột | Cách tính |
|---|---|
| `order_items.line_amount` | generated column `quantity × unit_price` |
| `order_items.line_vat` | generated column `line_amount × vat_rate / 100` |
| `orders.subtotal / vat_amount / total_amount` | trigger `recalc_order_totals()` |
| `orders.paid_amount` | trigger, cộng dồn từ bảng `payments` |
| `orders.debt_amount` | generated column `total_amount − paid_amount` |
| `orders.is_settled` | `paid_amount >= total_amount` |

Bút toán hoàn trả ghi số âm (`payment_type = 'refund'`) nên số dư luôn khớp.

---

## 2. Cài đặt Supabase (khoảng 10 phút)

**B1.** Tạo project tại https://supabase.com → chọn region Singapore → đặt mật khẩu DB.

**B2.** Vào **SQL Editor**, chạy lần lượt (mỗi file 1 lần):

1. `supabase/01_schema.sql`
2. `supabase/02_rls.sql`
3. `supabase/03_storage.sql`

**B3.** **Authentication → Providers → Email**: tắt *Confirm email*
(hệ thống dùng email nội bộ `<username>@congty.local`, không gửi mail thật được).

**B4.** Tạo tài khoản Giám đốc: **Authentication → Users → Add user**
- Email: `giamdoc@congty.local`
- Password: tự đặt
- Tích **Auto Confirm User**

Rồi chạy `supabase/04_seed.sql` để nâng tài khoản đó lên vai trò `management`.

**B5.** **Storage** — kiểm tra bucket `designs` đã tồn tại và ở chế độ **Private**
(script `03_storage.sql` đã tạo sẵn). File tải xuống qua *signed URL* hiệu lực 10 phút.

**B6.** (khuyến nghị) **Database → Replication** → bật realtime cho bảng `orders`
để tiến độ sản xuất cập nhật tức thời trên màn hình Kinh doanh và Giám đốc.

**B7.** Lấy khóa tại **Project Settings → API**: `Project URL` và `anon public key`.

---

## 3. Chạy trên máy

```bash
cp .env.example .env      # điền VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY
npm install
npm run dev               # http://localhost:5173
```

Đăng nhập bằng `giamdoc` / mật khẩu vừa đặt. Vào **Phân quyền nhân sự** hoặc để
Kế toán vào **Tạo tài khoản NV** cấp tài khoản cho từng bộ phận.

---

## 4. Deploy lên GitHub Pages

**B1.** Đẩy code lên repo (giả sử tên repo là `qlsx`):

```bash
git init && git add . && git commit -m "init"
git branch -M main
git remote add origin https://github.com/<tài-khoản>/qlsx.git
git push -u origin main
```

**B2.** Trong repo → **Settings → Pages → Source** chọn **GitHub Actions**.

**B3.** **Settings → Secrets and variables → Actions**:

| Loại | Tên | Giá trị |
|---|---|---|
| Secret | `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| Secret | `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` |
| Variable | `VITE_LOGIN_DOMAIN` | `congty.local` |

Workflow tự đặt `VITE_BASE=/<tên-repo>/` nên **không cần sửa `vite.config.js`**
khi đổi tên repo.

**B4.** Push lên `main` → tab **Actions** chạy xong → truy cập
`https://<tài-khoản>.github.io/qlsx/`.

**B5.** Về Supabase → **Authentication → URL Configuration**, thêm
`https://<tài-khoản>.github.io/qlsx/` vào *Site URL* và *Redirect URLs*.

> App dùng `HashRouter` (đường dẫn dạng `/#/kinhdoanh`) vì GitHub Pages không có
> server rewrite — nếu dùng `BrowserRouter` sẽ 404 khi F5.

---

## 5. Ma trận phân quyền (thực thi bởi RLS ở tầng database)

| Bảng | Kinh doanh | Kế toán | Sản xuất | Giám đốc |
|---|---|---|---|---|
| `orders` xem | đơn của mình | tất cả | đơn đã duyệt trở đi | tất cả |
| `orders` tạo | ✔ (gán `sales_id = auth.uid()`) | — | — | ✔ |
| `orders` sửa | đơn của mình khi `draft/rejected/pending` | ✔ (duyệt, trả lại) | chỉ trạng thái SX | ✔ |
| `order_items` | theo đơn của mình, khi chưa duyệt | đọc | đọc | ✔ |
| `payments` | chỉ đọc đơn của mình | ✔ toàn quyền | ✖ | ✔ |
| `users` tạo | ✖ | ✔ | ✖ | ✔ |
| `users.role` đổi | ✖ | ✖ | ✖ | ✔ |
| Storage `designs` | tải lên / tải về | tải lên / tải về | chỉ tải về | ✔ |

Hai trigger chốt chặn bổ sung (RLS không khóa được từng cột):

- `trg_guard_production_columns` — Sản xuất không sửa được `total_amount`,
  `paid_amount`, `customer_id`, `sales_id`.
- `trg_guard_role_change` — chỉ `management` mới đổi được cột `role`.

---

## 6. Lưu ý vận hành

- **Xóa đơn**: chỉ Giám đốc, hoặc Sales xóa đơn `draft` của mình. Đơn đã phát sinh
  bút toán thu tiền nên chuyển `cancelled` thay vì xóa, để giữ dấu vết đối chiếu.
- **Thuế suất**: mặc định 8%, chọn được 0/5/8/10% từng dòng hàng — đơn hàng hỗn hợp
  nhiều thuế suất vẫn tách đúng chân thuế khi lên tờ khai.
- **Xuất dữ liệu**: màn hình *Công nợ khách hàng* xuất CSV có BOM UTF-8, mở thẳng
  bằng Excel không lỗi font tiếng Việt.
- **Giới hạn free tier**: 500MB database, 1GB storage, 50.000 người dùng hoạt động
  hàng tháng. Project bị tạm dừng nếu không hoạt động 7 ngày — đăng nhập định kỳ
  hoặc gắn cron ping.
- **Sao lưu**: free tier không tự backup. Đặt lịch chạy `pg_dump` hàng tuần qua
  connection string ở *Settings → Database*.

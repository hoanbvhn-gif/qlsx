-- ============================================================
-- 29_ten_theo_thue.sql
-- Tach lam HAI ten, vi thuc te chung phuc vu hai viec khac han nhau:
--
--   customer_name  — TEN GOI NOI BO: "Tuan Hung", "intec", "anh Thang ben C1"
--                    Dung de tim don, goi dien, noi chuyen hang ngay.
--
--   legal_name     — TEN THEO DANG KY THUE: "CONG TY TNHH ..."
--   legal_address  — DIA CHI THEO DANG KY THUE
--                    Dung khi xuat hoa don. Sai la hoa don sai.
--
-- Truoc day tra MST xong he thong de tên đăng ký lên tên gọi, nhan vien
-- phai doc mot chuoi dai loang ngoang de tim don — sai cach dung.
--
-- Chay 1 lan trong SQL Editor (sau 28).
-- ============================================================

-- ---------- Tren tung don hang ----------
alter table public.orders
  add column if not exists legal_name    text,
  add column if not exists legal_address text;

comment on column public.orders.legal_name is
  'Ten doanh nghiep theo dang ky thue, dung de xuat hoa don. Khac customer_name la ten goi noi bo.';

-- ---------- Tren ho so khach hang ----------
alter table public.customers
  add column if not exists legal_name      text,
  add column if not exists legal_address   text,
  add column if not exists tax_status      text,
  add column if not exists tax_checked_at  timestamptz;

comment on column public.customers.tax_status is
  'Trang thai nguoi nop thue lan tra gan nhat, vd "NNT dang hoat dong".';

-- ---------- Don cu: chua tra MST bao gio nen chua co gi de dien ----------
-- Khong tu suy dien legal_name tu customer_name — hai thu khac nhau,
-- doan bua roi xuat hoa don sai con te hon la de trong.

-- ---------- Danh sach don thieu thong tin phap ly de xuat hoa don ----------
drop view if exists public.v_don_thieu_thong_tin_hoa_don;
create view public.v_don_thieu_thong_tin_hoa_don
with (security_invoker = on) as
select
  o.id, o.order_code, o.order_date, o.customer_name, o.customer_tax_code,
  o.legal_name, o.legal_address, o.total_amount, o.status,
  s.full_name as nvkd,
  e.short_name as don_vi,
  case
    when coalesce(o.customer_tax_code, '') = '' then 'Chua co ma so thue'
    when coalesce(o.legal_name, '') = ''        then 'Co MST nhung chua tra ten dang ky'
    else 'Du thong tin'
  end as tinh_trang
from public.orders o
left join public.users s on s.id = o.sales_id
left join public.issuing_entities e on e.id = o.entity_id
where o.status not in ('draft','cancelled')
  and (coalesce(o.customer_tax_code, '') = '' or coalesce(o.legal_name, '') = '');

comment on view public.v_don_thieu_thong_tin_hoa_don is
  'Don da phat sinh nhung thieu MST hoac ten dang ky — xuat hoa don se vuong.';

grant select on public.v_don_thieu_thong_tin_hoa_don to authenticated;

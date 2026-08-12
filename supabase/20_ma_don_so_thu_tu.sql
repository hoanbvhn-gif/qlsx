-- ============================================================
-- 20_ma_don_so_thu_tu.sql
-- Doi ma don hang: tu [STT][Ngay][Thang][Nam] -> SO THU TU LIEN TUC
--   Cu:  0109082026, 1101082026  (kho doc, kho sap xep)
--   Moi: 0001, 0002, 0003...     (de doc, de goi qua dien thoai)
--
-- So chay lien tuc, KHONG reset dau nam -> khong bao gio trung ma,
-- va nhin ma la biet don nao lap truoc lap sau.
-- Vuot 9999 thi tu dai ra thanh 10000, khong gay loi.
--
-- File nay CO DANH SO LAI cac don da co theo thu tu ngay lap.
-- Chay 1 lan trong SQL Editor (sau 19).
-- ============================================================

-- ---------- 1. Bo dem ----------
create sequence if not exists public.order_code_seq start with 1;

-- ---------- 2. Danh so lai cac don da co ----------
do $$
declare
  r record;
  i int := 0;
begin
  -- Buoc 1: doi sang ma tam de tranh dung ma dang co
  update public.orders set order_code = 'TMP-' || id::text;

  -- Buoc 2: danh so lai theo dung thu tu lap don
  for r in
    select id from public.orders
    order by order_date asc, created_at asc
  loop
    i := i + 1;
    update public.orders
       set order_code = lpad(i::text, 4, '0')
     where id = r.id;
  end loop;

  -- Buoc 3: dat bo dem tiep tuc tu so cuoi
  perform setval('public.order_code_seq', greatest(i, 1), true);

  raise notice 'Da danh so lai % don hang', i;
end $$;

-- ---------- 3. Ham sinh ma moi ----------
-- Giu nguyen ten va tham so p_date de code frontend khong phai sua.
-- p_date khong con dung nua nhung van nhan de tuong thich.
create or replace function public.next_order_code(p_date date default current_date)
returns text
language sql volatile security definer set search_path = public as $$
  select lpad(nextval('public.order_code_seq')::text, 4, '0')
$$;

grant execute on function public.next_order_code(date) to authenticated;
grant usage, select on sequence public.order_code_seq to authenticated;

-- ---------- 4. Bang dem cu khong con dung ----------
drop table if exists public.order_counters;

-- ---------- 5. Bo sung dia chi / dien thoai vao danh sach don ----------
drop view if exists public.v_tat_ca_don_hang;
create view public.v_tat_ca_don_hang
with (security_invoker = on) as
select
  o.id as order_id, o.order_code, o.order_date, o.status,
  o.customer_id, o.customer_name, c.customer_code, c.tax_code,
  o.customer_address, o.customer_phone, o.customer_tax_code,
  o.sales_id, u.full_name as sales_name,
  o.subtotal, o.vat_amount, o.total_amount, o.paid_amount, o.debt_amount, o.is_settled,
  o.deposit_expected, o.deposit_confirmed,
  o.estimated_delivery_date, o.approved_at, o.completed_at, o.delivered_at, o.created_at,
  (select count(*) from public.order_items i where i.order_id = o.id) as so_dong_hang,
  (select count(*) from public.order_files f where f.order_id = o.id) as so_file_thiet_ke,
  (select count(*) from public.payments  p where p.order_id = o.id and not p.voided) as so_but_toan
from public.orders o
left join public.customers c on c.id = o.customer_id
left join public.users     u on u.id = o.sales_id;

-- Doi chieu nhanh sau khi chay:
--   select order_code, order_date, customer_name from public.orders order by order_code;

-- ============================================================
-- 19_coc_va_anh_mau.sql
--  1. TIEN COC: Kinh doanh khai bao coc khach dua ngay khi lap don,
--     Ke toan xac nhan da nhan thi moi thanh but toan that.
--     -> Sales ghi duoc thong tin, ma quyen ghi so van o Ke toan.
--  2. THONG TIN DONG HANG: moi mat hang co ngay giao rieng,
--     anh mau va file thiet ke rieng.
-- Chay 1 lan trong SQL Editor (sau 18).
-- ============================================================

-- ---------- 1. TIEN COC KHAI BAO ----------
alter table public.orders
  add column if not exists deposit_expected  numeric(18,2) not null default 0,
  add column if not exists deposit_note      text,
  add column if not exists deposit_confirmed boolean not null default false;

comment on column public.orders.deposit_expected is
  'So tien coc Kinh doanh khai bao khi lap don — CHUA phai but toan. Ke toan xac nhan moi ghi so.';
comment on column public.orders.deposit_confirmed is
  'Ke toan da xac nhan nhan duoc tien coc va tao but toan tuong ung';

-- Ke toan xac nhan coc -> tao but toan dat coc trong mot buoc
create or replace function public.xac_nhan_tien_coc(
  p_order_id uuid,
  p_amount   numeric,
  p_method   text default 'Chuyển khoản',
  p_ref      text default null,
  p_date     date default current_date)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_role('accounting','management') then
    raise exception 'Chi Ke toan hoac Ban Giam doc moi duoc xac nhan tien coc';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'So tien coc phai lon hon 0';
  end if;

  insert into public.payments (order_id, payment_type, amount, payment_date,
                               method, reference_no, note, created_by)
  values (p_order_id, 'deposit', p_amount, coalesce(p_date, current_date),
          p_method, p_ref, 'Xac nhan tien coc khach dua khi dat hang', auth.uid())
  returning id into v_id;

  update public.orders set deposit_confirmed = true where id = p_order_id;
  return v_id;
end $$;

grant execute on function public.xac_nhan_tien_coc(uuid, numeric, text, text, date) to authenticated;

-- ---------- 2. THONG TIN TUNG DONG HANG ----------
alter table public.order_items
  add column if not exists delivery_date date,    -- ngay giao rieng cua mat hang nay
  add column if not exists image_url     text,    -- anh mau de San xuat nhin
  add column if not exists file_url      text,    -- link file thiet ke cua rieng dong nay
  add column if not exists file_name     text;

comment on column public.order_items.delivery_date is
  'Ngay giao rieng cua mat hang. De trong thi lay theo ngay giao chung cua don.';
comment on column public.order_items.image_url is
  'Anh mau — de trong bucket cong khai anh-mau de hien thi nhanh, khong can ky URL';

-- ---------- 3. BUCKET ANH MAU (CONG KHAI) ----------
-- Anh mau chi de nhin cho de hinh dung, khong phai file in goc.
-- De public de hien thi ngay trong bang, khong phai xin link co han moi lan.
insert into storage.buckets (id, name, public, file_size_limit)
values ('anh-mau', 'anh-mau', true, 2097152)      -- 2 MB / anh
on conflict (id) do update set public = true, file_size_limit = 2097152;

drop policy if exists anhmau_read on storage.objects;
create policy anhmau_read on storage.objects
  for select to public using (bucket_id = 'anh-mau');

drop policy if exists anhmau_write on storage.objects;
create policy anhmau_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'anh-mau' and public.is_role('sales','accounting','management'));

drop policy if exists anhmau_update on storage.objects;
create policy anhmau_update on storage.objects
  for update to authenticated
  using (bucket_id = 'anh-mau' and public.is_role('sales','accounting','management'));

drop policy if exists anhmau_delete on storage.objects;
create policy anhmau_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'anh-mau' and public.is_role('sales','accounting','management'));

-- ---------- 4. View cho San xuat: day du thong tin mot mat hang ----------
drop view if exists public.v_chi_tiet_san_xuat;
create view public.v_chi_tiet_san_xuat
with (security_invoker = on) as
select
  i.id, i.order_id, i.line_no,
  o.order_code, o.customer_name, o.status,
  i.item_code, i.item_name, i.spec,
  i.quantity, i.unit,
  coalesce(i.delivery_date, o.estimated_delivery_date) as ngay_giao,
  i.image_url, i.file_url, i.file_name,
  m.name  as chat_lieu,
  p.name  as gia_cong,
  t.name  as do_day,
  z.name  as kich_thuoc
from public.order_items i
join public.orders o on o.id = i.order_id
left join public.items it on it.item_code = i.item_code
left join public.item_materials   m on m.code = it.material_code
left join public.item_processes   p on p.code = it.process_code
left join public.item_thicknesses t on t.code = it.thickness_code
left join public.item_sizes       z on z.code = it.size_code;

comment on view public.v_chi_tiet_san_xuat is
  'Thong tin day du mot mat hang: chat lieu, do day, kich thuoc, so luong, ngay giao, anh, file';

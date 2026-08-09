-- ============================================================
-- 05_link_thiet_ke.sql
-- Chuyen cach dinh kem thiet ke Market: tu UPLOAD FILE -> LUU LINK
-- Ly do: file .cdr/.pdf kho in thuong 3-25MB, ~100MB/tuan
--        -> gói Supabase mien phi (1GB) chi chua duoc ~10 tuan.
--        File van nam tren OneDrive / Google Drive / o mang cua cong ty,
--        he thong chi luu duong dan + ten file.
-- Chay 1 lan trong SQL Editor (sau 01,02,03).
-- ============================================================

-- 1. Bang chua nhieu link cho 1 don hang (so luong khong gioi han)
create table if not exists public.order_files (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  line_no    integer not null default 1,
  file_name  text not null,                 -- vd: "25 - nhom 0.5 - 1t - 2k.pdf"
  file_url   text not null,                 -- link OneDrive / Drive / o mang
  note       text,                          -- vd: "ban in mat truoc"
  created_at timestamptz not null default now(),
  constraint chk_file_url check (file_url ~* '^(https?://|file://|\\\\)')
);
create index if not exists idx_order_files_order on public.order_files(order_id);

comment on table public.order_files is
  'Danh sach link file thiet ke Market cua don hang. File goc nam ngoai he thong.';

-- 2. Doi y nghia 2 cot cu tren bang orders (khong xoa de giu tuong thich)
--    design_file_path : luu LINK CHINH (link dau tien) - dung cho rang buoc bat buoc
--    design_file_name : ten hien thi cua link chinh
comment on column public.orders.design_file_path is
  'Link thiet ke chinh. Rang buoc chk_design_required van dua tren cot nay.';

-- 3. RLS: quyen theo don hang cha, giong het order_items
alter table public.order_files enable row level security;

drop policy if exists files_select on public.order_files;
create policy files_select on public.order_files
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

drop policy if exists files_insert on public.order_files;
create policy files_insert on public.order_files
  for insert to authenticated
  with check (exists (
    select 1 from public.orders o
    where o.id = order_id
      and (public.is_role('management')
           or (public.is_role('sales') and o.sales_id = auth.uid()
               and o.status in ('draft','pending_accounting','rejected')))
  ));

drop policy if exists files_update on public.order_files;
create policy files_update on public.order_files
  for update to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id
      and (public.is_role('management')
           or (public.is_role('sales') and o.sales_id = auth.uid()
               and o.status in ('draft','pending_accounting','rejected')))));

drop policy if exists files_delete on public.order_files;
create policy files_delete on public.order_files
  for delete to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id
      and (public.is_role('management')
           or (public.is_role('sales') and o.sales_id = auth.uid()
               and o.status in ('draft','pending_accounting','rejected')))));

-- 4. Chuyen du lieu cu (neu da co don dung Storage) sang bang moi
insert into public.order_files (order_id, line_no, file_name, file_url)
select id, 1, coalesce(design_file_name, 'File thiet ke'), design_file_path
from public.orders
where design_file_path is not null
  and design_file_path ~* '^https?://'
  and not exists (select 1 from public.order_files f where f.order_id = public.orders.id);

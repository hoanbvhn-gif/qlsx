-- ============================================================
-- 09_file_market.sql
-- Cho phep dinh kem thiet ke Market theo 2 kieu:
--   * 'link'   : dan duong dan Google Drive / OneDrive / o mang  (khong ton dung luong)
--   * 'upload' : tai file thang tu may tinh len Supabase Storage
-- Chay 1 lan trong SQL Editor (sau 08).
-- ============================================================

alter table public.order_files
  add column if not exists source       text   not null default 'link',
  add column if not exists storage_path text,
  add column if not exists file_size    bigint;

-- file_url khong con bat buoc (dong kieu 'upload' dung storage_path)
alter table public.order_files alter column file_url drop not null;

-- Bo rang buoc cu chi chap nhan URL
alter table public.order_files drop constraint if exists chk_file_url;

-- Rang buoc moi: kieu nao phai co du lieu cua kieu do
alter table public.order_files drop constraint if exists chk_file_source;
alter table public.order_files add constraint chk_file_source check (
  (source = 'link'   and file_url is not null and file_url ~* '^(https?://|file://|\\\\)')
  or
  (source = 'upload' and storage_path is not null)
);

comment on column public.order_files.source is
  'link = dan duong dan (khong ton dung luong) | upload = file nam trong Storage';
comment on column public.order_files.storage_path is
  'Duong dan trong bucket designs, vd: orders/<order_code>/<timestamp>_<ten_file>';

-- Du lieu cu deu la link
update public.order_files set source = 'link' where source is null;

-- ---------- Bucket designs ----------
-- 03_storage.sql da tao bucket va policy. Chay lai cho chac (idempotent).
insert into storage.buckets (id, name, public, file_size_limit)
values ('designs', 'designs', false, 26214400)   -- 25 MB / file
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists designs_read on storage.objects;
create policy designs_read on storage.objects
  for select to authenticated using (bucket_id = 'designs');

drop policy if exists designs_upload on storage.objects;
create policy designs_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'designs' and public.is_role('sales','accounting','management'));

drop policy if exists designs_update on storage.objects;
create policy designs_update on storage.objects
  for update to authenticated
  using (bucket_id = 'designs' and public.is_role('sales','accounting','management'));

drop policy if exists designs_delete on storage.objects;
create policy designs_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'designs' and public.is_role('sales','accounting','management'));

-- ---------- Theo doi dung luong da dung ----------
-- Goi tri mien phi Supabase Storage = 1 GB. Xem con lai bao nhieu:
create or replace view public.v_storage_usage
with (security_invoker = on) as
select
  count(*)                                              as so_file,
  coalesce(sum((metadata->>'size')::bigint), 0)         as bytes_da_dung,
  round(coalesce(sum((metadata->>'size')::bigint),0) / 1048576.0, 1) as mb_da_dung,
  round(100 * coalesce(sum((metadata->>'size')::bigint),0) / 1073741824.0, 1) as phan_tram_1gb
from storage.objects
where bucket_id = 'designs';

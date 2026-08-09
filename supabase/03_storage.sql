-- ============================================================
-- 03_storage.sql  |  Bucket luu file thiet ke Market
-- Truoc khi chay: Dashboard > Storage > New bucket
--   Name: designs   |  Public: OFF (private)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('designs', 'designs', false, 26214400)   -- 25 MB / file
on conflict (id) do nothing;

-- Duong dan file quy uoc: designs/<order_code>/<timestamp>_<ten_file>

drop policy if exists designs_read on storage.objects;
create policy designs_read on storage.objects
  for select to authenticated
  using (bucket_id = 'designs');   -- moi nhan vien da dang nhap deu xem duoc ban ve

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
  using (bucket_id = 'designs' and public.is_role('accounting','management'));

-- ============================================================
-- 08_quyen_danh_muc.sql
-- Mo quyen them KICH THUOC va DO DAY cho Ke toan.
-- ------------------------------------------------------------
-- Ly do phan chia:
--   * Kich thuoc / Do day : phat sinh lien tuc theo yeu cau khach hang
--                           -> Ke toan them duoc, khoi cho Giam doc.
--   * Chat lieu / Gia cong: la khung phan loai san pham, it thay doi
--                           -> giu nguyen chi Giam doc.
-- Chay 1 lan trong SQL Editor (sau 07).
-- ============================================================

-- ---------- KICH THUOC: Ke toan + Giam doc ----------
drop policy if exists item_sizes_write on public.item_sizes;

drop policy if exists item_sizes_insert on public.item_sizes;
create policy item_sizes_insert on public.item_sizes
  for insert to authenticated
  with check (public.is_role('management','accounting'));

drop policy if exists item_sizes_update on public.item_sizes;
create policy item_sizes_update on public.item_sizes
  for update to authenticated
  using (public.is_role('management','accounting'))
  with check (public.is_role('management','accounting'));

drop policy if exists item_sizes_delete on public.item_sizes;
create policy item_sizes_delete on public.item_sizes
  for delete to authenticated using (public.is_role('management'));

-- ---------- DO DAY: Ke toan + Giam doc ----------
drop policy if exists item_thicknesses_write on public.item_thicknesses;

drop policy if exists item_thicknesses_insert on public.item_thicknesses;
create policy item_thicknesses_insert on public.item_thicknesses
  for insert to authenticated
  with check (public.is_role('management','accounting'));

drop policy if exists item_thicknesses_update on public.item_thicknesses;
create policy item_thicknesses_update on public.item_thicknesses
  for update to authenticated
  using (public.is_role('management','accounting'))
  with check (public.is_role('management','accounting'));

drop policy if exists item_thicknesses_delete on public.item_thicknesses;
create policy item_thicknesses_delete on public.item_thicknesses
  for delete to authenticated using (public.is_role('management'));

-- Chat lieu / Gia cong giu nguyen policy cu (chi Giam doc) — khong dong toi.

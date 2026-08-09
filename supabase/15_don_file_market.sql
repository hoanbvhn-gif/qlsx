-- ============================================================
-- 15_don_file_market.sql
-- Tu dong don file Market khoi Storage khi don hang DA GIAO va DA THU DU TIEN.
-- ------------------------------------------------------------
-- Ly do: goi Supabase mien phi chi co 1GB Storage.
-- Voi ~100MB file/tuan, neu giu mai thi day sau ~10 tuan.
-- Chu ky mot don (thiet ke -> giao -> thu tien) khoang 3-4 tuan,
-- nen neu don xong la don file thi luong ton on dinh chi ~300-400MB.
--
-- QUAN TRONG: chi don file TAI LEN (source='upload').
-- Dong kieu 'link' khong dung dung luong he thong nen giu nguyen mai mai.
-- Dong du lieu van con trong bang de tra cuu lich su, chi mat file vat ly.
-- Chay 1 lan trong SQL Editor (sau 14).
-- ============================================================

alter table public.order_files
  add column if not exists file_deleted    boolean not null default false,
  add column if not exists file_deleted_at timestamptz;

comment on column public.order_files.file_deleted is
  'File vat ly da bi don khoi Storage sau khi don hang tat toan. Dong du lieu van giu de tra cuu.';

create index if not exists idx_files_deleted on public.order_files(file_deleted);

-- ---------- File du dieu kien don ----------
drop view if exists public.v_file_can_don;
create view public.v_file_can_don
with (security_invoker = on) as
select
  f.id, f.order_id, f.file_name, f.storage_path, f.file_size,
  o.order_code, o.customer_name, o.delivered_at, o.total_amount,
  (current_date - o.delivered_at::date) as so_ngay_ke_tu_giao
from public.order_files f
join public.orders o on o.id = f.order_id
where f.source = 'upload'
  and f.file_deleted = false
  and f.storage_path is not null
  and o.status = 'delivered'
  and o.is_settled = true;

comment on view public.v_file_can_don is
  'File tai len thuoc don DA GIAO va DA THU DU TIEN — co the don khoi Storage';

-- ---------- Thong ke dung luong ----------
drop view if exists public.v_dung_luong;
create view public.v_dung_luong
with (security_invoker = on) as
select
  coalesce(sum(f.file_size), 0)                                        as bytes_dang_dung,
  round(coalesce(sum(f.file_size), 0) / 1048576.0, 1)                  as mb_dang_dung,
  round(100 * coalesce(sum(f.file_size), 0) / 1073741824.0, 1)         as phan_tram_1gb,
  count(*)                                                             as so_file,
  coalesce(sum(f.file_size) filter (
    where exists (select 1 from public.orders o
                   where o.id = f.order_id and o.status = 'delivered' and o.is_settled)
  ), 0)                                                                as bytes_co_the_don,
  count(*) filter (
    where exists (select 1 from public.orders o
                   where o.id = f.order_id and o.status = 'delivered' and o.is_settled)
  )                                                                    as so_file_co_the_don
from public.order_files f
where f.source = 'upload' and f.file_deleted = false;

-- ---------- Ham danh dau da don (goi sau khi xoa file that su) ----------
create or replace function public.danh_dau_da_don(p_ids uuid[])
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_role('accounting','management') then
    raise exception 'Chi Ke toan hoac Ban Giam doc moi duoc don file';
  end if;

  update public.order_files
     set file_deleted = true,
         file_deleted_at = now(),
         storage_path = storage_path        -- giu duong dan cu de tra cuu
   where id = any(p_ids) and source = 'upload';

  get diagnostics n = row_count;

  insert into public.audit_log(table_name, action, actor_id, note)
  values ('order_files', 'DELETE', auth.uid(),
          'Don ' || n || ' file Market sau khi don hang tat toan');

  return n;
end $$;

grant execute on function public.danh_dau_da_don(uuid[]) to authenticated;

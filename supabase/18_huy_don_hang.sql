-- ============================================================
-- 18_huy_don_hang.sql
-- Cho phep HUY DON hoac TRA LAI KINH DOANH khi duyet nham / khach doi y.
-- ------------------------------------------------------------
-- Ai duoc lam:
--   * Ke toan, Ban Giam doc : huy don, tra lai Kinh doanh
--   * San xuat              : KHONG — chi cap nhat tien do san xuat
-- Don da huy khong bien mat, van nam trong he thong de tra cuu.
-- Chay 1 lan trong SQL Editor (sau 17).
-- ============================================================

alter table public.orders
  add column if not exists cancel_reason text,
  add column if not exists cancelled_at  timestamptz,
  add column if not exists cancelled_by  uuid references public.users(id) on delete set null;

-- Dong dau thoi diem huy
create or replace function public.trg_order_status_stamp()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'pending_accounting' then
      new.submitted_at := now();
    elsif new.status = 'approved' then
      new.approved_at := now();
      new.approved_by := auth.uid();
    elsif new.status = 'in_production' then
      new.production_started_at := coalesce(new.production_started_at, now());
    elsif new.status = 'completed' then
      new.completed_at := coalesce(new.completed_at, now());
    elsif new.status = 'delivered' then
      new.delivered_at := coalesce(new.delivered_at, now());
    elsif new.status = 'cancelled' then
      new.cancelled_at := now();
      new.cancelled_by := auth.uid();
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists tr_order_status on public.orders;
create trigger tr_order_status before update on public.orders
for each row execute function public.trg_order_status_stamp();

-- San xuat khong duoc huy don hoac tra lai Kinh doanh
create or replace function public.trg_guard_production_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.app_role() = 'production' then
    if new.total_amount is distinct from old.total_amount
       or new.paid_amount   is distinct from old.paid_amount
       or new.customer_id   is distinct from old.customer_id
       or new.sales_id      is distinct from old.sales_id then
      raise exception 'Bo phan San xuat khong duoc phep sua thong tin tien/khach hang';
    end if;
    if new.status in ('cancelled','rejected','draft','pending_accounting')
       and new.status is distinct from old.status then
      raise exception 'Bo phan San xuat khong duoc huy don hay tra don ve. Bao Ke toan hoac Ban Giam doc xu ly.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists tr_guard_production on public.orders;
create trigger tr_guard_production before update on public.orders
for each row execute function public.trg_guard_production_columns();

-- Ke toan / Giam doc duoc dua don ve moi trang thai (huy, tra lai)
drop policy if exists orders_update_accounting on public.orders;
create policy orders_update_accounting on public.orders
  for update to authenticated
  using (public.is_role('accounting'))
  with check (public.is_role('accounting'));

-- Don da huy van xem duoc o Bang san xuat de doi chieu
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select to authenticated
  using (
    public.is_role('management','accounting')
    or (public.is_role('sales')      and sales_id = auth.uid())
    or (public.is_role('production') and status in
         ('approved','in_production','completed','delivered','cancelled'))
  );

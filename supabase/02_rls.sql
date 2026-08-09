-- ============================================================
-- 02_rls.sql  |  Row Level Security theo vai tro
-- ============================================================

-- ---------- Helper: lay role cua user dang dang nhap ----------
-- security definer de tranh de quy RLS khi doc bang public.users
create or replace function public.app_role()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid() and is_active
$$;

create or replace function public.is_role(variadic p_roles text[])
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role()::text = any(p_roles), false)
$$;

grant execute on function public.app_role() to authenticated;
grant execute on function public.is_role(text[]) to authenticated;
grant execute on function public.next_order_code(date) to authenticated;

-- ---------- Bat RLS ----------
alter table public.users          enable row level security;
alter table public.customers      enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.payments       enable row level security;
alter table public.order_counters enable row level security;

-- ============================================================
-- USERS
-- ============================================================
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select to authenticated
  using (true);   -- moi nhan vien deu can doc ten dong nghiep de hien thi

drop policy if exists users_insert on public.users;
create policy users_insert on public.users
  for insert to authenticated
  with check (public.is_role('accounting','management'));  -- Ke toan tao ho so NV

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.app_role());  -- khong tu nang quyen

drop policy if exists users_update_admin on public.users;
create policy users_update_admin on public.users
  for update to authenticated
  using (public.is_role('management'))          -- CHI Giam doc doi vai tro
  with check (public.is_role('management'));

-- Ke toan duoc sua thong tin ho so (ten, SDT, ma NV, khoa/mo tai khoan)
-- nhung KHONG duoc doi cot role -> chan bang trigger ben duoi (tranh subquery de quy RLS)
drop policy if exists users_update_accounting on public.users;
create policy users_update_accounting on public.users
  for update to authenticated
  using (public.is_role('accounting'))
  with check (public.is_role('accounting'));

create or replace function public.trg_guard_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and public.app_role() <> 'management' then
    raise exception 'Chi Ban Giam doc moi duoc phep thay doi vai tro tai khoan';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists tr_guard_role on public.users;
create trigger tr_guard_role before update on public.users
for each row execute function public.trg_guard_role_change();

drop policy if exists users_delete on public.users;
create policy users_delete on public.users
  for delete to authenticated using (public.is_role('management'));

-- ============================================================
-- CUSTOMERS
-- ============================================================
drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers
  for select to authenticated using (true);

drop policy if exists customers_write on public.customers;
create policy customers_write on public.customers
  for insert to authenticated
  with check (public.is_role('sales','accounting','management'));

drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers
  for update to authenticated
  using (public.is_role('sales','accounting','management'))
  with check (public.is_role('sales','accounting','management'));

drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers
  for delete to authenticated using (public.is_role('management','accounting'));

-- ============================================================
-- ORDERS
-- ============================================================
-- SELECT: GD/KT xem tat ca; Sales xem don cua minh; SX chi xem don da duyet
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select to authenticated
  using (
    public.is_role('management','accounting')
    or (public.is_role('sales')      and sales_id = auth.uid())
    or (public.is_role('production') and status in ('approved','in_production','completed','delivered'))
  );

-- INSERT: chi Sales (tao don cho chinh minh) hoac Giam doc
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert to authenticated
  with check (
    (public.is_role('sales') and sales_id = auth.uid() and status in ('draft','pending_accounting'))
    or public.is_role('management')
  );

-- UPDATE Sales: chi sua don cua minh khi con o trang thai soan/tra lai/cho duyet
drop policy if exists orders_update_sales on public.orders;
create policy orders_update_sales on public.orders
  for update to authenticated
  using (public.is_role('sales') and sales_id = auth.uid()
         and status in ('draft','pending_accounting','rejected'))
  with check (public.is_role('sales') and sales_id = auth.uid()
         and status in ('draft','pending_accounting','rejected','cancelled'));

-- UPDATE Ke toan: duyet don / tra lai / xac nhan tat toan
drop policy if exists orders_update_accounting on public.orders;
create policy orders_update_accounting on public.orders
  for update to authenticated
  using (public.is_role('accounting'))
  with check (public.is_role('accounting'));

-- UPDATE San xuat: chi don da duyet, va chi duoc chuyen sang trang thai san xuat
drop policy if exists orders_update_production on public.orders;
create policy orders_update_production on public.orders
  for update to authenticated
  using (public.is_role('production') and status in ('approved','in_production','completed'))
  with check (public.is_role('production') and status in ('approved','in_production','completed','delivered'));

drop policy if exists orders_update_management on public.orders;
create policy orders_update_management on public.orders
  for update to authenticated
  using (public.is_role('management')) with check (public.is_role('management'));

drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders
  for delete to authenticated
  using (public.is_role('management')
         or (public.is_role('sales') and sales_id = auth.uid() and status = 'draft'));

-- Chan San xuat sua gia / so luong: khoa cot bang trigger
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
  end if;
  return new;
end $$;

drop trigger if exists tr_guard_production on public.orders;
create trigger tr_guard_production before update on public.orders
for each row execute function public.trg_guard_production_columns();

-- ============================================================
-- ORDER_ITEMS  (theo quyen cua don cha)
-- ============================================================
drop policy if exists items_select on public.order_items;
create policy items_select on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

drop policy if exists items_write on public.order_items;
create policy items_write on public.order_items
  for insert to authenticated
  with check (exists (
    select 1 from public.orders o
    where o.id = order_id
      and (public.is_role('management')
           or (public.is_role('sales') and o.sales_id = auth.uid()
               and o.status in ('draft','pending_accounting','rejected')))
  ));

drop policy if exists items_update on public.order_items;
create policy items_update on public.order_items
  for update to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id
      and (public.is_role('management')
           or (public.is_role('sales') and o.sales_id = auth.uid()
               and o.status in ('draft','pending_accounting','rejected')))));

drop policy if exists items_delete on public.order_items;
create policy items_delete on public.order_items
  for delete to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id
      and (public.is_role('management')
           or (public.is_role('sales') and o.sales_id = auth.uid()
               and o.status in ('draft','pending_accounting','rejected')))));

-- ============================================================
-- PAYMENTS  (chi Ke toan / Giam doc duoc ghi; Sales chi doc don cua minh)
-- ============================================================
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select to authenticated
  using (
    public.is_role('accounting','management')
    or exists (select 1 from public.orders o
               where o.id = order_id and public.is_role('sales') and o.sales_id = auth.uid())
  );

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
  for insert to authenticated
  with check (public.is_role('accounting','management'));

drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments
  for update to authenticated
  using (public.is_role('accounting','management'))
  with check (public.is_role('accounting','management'));

drop policy if exists payments_delete on public.payments;
create policy payments_delete on public.payments
  for delete to authenticated using (public.is_role('accounting','management'));

-- ============================================================
-- ORDER_COUNTERS: khong truy cap truc tiep, chi qua function security definer
-- ============================================================
drop policy if exists counters_none on public.order_counters;
create policy counters_none on public.order_counters
  for select to authenticated using (false);

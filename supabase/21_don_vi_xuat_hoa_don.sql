-- ============================================================
-- 21_don_vi_xuat_hoa_don.sql
-- Hai phap nhan xuat hoa don: CONG TY va HO KINH DOANH CA THE.
-- ------------------------------------------------------------
-- Hai don vi co MST, dia chi, che do thue khac nhau nen phai tach so
-- ngay tu khi lap don, khong the gop roi chia sau.
--   * Kinh doanh chon khi lap don
--   * Ke toan / Giam doc doi duoc bat cu luc nao
--   * Bao cao tach rieng tung don vi
-- Chay 1 lan trong SQL Editor (sau 20).
-- ============================================================

-- ---------- 1. Danh muc don vi phat hanh ----------
create table if not exists public.issuing_entities (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,          -- CT | HKD
  name          text not null,                 -- ten day du in tren hoa don
  short_name    text not null,                 -- ten ngan hien tren giao dien
  tax_code      text,
  address       text,
  phone         text,
  bank_account  text,
  default_vat_rate numeric(5,2) not null default 8,   -- thue suat mac dinh khi lap don
  note          text,
  is_default    boolean not null default false,
  is_active     boolean not null default true,
  sort_order    int not null default 100,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.issuing_entities is
  'Don vi phat hanh hoa don — Cong ty va Ho kinh doanh ca the';
comment on column public.issuing_entities.default_vat_rate is
  'Thue suat goi y khi lap don cho don vi nay. Ho kinh doanh thuong khong co VAT khau tru -> de 0.';

-- Chi mot don vi duoc lam mac dinh
create unique index if not exists uq_entity_default
  on public.issuing_entities (is_default) where is_default;

-- ---------- 2. Gan vao don hang ----------
alter table public.orders
  add column if not exists entity_id uuid references public.issuing_entities(id) on delete restrict;

create index if not exists idx_orders_entity on public.orders(entity_id);

-- ---------- 3. Nap 2 don vi ----------
insert into public.issuing_entities
  (code, name, short_name, default_vat_rate, is_default, sort_order)
values
  ('CT',  'Công ty',                'Công ty',       8, true,  10),
  ('HKD', 'Hộ kinh doanh cá thể',   'Hộ kinh doanh', 0, false, 20)
on conflict (code) do nothing;

-- Don cu chua co don vi -> gan ve don vi mac dinh
update public.orders
   set entity_id = (select id from public.issuing_entities where is_default limit 1)
 where entity_id is null;

-- ---------- 4. Don moi tu lay don vi mac dinh neu chua chon ----------
create or replace function public.trg_order_default_entity()
returns trigger language plpgsql as $$
begin
  if new.entity_id is null then
    new.entity_id := (select id from public.issuing_entities where is_default and is_active limit 1);
  end if;
  return new;
end $$;

drop trigger if exists tr_order_default_entity on public.orders;
create trigger tr_order_default_entity before insert on public.orders
for each row execute function public.trg_order_default_entity();

-- ---------- 5. Ghi nhat ky khi doi don vi ----------
create or replace function public.trg_audit_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cu text; v_moi text;
begin
  if tg_op = 'DELETE' then
    insert into public.audit_log(table_name, record_id, action, actor_id, old_data, note)
    values ('orders', old.id, 'DELETE', auth.uid(), to_jsonb(old),
            'XOA don hang ' || old.order_code || ' — ' || coalesce(old.customer_name, '')
            || ' — ' || to_char(old.total_amount, 'FM999,999,999,999') || ' d — '
            || coalesce(old.delete_reason, 'khong ghi ly do'));
    return old;

  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into public.audit_log(table_name, record_id, action, actor_id, old_data, new_data, note)
      values ('orders', new.id, 'UPDATE', auth.uid(),
              jsonb_build_object('status', old.status, 'order_code', old.order_code),
              jsonb_build_object('status', new.status, 'order_code', new.order_code),
              'Don ' || new.order_code || ': ' || old.status || ' -> ' || new.status);
    end if;

    if new.entity_id is distinct from old.entity_id then
      select short_name into v_cu  from public.issuing_entities where id = old.entity_id;
      select short_name into v_moi from public.issuing_entities where id = new.entity_id;
      insert into public.audit_log(table_name, record_id, action, actor_id, note)
      values ('orders', new.id, 'UPDATE', auth.uid(),
              'Don ' || new.order_code || ': doi don vi xuat hoa don '
              || coalesce(v_cu, '?') || ' -> ' || coalesce(v_moi, '?'));
    end if;
  end if;
  return new;
end $$;

-- ---------- 6. RLS ----------
alter table public.issuing_entities enable row level security;

drop policy if exists entities_select on public.issuing_entities;
create policy entities_select on public.issuing_entities
  for select to authenticated using (true);

drop policy if exists entities_write on public.issuing_entities;
create policy entities_write on public.issuing_entities
  for all to authenticated
  using (public.is_role('management','accounting'))
  with check (public.is_role('management','accounting'));

-- ---------- 7. Bo sung don vi vao cac view bao cao ----------
drop view if exists public.v_tat_ca_don_hang;
create view public.v_tat_ca_don_hang
with (security_invoker = on) as
select
  o.id as order_id, o.order_code, o.order_date, o.status,
  o.customer_id, o.customer_name, c.customer_code, c.tax_code,
  o.customer_address, o.customer_phone, o.customer_tax_code,
  o.sales_id, u.full_name as sales_name,
  o.entity_id, e.code as entity_code, e.short_name as entity_name,
  o.subtotal, o.vat_amount, o.total_amount, o.paid_amount, o.debt_amount, o.is_settled,
  o.deposit_expected, o.deposit_confirmed,
  o.estimated_delivery_date, o.approved_at, o.completed_at, o.delivered_at, o.created_at,
  (select count(*) from public.order_items i where i.order_id = o.id) as so_dong_hang,
  (select count(*) from public.order_files f where f.order_id = o.id) as so_file_thiet_ke,
  (select count(*) from public.payments  p where p.order_id = o.id and not p.voided) as so_but_toan
from public.orders o
left join public.customers        c on c.id = o.customer_id
left join public.users            u on u.id = o.sales_id
left join public.issuing_entities e on e.id = o.entity_id;

-- Tong hop theo tung don vi phat hanh
drop view if exists public.v_theo_don_vi;
create view public.v_theo_don_vi
with (security_invoker = on) as
select
  e.id as entity_id, e.code, e.short_name, e.name, e.tax_code,
  count(o.id) filter (where o.status not in ('draft','cancelled'))                     as so_don,
  coalesce(sum(o.subtotal)     filter (where o.status not in ('draft','cancelled')),0) as tien_hang,
  coalesce(sum(o.vat_amount)   filter (where o.status not in ('draft','cancelled')),0) as tien_thue,
  coalesce(sum(o.total_amount) filter (where o.status not in ('draft','cancelled')),0) as doanh_thu,
  coalesce(sum(o.paid_amount)  filter (where o.status not in ('draft','cancelled')),0) as da_thu,
  coalesce(sum(o.debt_amount)  filter (where o.status = 'delivered'),0)                as cong_no,
  coalesce(sum(o.total_amount) filter (where o.status in
    ('pending_accounting','approved','in_production','completed')),0)                  as dang_chay,
  min(o.order_date) as don_dau_tien,
  max(o.order_date) as don_gan_nhat
from public.issuing_entities e
left join public.orders o on o.entity_id = e.id
group by e.id, e.code, e.short_name, e.name, e.tax_code, e.sort_order
order by e.sort_order;

comment on view public.v_theo_don_vi is
  'Doanh thu, thue, cong no tach rieng tung don vi phat hanh hoa don';

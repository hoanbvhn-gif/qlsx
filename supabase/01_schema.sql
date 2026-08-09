-- ============================================================
-- 01_schema.sql  |  QLSX - Quan ly Don hang & Cong no
-- Chay trong Supabase Dashboard > SQL Editor (chay 1 lan, theo thu tu 01 -> 04)
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- ENUM ----------
do $$ begin
  create type public.user_role as enum ('management','accounting','sales','production');
exception when duplicate_object then null; end $$;

do $$ begin
  -- draft            : Sales dang soan
  -- pending_accounting: da gui Ke toan cho duyet
  -- rejected         : Ke toan tra lai
  -- approved         : Ke toan duyet -> vao hang doi San xuat
  -- in_production    : San xuat dang lam
  -- completed        : San xuat hoan thanh
  -- delivered        : da giao khach
  -- cancelled        : huy
  create type public.order_status as enum
    ('draft','pending_accounting','rejected','approved','in_production','completed','delivered','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_type as enum ('deposit','partial','final','refund');
exception when duplicate_object then null; end $$;

-- ---------- 1. USERS (ho so nhan vien, 1-1 voi auth.users) ----------
create table if not exists public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique not null,
  email           text unique not null,
  full_name       text not null,
  employee_code   text unique,
  phone           text,
  role            public.user_role not null default 'sales',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.users is 'Ho so nhan vien + phan quyen. id trung voi auth.users.id';

-- ---------- 2. CUSTOMERS ----------
create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  customer_code text unique not null,
  name          text not null,
  tax_code      text,
  address       text,
  phone         text,
  email         text,
  note          text,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_customers_name on public.customers using gin (to_tsvector('simple', name));
create index if not exists idx_customers_code on public.customers(customer_code);

-- ---------- 3. ORDERS ----------
create table if not exists public.orders (
  id                   uuid primary key default gen_random_uuid(),
  order_code           text unique not null,          -- STT + DD + MM + YYYY  vd 0108082026
  order_date           date not null default current_date,

  customer_id          uuid references public.customers(id) on delete restrict,
  -- snapshot thong tin khach tai thoi diem lap don (phuc vu doi chieu hoa don)
  customer_name        text not null,
  customer_tax_code    text,
  customer_address     text,
  customer_phone       text,

  sales_id             uuid not null references public.users(id) on delete restrict,
  status               public.order_status not null default 'draft',

  -- RANG BUOC BAT BUOC: phai co file thiet ke Market moi duoc gui Ke toan
  design_file_path     text,
  design_file_name     text,
  design_uploaded_at   timestamptz,

  subtotal             numeric(18,2) not null default 0,   -- tong tien truoc thue (trigger tinh)
  vat_amount           numeric(18,2) not null default 0,   -- tong thue GTGT   (trigger tinh)
  total_amount         numeric(18,2) not null default 0,   -- tong thanh toan  (trigger tinh)
  paid_amount          numeric(18,2) not null default 0,   -- da thu           (trigger tinh)
  debt_amount          numeric(18,2) generated always as (total_amount - paid_amount) stored,
  is_settled           boolean not null default false,     -- da thanh toan du

  note                 text,
  reject_reason        text,

  submitted_at         timestamptz,
  approved_at          timestamptz,
  approved_by          uuid references public.users(id) on delete set null,
  production_started_at timestamptz,
  estimated_delivery_date date,
  completed_at         timestamptz,
  delivered_at         timestamptz,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint chk_design_required check (
    status in ('draft','cancelled','rejected') or design_file_path is not null
  )
);
create index if not exists idx_orders_status   on public.orders(status);
create index if not exists idx_orders_sales    on public.orders(sales_id);
create index if not exists idx_orders_customer on public.orders(customer_id);
create index if not exists idx_orders_date     on public.orders(order_date desc);

-- ---------- 4. ORDER_ITEMS ----------
create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  line_no     integer not null default 1,
  item_code   text,
  item_name   text not null,
  spec        text,
  quantity    numeric(18,3) not null default 0 check (quantity >= 0),
  unit        text default 'Cai',
  unit_price  numeric(18,2) not null default 0 check (unit_price >= 0),
  vat_rate    numeric(5,2)  not null default 8 check (vat_rate >= 0 and vat_rate <= 100),
  line_amount numeric(18,2) generated always as (round(quantity * unit_price, 2)) stored,
  line_vat    numeric(18,2) generated always as (round(quantity * unit_price * vat_rate / 100, 2)) stored,
  line_total  numeric(18,2) generated always as (round(quantity * unit_price * (1 + vat_rate / 100), 2)) stored,
  created_at  timestamptz not null default now()
);
create index if not exists idx_items_order on public.order_items(order_id);

-- ---------- 5. PAYMENTS ----------
create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  payment_type  public.payment_type not null default 'deposit',
  amount        numeric(18,2) not null check (amount <> 0),
  payment_date  date not null default current_date,
  method        text default 'Chuyen khoan',   -- Tien mat / Chuyen khoan / Bu tru
  reference_no  text,                          -- so UNC / phieu thu
  note          text,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_payments_order on public.payments(order_id);
create index if not exists idx_payments_date  on public.payments(payment_date desc);

-- ---------- 6. BO DEM SINH MA DON HANG (an toan concurrency) ----------
create table if not exists public.order_counters (
  counter_date date primary key,
  last_seq     integer not null default 0
);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Sinh ma don: [STT 2 chu so][DD][MM][YYYY]  -> 0108082026
create or replace function public.next_order_code(p_date date default current_date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_seq integer;
begin
  insert into public.order_counters(counter_date, last_seq)
  values (p_date, 1)
  on conflict (counter_date) do update set last_seq = public.order_counters.last_seq + 1
  returning last_seq into v_seq;

  return lpad(v_seq::text, 2, '0') || to_char(p_date, 'DDMMYYYY');
end $$;

-- Tinh lai tong tien don hang tu order_items
create or replace function public.recalc_order_totals(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_sub numeric(18,2); v_vat numeric(18,2); v_paid numeric(18,2); v_total numeric(18,2);
begin
  select coalesce(sum(line_amount),0), coalesce(sum(line_vat),0)
    into v_sub, v_vat from public.order_items where order_id = p_order;

  select coalesce(sum(amount),0) into v_paid from public.payments where order_id = p_order;

  v_total := v_sub + v_vat;

  update public.orders
     set subtotal     = v_sub,
         vat_amount   = v_vat,
         total_amount = v_total,
         paid_amount  = v_paid,
         is_settled   = (v_total > 0 and v_paid >= v_total),
         updated_at   = now()
   where id = p_order;
end $$;

create or replace function public.trg_recalc_from_items()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalc_order_totals(coalesce(new.order_id, old.order_id));
  return null;
end $$;

drop trigger if exists tr_items_recalc on public.order_items;
create trigger tr_items_recalc
after insert or update or delete on public.order_items
for each row execute function public.trg_recalc_from_items();

drop trigger if exists tr_payments_recalc on public.payments;
create trigger tr_payments_recalc
after insert or update or delete on public.payments
for each row execute function public.trg_recalc_from_items();

-- Tu dong dong dau moc thoi gian theo trang thai + chan gui don khi thieu file Market
create or replace function public.trg_order_status_stamp()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'pending_accounting' then
      if new.design_file_path is null then
        raise exception 'Don hang phai co file thiet ke Market truoc khi gui Ke toan duyet';
      end if;
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
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists tr_order_status on public.orders;
create trigger tr_order_status before update on public.orders
for each row execute function public.trg_order_status_stamp();

-- Tu tao ma don neu client khong truyen
create or replace function public.trg_order_code()
returns trigger language plpgsql as $$
begin
  if new.order_code is null or new.order_code = '' then
    new.order_code := public.next_order_code(coalesce(new.order_date, current_date));
  end if;
  return new;
end $$;

drop trigger if exists tr_order_code on public.orders;
create trigger tr_order_code before insert on public.orders
for each row execute function public.trg_order_code();

-- Tu tao ho so public.users khi Ke toan tao tai khoan tren Supabase Auth
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, username, email, full_name, role, employee_code, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'sales'),
    new.raw_user_meta_data->>'employee_code',
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists tr_auth_user_created on auth.users;
create trigger tr_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- ============================================================
-- VIEW BAO CAO
-- ============================================================
create or replace view public.v_customer_debt
with (security_invoker = on) as
select
  c.id as customer_id,
  c.customer_code,
  c.name as customer_name,
  c.tax_code,
  c.phone,
  count(o.id)                       as total_orders,
  coalesce(sum(o.total_amount),0)   as total_amount,
  coalesce(sum(o.paid_amount),0)    as paid_amount,
  coalesce(sum(o.debt_amount),0)    as debt_amount,
  max(o.order_date)                 as last_order_date
from public.customers c
left join public.orders o
  on o.customer_id = c.id and o.status not in ('draft','cancelled')
group by c.id, c.customer_code, c.name, c.tax_code, c.phone;

create or replace view public.v_sales_performance
with (security_invoker = on) as
select
  u.id                                    as sales_id,
  u.full_name                             as sales_name,
  date_trunc('month', o.order_date)::date as month,
  extract(quarter from o.order_date)::int as quarter,
  extract(year   from o.order_date)::int  as year,
  count(o.id)                     as order_count,
  coalesce(sum(o.total_amount),0) as revenue,
  coalesce(sum(o.paid_amount),0)  as collected,
  coalesce(sum(o.debt_amount),0)  as outstanding
from public.users u
join public.orders o on o.sales_id = u.id and o.status not in ('draft','cancelled')
group by 1, 2, 3, 4, 5;

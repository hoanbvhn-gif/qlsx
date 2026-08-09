-- ============================================================
-- 12_dieu_chinh_thu_tien.sql
-- Quy trinh DIEU CHINH BUT TOAN THU TIEN co duyet.
-- ------------------------------------------------------------
-- Nguyen tac ke toan: so da thu khong ai sua thang, khong xoa but toan.
--   * Ke toan phat hien sai -> tao YEU CAU dieu chinh (sua / huy) kem ly do
--   * So lieu GIU NGUYEN cho den khi Ban Giam doc duyet
--   * Duyet xong he thong moi ap dung, cong no tu tinh lai
--   * But toan huy khong bi xoa: ghi so tien 0 va danh dau "da huy"
--     -> giu nguyen dau vet ai ghi, ai xin sua, ai duyet, luc nao
-- Chay 1 lan trong SQL Editor (sau 11).
-- ============================================================

do $$ begin
  create type public.amendment_kind   as enum ('edit','void');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.amendment_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

-- But toan bi huy: giu dong lai, so tien ve 0
alter table public.payments
  add column if not exists voided        boolean not null default false,
  add column if not exists voided_reason text;

-- ============================================================
-- 1. BANG YEU CAU DIEU CHINH
-- ============================================================
create table if not exists public.payment_amendments (
  id          uuid primary key default gen_random_uuid(),
  payment_id  uuid not null references public.payments(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,   -- chup lai de bao cao
  kind        public.amendment_kind not null default 'edit',

  -- Anh chup gia tri CU tai thoi diem xin sua
  old_amount        numeric(18,2),
  old_payment_date  date,
  old_payment_type  public.payment_type,
  old_method        text,
  old_reference_no  text,
  old_transfer_note text,
  old_note          text,

  -- Gia tri MOI de nghi (kind = 'void' thi bo trong)
  new_amount        numeric(18,2),
  new_payment_date  date,
  new_payment_type  public.payment_type,
  new_method        text,
  new_reference_no  text,
  new_transfer_note text,
  new_note          text,

  reason        text not null,
  status        public.amendment_status not null default 'pending',
  decision_note text,

  requested_by uuid references public.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_by   uuid references public.users(id) on delete set null,
  decided_at   timestamptz
);

create index if not exists idx_amend_payment on public.payment_amendments(payment_id);
create index if not exists idx_amend_status  on public.payment_amendments(status);

-- Moi but toan chi co 1 yeu cau dang cho duyet
create unique index if not exists uq_amend_pending
  on public.payment_amendments(payment_id) where status = 'pending';

comment on table public.payment_amendments is
  'Yeu cau dieu chinh but toan thu tien — chi co hieu luc sau khi Ban Giam doc duyet';

-- ============================================================
-- 2. KHOA QUYEN SUA THANG BUT TOAN
-- ============================================================
-- Ke toan CHI duoc doi cot reconciled (danh dau doi chieu sao ke).
create or replace function public.trg_guard_payment_edit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.app_role() = 'management' then
    return new;
  end if;

  if new.amount        is distinct from old.amount
  or new.payment_date  is distinct from old.payment_date
  or new.payment_type  is distinct from old.payment_type
  or new.method        is distinct from old.method
  or new.reference_no  is distinct from old.reference_no
  or new.transfer_note is distinct from old.transfer_note
  or new.bank_account  is distinct from old.bank_account
  or new.note          is distinct from old.note
  or new.order_id      is distinct from old.order_id
  or new.voided        is distinct from old.voided then
    raise exception 'Khong duoc sua truc tiep but toan thu tien. Hay tao yeu cau dieu chinh de Ban Giam doc duyet.';
  end if;

  return new;
end $$;

drop trigger if exists tr_guard_payment_edit on public.payments;
create trigger tr_guard_payment_edit before update on public.payments
for each row execute function public.trg_guard_payment_edit();

-- Khong ai xoa but toan (ke ca Giam doc) — huy thi dung yeu cau 'void'
drop policy if exists payments_delete on public.payments;
create policy payments_delete on public.payments
  for delete to authenticated using (false);

-- ============================================================
-- 3. TU CHUP GIA TRI CU KHI TAO YEU CAU
-- ============================================================
create or replace function public.trg_snapshot_amendment()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.payments where id = new.payment_id;
  if not found then
    raise exception 'Khong tim thay but toan can dieu chinh';
  end if;
  if p.voided then
    raise exception 'But toan nay da bi huy truoc do';
  end if;

  new.order_id          := p.order_id;
  new.old_amount        := p.amount;
  new.old_payment_date  := p.payment_date;
  new.old_payment_type  := p.payment_type;
  new.old_method        := p.method;
  new.old_reference_no  := p.reference_no;
  new.old_transfer_note := p.transfer_note;
  new.old_note          := p.note;
  new.requested_by      := auth.uid();
  new.requested_at      := now();
  new.status            := 'pending';
  new.decided_by        := null;
  new.decided_at        := null;
  return new;
end $$;

drop trigger if exists tr_snapshot_amendment on public.payment_amendments;
create trigger tr_snapshot_amendment before insert on public.payment_amendments
for each row execute function public.trg_snapshot_amendment();

-- ============================================================
-- 4. AP DUNG KHI GIAM DOC DUYET
-- ============================================================
create or replace function public.trg_apply_amendment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if public.app_role() <> 'management' then
    raise exception 'Chi Ban Giam doc moi duoc duyet hoac tu choi yeu cau dieu chinh';
  end if;

  new.decided_at := now();
  new.decided_by := auth.uid();

  if new.status = 'approved' then
    if new.kind = 'void' then
      -- Khong xoa: dua so tien ve 0 va danh dau da huy -> cong no tu tinh lai
      update public.payments set
        amount        = 0,
        voided        = true,
        voided_reason = new.reason,
        reconciled    = false
      where id = new.payment_id;
    else
      update public.payments set
        amount        = coalesce(new.new_amount, amount),
        payment_date  = coalesce(new.new_payment_date, payment_date),
        payment_type  = coalesce(new.new_payment_type, payment_type),
        method        = coalesce(new.new_method, method),
        reference_no  = new.new_reference_no,
        transfer_note = new.new_transfer_note,
        note          = new.new_note,
        reconciled    = false          -- so lieu doi -> phai doi chieu lai
      where id = new.payment_id;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists tr_apply_amendment on public.payment_amendments;
create trigger tr_apply_amendment before update on public.payment_amendments
for each row execute function public.trg_apply_amendment();

-- Bo rang buoc amount <> 0 (but toan huy co so tien 0)
alter table public.payments drop constraint if exists payments_amount_check;

-- ============================================================
-- 5. RLS
-- ============================================================
alter table public.payment_amendments enable row level security;

drop policy if exists amend_select on public.payment_amendments;
create policy amend_select on public.payment_amendments
  for select to authenticated
  using (public.is_role('accounting','management'));

drop policy if exists amend_insert on public.payment_amendments;
create policy amend_insert on public.payment_amendments
  for insert to authenticated
  with check (public.is_role('accounting','management'));

drop policy if exists amend_update on public.payment_amendments;
create policy amend_update on public.payment_amendments
  for update to authenticated
  using (public.is_role('management'))
  with check (public.is_role('management'));

drop policy if exists amend_delete on public.payment_amendments;
create policy amend_delete on public.payment_amendments
  for delete to authenticated using (false);

-- ============================================================
-- 6. VIEW cho man hinh duyet
-- ============================================================
drop view if exists public.v_payment_amendments;
create view public.v_payment_amendments
with (security_invoker = on) as
select
  a.*,
  o.order_code,
  o.customer_name,
  p.voided        as payment_voided,
  ru.full_name    as nguoi_yeu_cau,
  du.full_name    as nguoi_duyet
from public.payment_amendments a
join public.payments p on p.id = a.payment_id
left join public.orders o on o.id = a.order_id
left join public.users ru on ru.id = a.requested_by
left join public.users du on du.id = a.decided_by;

-- Bo sung cot vao so thu tien.
-- Phai DROP truoc: CREATE OR REPLACE VIEW khong doi duoc thu tu / ten cot.
drop view if exists public.v_payment_ledger;
create view public.v_payment_ledger
with (security_invoker = on) as
select
  p.id, p.payment_date, p.created_at,
  o.order_code, o.id as order_id, o.customer_name,
  c.customer_code, c.tax_code,
  s.full_name as sales_name,
  p.payment_type, p.amount, p.method, p.bank_account,
  p.reference_no, p.transfer_note, p.note,
  p.reconciled, p.reconciled_at,
  p.voided, p.voided_reason,
  u.full_name as nguoi_ghi,
  o.total_amount as order_total, o.paid_amount as order_paid, o.debt_amount as order_debt,
  exists (select 1 from public.payment_amendments a
           where a.payment_id = p.id and a.status = 'pending') as co_yeu_cau_sua
from public.payments p
join public.orders    o on o.id = p.order_id
left join public.customers c on c.id = o.customer_id
left join public.users     u on u.id = p.created_by
left join public.users     s on s.id = o.sales_id;

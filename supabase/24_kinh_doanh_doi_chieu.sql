-- ============================================================
-- 24_kinh_doanh_doi_chieu.sql
-- Kinh doanh doi chieu tien ve. Mot khoan tien chia duoc cho nhieu don.
-- ------------------------------------------------------------
-- Nguyen tac ke toan giu nguyen:
--   * Kinh doanh nam ro don cua minh -> cho ho GAN khoan tien ve vao don
--   * But toan kinh doanh ghi o trang thai CHUA XAC NHAN -> chua vao cong no
--   * Ke toan bam xac nhan (1 cham) -> moi hach toan vao paid_amount
--   => Van tach bach nguoi ghi / nguoi duyet, nhung viec doi chieu do
--      nguoi nam ro don hang lam, ke toan chi kiem tra lai.
--
-- Kinh doanh CHI thay TIEN VE. Cot phat sinh no va so du tai khoan
-- khong nam trong bat ky view nao ho doc duoc.
--
-- Mot khoan tien ve co the tra cho NHIEU don, mot don co the nhan
-- NHIEU lan chuyen. He thong theo doi so con lai chua phan bo cua
-- tung khoan, het tien moi bien mat khoi o tim kiem.
--
-- Chay 1 lan trong SQL Editor (sau 23).
-- ============================================================

-- ============================================================
-- 1. TRANG THAI XAC NHAN CUA BUT TOAN
-- ============================================================
alter table public.payments
  add column if not exists confirmed    boolean not null default true,
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid references public.users(id) on delete set null;

comment on column public.payments.confirmed is
  'false = kinh doanh vua ghi, cho ke toan xac nhan. Chua tinh vao cong no.';

create index if not exists idx_payments_cho_xac_nhan
  on public.payments(confirmed) where not confirmed;

-- Cac but toan cu deu coi nhu da xac nhan
update public.payments
   set confirmed = true,
       confirmed_at = coalesce(confirmed_at, created_at)
 where confirmed is not true;

-- Cot theo doi so tien dang cho xac nhan cua tung don
alter table public.orders
  add column if not exists pending_amount numeric(18,2) not null default 0;

comment on column public.orders.pending_amount is
  'Tien kinh doanh bao da ve nhung ke toan chua xac nhan. Chua tru vao cong no.';

-- ============================================================
-- 2. CONG NO CHI TINH THEO BUT TOAN DA XAC NHAN
-- ============================================================
create or replace function public.recalc_order_totals(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub numeric(18,2); v_vat numeric(18,2);
  v_paid numeric(18,2); v_pending numeric(18,2); v_total numeric(18,2);
begin
  select coalesce(sum(line_amount),0), coalesce(sum(line_vat),0)
    into v_sub, v_vat from public.order_items where order_id = p_order;

  select coalesce(sum(amount) filter (where confirmed), 0),
         coalesce(sum(amount) filter (where not confirmed), 0)
    into v_paid, v_pending
    from public.payments where order_id = p_order;

  v_total := v_sub + v_vat;

  update public.orders
     set subtotal       = v_sub,
         vat_amount     = v_vat,
         total_amount   = v_total,
         paid_amount    = v_paid,
         pending_amount = v_pending,
         is_settled     = (v_total > 0 and v_paid >= v_total),
         updated_at     = now()
   where id = p_order;
end $$;

-- Tinh lai toan bo don cho dung cot pending_amount
do $$
declare r record;
begin
  for r in select id from public.orders loop
    perform public.recalc_order_totals(r.id);
  end loop;
end $$;

-- ============================================================
-- 3. KHONG AI DUOC GHI VUOT SO TIEN THUC TE CUA MOT KHOAN CHUYEN
-- ============================================================
-- Day la chot chan quan trong nhat: mot khoan tien ve 10 trieu
-- chi duoc phan bo toi da 10 trieu cho tat ca cac don cong lai.
create or replace function public.trg_check_bank_allocation()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_in numeric(18,2); v_used numeric(18,2);
begin
  if new.bank_txn_id is null or new.voided then
    return new;
  end if;

  select amount_in into v_in
    from public.bank_transactions where id = new.bank_txn_id;

  if v_in is null then
    raise exception 'Khoan tien ve khong ton tai trong bang ke.';
  end if;

  select coalesce(sum(amount), 0) into v_used
    from public.payments
   where bank_txn_id = new.bank_txn_id
     and not voided
     and id <> new.id;

  if v_used + new.amount > v_in + 0.01 then
    raise exception
      'Khoan tien ve nay chi con % dong chua phan bo, khong ghi duoc % dong.',
      to_char(v_in - v_used, 'FM999,999,999,999'),
      to_char(new.amount,    'FM999,999,999,999');
  end if;

  return new;
end $$;

drop trigger if exists tr_check_bank_allocation on public.payments;
create trigger tr_check_bank_allocation
before insert or update on public.payments
for each row execute function public.trg_check_bank_allocation();

-- ============================================================
-- 4. KINH DOANH GHI NHAN TIEN VE
-- ============================================================
create or replace function public.trg_payment_dat_trang_thai()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.app_role() = 'sales' then
    -- Chi duoc ghi cho don cua chinh minh, va don phai duoc Ke toan duyet roi
    if not exists (select 1 from public.orders o
                    where o.id = new.order_id and o.sales_id = auth.uid()) then
      raise exception 'Chi duoc ghi nhan tien ve cho don hang cua minh.';
    end if;

    if not exists (select 1 from public.orders o
                    where o.id = new.order_id
                      and o.status in ('approved','in_production','completed','delivered')) then
      raise exception 'Don chua duoc Ke toan duyet (hoac da huy) nen chua ghi nhan tien duoc.';
    end if;

    -- Phai chon khoan tien tu bang ke — khong duoc khai khong
    if new.bank_txn_id is null then
      raise exception 'Chon khoan tien ve tu bang ke ngan hang truoc khi luu.';
    end if;

    if new.amount <= 0 then
      raise exception 'Kinh doanh chi ghi duoc tien khach chuyen ve. Khoan hoan tra do ke toan ghi.';
    end if;

    new.confirmed    := false;
    new.confirmed_at := null;
    new.confirmed_by := null;
    new.created_by   := auth.uid();
    new.reconciled   := false;
  else
    if new.confirmed is not false then
      new.confirmed    := true;
      new.confirmed_at := coalesce(new.confirmed_at, now());
      new.confirmed_by := coalesce(new.confirmed_by, auth.uid());
    end if;
  end if;
  return new;
end $$;

drop trigger if exists tr_payment_dat_trang_thai on public.payments;
create trigger tr_payment_dat_trang_thai
before insert on public.payments
for each row execute function public.trg_payment_dat_trang_thai();

-- ---------- RLS: mo quyen ghi cho kinh doanh ----------
drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
  for insert to authenticated
  with check (
    public.is_role('accounting','management')
    or (public.is_role('sales')
        and exists (select 1 from public.orders o
                     where o.id = order_id and o.sales_id = auth.uid()))
  );

-- Kinh doanh go duoc but toan minh vua ghi nham, mien la ke toan chua xac nhan
drop policy if exists payments_delete on public.payments;
create policy payments_delete on public.payments
  for delete to authenticated
  using (
    public.is_role('management')
    or (public.is_role('sales') and not confirmed and created_by = auth.uid())
  );

-- ---------- Guard sua but toan: cho phep thao tac xac nhan ----------
create or replace function public.trg_guard_payment_edit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.app_role() = 'management' then
    return new;
  end if;

  -- Ke toan duoc phep xac nhan but toan kinh doanh gui len,
  -- nhung khong duoc dong thoi sua so lieu trong cung mot lan.
  if new.confirmed is distinct from old.confirmed
     and not public.is_role('accounting') then
    raise exception 'Chi Ke toan hoac Ban Giam doc duoc xac nhan but toan.';
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
  or new.bank_txn_id   is distinct from old.bank_txn_id
  or new.voided        is distinct from old.voided then
    raise exception 'Khong duoc sua truc tiep but toan thu tien. Hay tao yeu cau dieu chinh de Ban Giam doc duyet.';
  end if;

  return new;
end $$;

-- ---------- Ke toan xac nhan / tra lai ----------
create or replace function public.xac_nhan_but_toan(p_payment_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_role('accounting','management') then
    raise exception 'Chi Ke toan hoac Ban Giam doc duoc xac nhan but toan.';
  end if;

  update public.payments
     set confirmed = true, confirmed_at = now(), confirmed_by = auth.uid()
   where id = p_payment_id and not confirmed;

  if not found then
    raise exception 'But toan khong ton tai hoac da duoc xac nhan roi.';
  end if;
end $$;

create or replace function public.tra_lai_but_toan(p_payment_id uuid, p_ly_do text)
returns void
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if not public.is_role('accounting','management') then
    raise exception 'Chi Ke toan hoac Ban Giam doc duoc tra lai but toan.';
  end if;
  if coalesce(btrim(p_ly_do), '') = '' then
    raise exception 'Nhap ly do tra lai de kinh doanh biet duong sua.';
  end if;

  select * into p from public.payments where id = p_payment_id;
  if p.id is null then raise exception 'But toan khong ton tai.'; end if;
  if p.confirmed then
    raise exception 'But toan da xac nhan roi, muon sua phai lam yeu cau dieu chinh.';
  end if;

  insert into public.audit_log(table_name, record_id, action, actor_id, note)
  values ('payments', p_payment_id, 'DELETE', auth.uid(),
          'Tra lai but toan kinh doanh gui len: ' || to_char(p.amount, 'FM999,999,999,999')
          || ' dong ngay ' || to_char(p.payment_date, 'DD/MM/YYYY')
          || '. Ly do: ' || p_ly_do);

  delete from public.payments where id = p_payment_id;
end $$;

grant execute on function public.xac_nhan_but_toan(uuid)      to authenticated;
grant execute on function public.tra_lai_but_toan(uuid, text) to authenticated;

-- ============================================================
-- 5. VIEW TIEN VE — KINH DOANH DOC DUOC, KHONG LO TIEN DI
-- ============================================================
-- Cac view duoi day co chu dinh KHONG dung security_invoker:
-- chung chay bang quyen chu so huu de kinh doanh doc duoc tien ve,
-- nhung chi lo dung cot tien ve. Cot phat sinh no (amount_out) va
-- so du tai khoan (balance) khong xuat hien o bat ky dong nao.
-- Quyen duoc chan ngay trong menh de where.

-- ---------- Da phan bo bao nhieu / con lai bao nhieu ----------
create or replace function public.tien_da_phan_bo(p_txn uuid)
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)
    from public.payments
   where bank_txn_id = p_txn and not voided
$$;

grant execute on function public.tien_da_phan_bo(uuid) to authenticated;

-- ---------- Nguon cho O TIM KIEM: khoan con tien chua phan bo ----------
drop view if exists public.v_tien_ve_chua_khop;
create view public.v_tien_ve_chua_khop as
select
  b.id, b.bank_ref, b.posting_date, b.txn_at,
  b.amount_in, b.counterparty, b.content, b.account_no, b.bank_name,
  public.tien_da_phan_bo(b.id)                as da_phan_bo,
  b.amount_in - public.tien_da_phan_bo(b.id)  as con_lai,
  (current_date - b.posting_date)             as so_ngay_truoc
from public.bank_transactions b
where b.amount_in > 0
  and not b.ignored
  and b.amount_in - public.tien_da_phan_bo(b.id) > 0.01
  and public.is_role('sales','accounting','management');

comment on view public.v_tien_ve_chua_khop is
  'Khoan tien ve VAN CON tien chua phan bo. Ghi mot phan thi lan sau van tim thay phan con lai.';

-- ---------- Danh sach day du de theo doi va doi chieu ----------
drop view if exists public.v_tien_ve_all;
create view public.v_tien_ve_all as
select
  b.id, b.bank_ref, b.posting_date, b.txn_at,
  b.amount_in, b.counterparty, b.content,
  b.ignored, b.ignore_reason,
  public.tien_da_phan_bo(b.id)               as da_phan_bo,
  b.amount_in - public.tien_da_phan_bo(b.id) as con_lai,
  case
    when b.ignored then 'bo_qua'
    when public.tien_da_phan_bo(b.id) <= 0.01 then 'chua_khop'
    when b.amount_in - public.tien_da_phan_bo(b.id) > 0.01 then 'khop_mot_phan'
    else 'khop_du'
  end as trang_thai,
  (select count(*) from public.payments p
    where p.bank_txn_id = b.id and not p.voided) as so_but_toan,
  (select count(*) from public.payments p
    where p.bank_txn_id = b.id and not p.voided and not p.confirmed) as so_cho_xac_nhan,
  (select string_agg(distinct o.order_code, ', ' order by o.order_code)
     from public.payments p join public.orders o on o.id = p.order_id
    where p.bank_txn_id = b.id and not p.voided) as cac_don,
  (select string_agg(distinct o.customer_name, ', ')
     from public.payments p join public.orders o on o.id = p.order_id
    where p.bank_txn_id = b.id and not p.voided) as cac_khach
from public.bank_transactions b
where b.amount_in > 0
  and public.is_role('sales','accounting','management');

comment on view public.v_tien_ve_all is
  'Toan bo tien ve kem tinh trang phan bo. Kinh doanh doc duoc — khong co cot tien di, khong co so du.';

-- ---------- Doi chieu chi tiet (ke toan / giam doc) ----------
drop view if exists public.v_doi_chieu_sao_ke;
create view public.v_doi_chieu_sao_ke
with (security_invoker = on) as
select
  b.id as txn_id, b.bank_ref, b.posting_date, b.amount_in,
  b.counterparty, b.content, b.ignored,
  p.id           as payment_id,
  p.amount       as so_tien_ghi_so,
  p.payment_date as ngay_ghi_so,
  p.confirmed,
  o.order_code, o.customer_name,
  u.full_name    as nguoi_ghi
from public.bank_transactions b
left join public.payments p on p.bank_txn_id = b.id and not p.voided
left join public.orders   o on o.id = p.order_id
left join public.users    u on u.id = p.created_by
where b.amount_in > 0;

-- ---------- So thu tien: danh dau but toan chua xac nhan ----------
drop view if exists public.v_payment_ledger;
create view public.v_payment_ledger
with (security_invoker = on) as
select
  p.id, p.payment_date, p.created_at,
  o.order_code, o.id as order_id, o.customer_name,
  c.customer_code, c.tax_code,
  s.full_name as sales_name,
  e.code as entity_code, e.short_name as entity_name,
  p.payment_type, p.amount, p.method, p.bank_account,
  p.reference_no, p.transfer_note, p.note,
  p.proof_path,
  (p.proof_path is not null) as co_chung_tu,
  p.reconciled, p.reconciled_at,
  p.voided, p.voided_reason,
  p.confirmed, p.confirmed_at,
  cf.full_name as nguoi_xac_nhan,
  b.bank_ref,
  u.full_name as nguoi_ghi,
  o.total_amount as order_total, o.paid_amount as order_paid, o.debt_amount as order_debt,
  exists (select 1 from public.payment_amendments a
           where a.payment_id = p.id and a.status = 'pending') as co_yeu_cau_sua
from public.payments p
join public.orders    o on o.id = p.order_id
left join public.customers        c on c.id = o.customer_id
left join public.users            u on u.id = p.created_by
left join public.users            cf on cf.id = p.confirmed_by
left join public.users            s on s.id = o.sales_id
left join public.issuing_entities e on e.id = o.entity_id
left join public.bank_transactions b on b.id = p.bank_txn_id;

comment on view public.v_payment_ledger is
  'So nhat ky thu tien. Cot confirmed = false la khoan kinh doanh bao ve, chua hach toan.';

-- ---------- But toan dang cho ke toan xac nhan ----------
drop view if exists public.v_but_toan_cho_xac_nhan;
create view public.v_but_toan_cho_xac_nhan
with (security_invoker = on) as
select
  p.id, p.order_id, p.amount, p.payment_date, p.payment_type,
  p.method, p.reference_no, p.transfer_note, p.note, p.created_at,
  o.order_code, o.customer_name, o.total_amount, o.paid_amount, o.debt_amount,
  u.full_name  as nguoi_ghi,
  b.bank_ref, b.amount_in as so_tien_ve, b.counterparty, b.content as noi_dung_ck,
  b.amount_in - public.tien_da_phan_bo(b.id) as con_lai_cua_khoan
from public.payments p
join public.orders o on o.id = p.order_id
left join public.users u on u.id = p.created_by
left join public.bank_transactions b on b.id = p.bank_txn_id
where not p.confirmed and not p.voided;

comment on view public.v_but_toan_cho_xac_nhan is
  'But toan kinh doanh gui len, ke toan bam mot cham la vao cong no.';

-- ---------- Quyen doc bang giao dich cho kinh doanh ----------
-- Kinh doanh KHONG doc truc tiep bang bank_transactions (co cot tien di,
-- so du). Ho chi doc qua hai view o tren. Giu nguyen policy cu.

grant select on public.v_tien_ve_chua_khop      to authenticated;
grant select on public.v_tien_ve_all            to authenticated;
grant select on public.v_but_toan_cho_xac_nhan  to authenticated;
grant select on public.v_doi_chieu_sao_ke    to authenticated;
grant select on public.v_payment_ledger      to authenticated;

-- ============================================================
-- 13_nhat_ky_va_cong_no.sql
--  1. NHAT KY HE THONG: ghi lai moi thao tac them / sua / xoa but toan thu tien
--  2. Cho Ban Giam doc XOA but toan (co ly do, van luu vet trong nhat ky)
--  3. DINH NGHIA LAI CONG NO: chi tinh don DA GIAO ma chua thu du tien
--  4. View cho Bao cao tong hop: ton san xuat, doanh thu & cong no theo NVKD
-- Chay 1 lan trong SQL Editor (sau 12).
-- ============================================================

-- Ly do xoa: ghi vao but toan truoc khi xoa de nhat ky bat duoc
alter table public.payments
  add column if not exists delete_reason text;

-- ============================================================
-- 1. NHAT KY HE THONG
-- ============================================================
create table if not exists public.audit_log (
  id         bigserial primary key,
  table_name text not null,
  record_id  uuid,
  action     text not null,               -- INSERT | UPDATE | DELETE
  actor_id   uuid references public.users(id) on delete set null,
  old_data   jsonb,
  new_data   jsonb,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_table on public.audit_log(table_name, created_at desc);
create index if not exists idx_audit_record on public.audit_log(record_id);

comment on table public.audit_log is
  'Nhat ky he thong — moi thao tac tren but toan thu tien deu duoc ghi lai, khong ai xoa duoc';

create or replace function public.trg_audit_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_note text;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log(table_name, record_id, action, actor_id, new_data, note)
    values ('payments', new.id, 'INSERT', auth.uid(), to_jsonb(new),
            'Ghi nhan thu ' || to_char(new.amount, 'FM999,999,999,999') || ' d');
    return new;

  elsif tg_op = 'UPDATE' then
    -- bo qua thay doi chi lien quan doi chieu (khong phai su kien ke toan)
    if new.amount is distinct from old.amount
    or new.payment_date is distinct from old.payment_date
    or new.payment_type is distinct from old.payment_type
    or new.method is distinct from old.method
    or new.reference_no is distinct from old.reference_no
    or new.transfer_note is distinct from old.transfer_note
    or new.voided is distinct from old.voided then
      if new.voided and not old.voided then
        v_note := 'HUY but toan — ' || coalesce(new.voided_reason, '');
      else
        v_note := 'Sua but toan: ' || to_char(old.amount, 'FM999,999,999,999')
                  || ' -> ' || to_char(new.amount, 'FM999,999,999,999') || ' d';
      end if;
      insert into public.audit_log(table_name, record_id, action, actor_id, old_data, new_data, note)
      values ('payments', new.id, 'UPDATE', auth.uid(), to_jsonb(old), to_jsonb(new), v_note);
    end if;
    return new;

  else
    insert into public.audit_log(table_name, record_id, action, actor_id, old_data, note)
    values ('payments', old.id, 'DELETE', auth.uid(), to_jsonb(old),
            'XOA but toan ' || to_char(old.amount, 'FM999,999,999,999') || ' d — '
            || coalesce(old.delete_reason, 'khong ghi ly do'));
    return old;
  end if;
end $$;

drop trigger if exists tr_audit_payment_ins on public.payments;
create trigger tr_audit_payment_ins after insert on public.payments
for each row execute function public.trg_audit_payment();

drop trigger if exists tr_audit_payment_upd on public.payments;
create trigger tr_audit_payment_upd after update on public.payments
for each row execute function public.trg_audit_payment();

drop trigger if exists tr_audit_payment_del on public.payments;
create trigger tr_audit_payment_del after delete on public.payments
for each row execute function public.trg_audit_payment();

-- ---------- RLS nhat ky: doc duoc, khong ai sua/xoa ----------
alter table public.audit_log enable row level security;

drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log
  for select to authenticated using (public.is_role('accounting','management'));

drop policy if exists audit_no_write on public.audit_log;
create policy audit_no_write on public.audit_log
  for update to authenticated using (false);

drop policy if exists audit_no_delete on public.audit_log;
create policy audit_no_delete on public.audit_log
  for delete to authenticated using (false);

create or replace view public.v_audit_log
with (security_invoker = on) as
select
  a.id, a.table_name, a.record_id, a.action, a.note, a.created_at,
  a.old_data, a.new_data,
  u.full_name as nguoi_thuc_hien,
  u.role      as vai_tro,
  coalesce(a.new_data->>'order_id', a.old_data->>'order_id')::uuid as order_id,
  o.order_code, o.customer_name,
  coalesce((a.new_data->>'amount')::numeric, (a.old_data->>'amount')::numeric) as so_tien
from public.audit_log a
left join public.users u on u.id = a.actor_id
left join public.orders o
  on o.id = coalesce(a.new_data->>'order_id', a.old_data->>'order_id')::uuid;

-- ============================================================
-- 2. CHO BAN GIAM DOC XOA BUT TOAN
-- ============================================================
drop policy if exists payments_delete on public.payments;
create policy payments_delete on public.payments
  for delete to authenticated using (public.is_role('management'));

-- ============================================================
-- 3. CONG NO THUC = HANG DA GIAO NHUNG CHUA THU DU TIEN
-- ============================================================
drop view if exists public.v_cong_no_thuc;
create view public.v_cong_no_thuc
with (security_invoker = on) as
select
  o.id as order_id, o.order_code, o.order_date, o.delivered_at,
  o.customer_id, o.customer_name, c.customer_code, c.tax_code, c.phone,
  o.sales_id, u.full_name as sales_name,
  o.total_amount, o.paid_amount, o.debt_amount,
  (current_date - o.delivered_at::date) as so_ngay_no
from public.orders o
left join public.customers c on c.id = o.customer_id
left join public.users     u on u.id = o.sales_id
where o.status = 'delivered'
  and o.debt_amount > 0;

comment on view public.v_cong_no_thuc is
  'Cong no phai thu thuc te: hang DA GIAO nhung chua thu du tien';

-- Don chua giao ma chua thu -> chua phai cong no, chi la gia tri dang chay
drop view if exists public.v_don_dang_chay;
create view public.v_don_dang_chay
with (security_invoker = on) as
select
  o.id as order_id, o.order_code, o.order_date, o.status,
  o.customer_name, o.sales_id, u.full_name as sales_name,
  o.total_amount, o.paid_amount, o.debt_amount,
  o.estimated_delivery_date,
  (current_date - o.order_date) as so_ngay_tu_khi_lap
from public.orders o
left join public.users u on u.id = o.sales_id
where o.status in ('pending_accounting','approved','in_production','completed');

-- ============================================================
-- 4. TON SAN XUAT — don da duyet ma chua giao xong
-- ============================================================
drop view if exists public.v_ton_san_xuat;
create view public.v_ton_san_xuat
with (security_invoker = on) as
select
  o.id as order_id, o.order_code, o.order_date, o.status,
  o.customer_name, u.full_name as sales_name,
  o.total_amount,
  o.approved_at, o.production_started_at, o.completed_at,
  o.estimated_delivery_date,
  (current_date - o.approved_at::date) as so_ngay_ke_tu_duyet,
  case
    when o.estimated_delivery_date is null then null
    else (current_date - o.estimated_delivery_date)
  end as so_ngay_tre_han,
  (select count(*) from public.order_items i where i.order_id = o.id) as so_dong_hang,
  exists (select 1 from public.order_files f where f.order_id = o.id) as co_thiet_ke
from public.orders o
left join public.users u on u.id = o.sales_id
where o.status in ('approved','in_production','completed');

comment on view public.v_ton_san_xuat is
  'Don da duyet, dang nam o San xuat, chua giao xong';

-- ============================================================
-- 5. DOANH THU & CONG NO THEO NHAN VIEN KINH DOANH
-- ============================================================
drop view if exists public.v_kd_hieu_suat;
create view public.v_kd_hieu_suat
with (security_invoker = on) as
select
  u.id as sales_id,
  u.full_name as sales_name,
  u.employee_code,
  count(o.id) filter (where o.status not in ('draft','cancelled'))            as so_don,
  coalesce(sum(o.total_amount) filter (where o.status not in ('draft','cancelled')), 0) as doanh_thu,
  coalesce(sum(o.paid_amount)  filter (where o.status not in ('draft','cancelled')), 0) as da_thu,
  -- cong no THUC: chi tinh don da giao
  coalesce(sum(o.debt_amount)  filter (where o.status = 'delivered'), 0)      as cong_no,
  count(o.id) filter (where o.status = 'delivered' and o.debt_amount > 0)     as so_don_con_no,
  -- gia tri don dang chay (chua giao)
  coalesce(sum(o.total_amount) filter (where o.status in ('pending_accounting','approved','in_production','completed')), 0) as dang_chay,
  count(o.id) filter (where o.status in ('approved','in_production','completed')) as so_don_dang_sx
from public.users u
left join public.orders o on o.sales_id = u.id
where u.role = 'sales' or exists (select 1 from public.orders x where x.sales_id = u.id)
group by u.id, u.full_name, u.employee_code;

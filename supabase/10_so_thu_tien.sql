-- ============================================================
-- 10_so_thu_tien.sql
-- So nhat ky thu tien + chuan bi doi chieu sao ke ngan hang
-- Chay 1 lan trong SQL Editor (sau 09).
-- ============================================================

alter table public.payments
  add column if not exists bank_account   text,      -- tai khoan/ngan hang nhan tien
  add column if not exists transfer_note  text,      -- noi dung chuyen khoan khach ghi
  add column if not exists reconciled     boolean not null default false,
  add column if not exists reconciled_at  timestamptz,
  add column if not exists reconciled_by  uuid references public.users(id) on delete set null;

comment on column public.payments.transfer_note is
  'Noi dung khach ghi khi chuyen khoan — dung de do voi sao ke ngan hang';
comment on column public.payments.reconciled is
  'Da doi chieu khop voi sao ke ngan hang hay chua';

create index if not exists idx_payments_reconciled on public.payments(reconciled);
create index if not exists idx_payments_ref on public.payments(reference_no);

-- Tu dong dau thoi diem doi chieu
create or replace function public.trg_payment_reconcile()
returns trigger language plpgsql as $$
begin
  if new.reconciled is distinct from old.reconciled then
    if new.reconciled then
      new.reconciled_at := now();
      new.reconciled_by := auth.uid();
    else
      new.reconciled_at := null;
      new.reconciled_by := null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists tr_payment_reconcile on public.payments;
create trigger tr_payment_reconcile before update on public.payments
for each row execute function public.trg_payment_reconcile();

-- ---------- SO THU TIEN ----------
-- Gom day du thong tin de doi chieu: ngay, don, khach, hinh thuc, chung tu, nguoi ghi
create or replace view public.v_payment_ledger
with (security_invoker = on) as
select
  p.id,
  p.payment_date,
  p.created_at,
  o.order_code,
  o.id                as order_id,
  o.customer_name,
  c.customer_code,
  c.tax_code,
  s.full_name         as sales_name,
  p.payment_type,
  p.amount,
  p.method,
  p.bank_account,
  p.reference_no,
  p.transfer_note,
  p.note,
  p.reconciled,
  p.reconciled_at,
  u.full_name         as nguoi_ghi,
  o.total_amount      as order_total,
  o.paid_amount       as order_paid,
  o.debt_amount       as order_debt
from public.payments p
join public.orders    o on o.id = p.order_id
left join public.customers c on c.id = o.customer_id
left join public.users     u on u.id = p.created_by
left join public.users     s on s.id = o.sales_id;

comment on view public.v_payment_ledger is
  'So nhat ky thu tien — nguon du lieu cho man hinh So thu tien va doi chieu sao ke';

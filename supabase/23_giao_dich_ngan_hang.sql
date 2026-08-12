-- ============================================================
-- 23_giao_dich_ngan_hang.sql
-- Nhap sao ke ngan hang, doi chieu voi but toan thu tien.
-- ------------------------------------------------------------
-- Quy trinh:
--   1. Ke toan tai sao ke tu ngan hang (file Excel) -> bam Nhap bang ke
--   2. He thong luu tung giao dich TIEN VE, chong trung theo SO BUT TOAN
--   3. Khi ghi coc/thanh toan, o tim kiem hien cac khoan tien ve CHUA DUNG
--   4. Chon mot khoan -> tu dien so tien, ngay, so chung tu, noi dung CK
--   5. Khoan da dung bien mat khoi o tim kiem -> khong ai ghi trung
-- Chay 1 lan trong SQL Editor (sau 22).
-- ============================================================

create table if not exists public.bank_transactions (
  id            uuid primary key default gen_random_uuid(),

  -- SO BUT TOAN cua ngan hang (vd FT26224784038005) — khoa chong trung
  bank_ref      text not null,
  bank_name     text,
  account_no    text,

  txn_at        timestamptz,          -- ngay gio giao dich
  posting_date  date not null,        -- ngay hach toan
  amount_in     numeric(18,2) not null default 0,   -- phat sinh CO (tien ve)
  amount_out    numeric(18,2) not null default 0,   -- phat sinh NO (tien ra)
  balance       numeric(18,2),

  counterparty  text,                 -- don vi chuyen / thu huong
  content       text,                 -- noi dung chuyen khoan

  -- Khoan tien ve khong lien quan don hang (hoan tien NCC, chuyen noi bo...)
  ignored       boolean not null default false,
  ignore_reason text,

  entity_id     uuid references public.issuing_entities(id) on delete set null,
  raw           jsonb,
  imported_at   timestamptz not null default now(),
  imported_by   uuid references public.users(id) on delete set null,

  constraint uq_bank_ref unique (bank_ref)
);

create index if not exists idx_bank_date on public.bank_transactions(posting_date desc);
create index if not exists idx_bank_in   on public.bank_transactions(amount_in);

comment on table public.bank_transactions is
  'Sao ke ngan hang. Chong trung theo bank_ref nen nhap lai cung file khong sinh ban ghi thua.';

-- ---------- Gan but toan thu tien voi giao dich ngan hang ----------
alter table public.payments
  add column if not exists bank_txn_id uuid references public.bank_transactions(id) on delete set null;

create index if not exists idx_payments_bank on public.payments(bank_txn_id);

-- ---------- Khoan tien ve CHUA DUOC DUNG ----------
-- Tinh truc tiep bang NOT EXISTS nen khong bao gio lech trang thai:
-- xoa hoac huy but toan la khoan tien tu dong quay lai danh sach.
drop view if exists public.v_tien_ve_chua_khop;
create view public.v_tien_ve_chua_khop
with (security_invoker = on) as
select
  b.id, b.bank_ref, b.posting_date, b.txn_at,
  b.amount_in, b.counterparty, b.content, b.account_no, b.bank_name,
  (current_date - b.posting_date) as so_ngay_truoc
from public.bank_transactions b
where b.amount_in > 0
  and not b.ignored
  and not exists (
    select 1 from public.payments p
    where p.bank_txn_id = b.id and not p.voided
  );

comment on view public.v_tien_ve_chua_khop is
  'Cac khoan tien ve chua gan voi but toan thu tien nao — nguon cho o tim kiem khi ghi thu';

-- ---------- Tong quan doi chieu ----------
drop view if exists public.v_doi_chieu_sao_ke;
create view public.v_doi_chieu_sao_ke
with (security_invoker = on) as
select
  b.id, b.bank_ref, b.posting_date, b.amount_in, b.counterparty, b.content,
  b.ignored, b.ignore_reason,
  p.id            as payment_id,
  p.amount        as so_tien_ghi_so,
  p.payment_date  as ngay_ghi_so,
  o.order_code, o.customer_name,
  u.full_name     as nguoi_ghi,
  case
    when b.ignored          then 'bo_qua'
    when p.id is null       then 'chua_khop'
    when p.amount = b.amount_in then 'khop_du'
    else 'khop_lech'
  end as trang_thai
from public.bank_transactions b
left join public.payments p on p.bank_txn_id = b.id and not p.voided
left join public.orders   o on o.id = p.order_id
left join public.users    u on u.id = p.created_by
where b.amount_in > 0;

-- ---------- RLS ----------
alter table public.bank_transactions enable row level security;

drop policy if exists bank_select on public.bank_transactions;
create policy bank_select on public.bank_transactions
  for select to authenticated using (public.is_role('accounting','management'));

drop policy if exists bank_insert on public.bank_transactions;
create policy bank_insert on public.bank_transactions
  for insert to authenticated with check (public.is_role('accounting','management'));

drop policy if exists bank_update on public.bank_transactions;
create policy bank_update on public.bank_transactions
  for update to authenticated
  using (public.is_role('accounting','management'))
  with check (public.is_role('accounting','management'));

drop policy if exists bank_delete on public.bank_transactions;
create policy bank_delete on public.bank_transactions
  for delete to authenticated using (public.is_role('management'));

-- ---------- Ghi nhat ky khi nhap bang ke ----------
create or replace function public.ghi_nhat_ky_nhap_bang_ke(p_so_moi int, p_so_bo_qua int, p_tu date, p_den date)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log(table_name, action, actor_id, note)
  values ('bank_transactions', 'INSERT', auth.uid(),
          'Nhap bang ke ngan hang ' || coalesce(to_char(p_tu, 'DD/MM/YYYY'), '?')
          || ' - ' || coalesce(to_char(p_den, 'DD/MM/YYYY'), '?')
          || ': them moi ' || p_so_moi || ' giao dich, bo qua ' || p_so_bo_qua || ' giao dich da co');
end $$;

grant execute on function public.ghi_nhat_ky_nhap_bang_ke(int, int, date, date) to authenticated;

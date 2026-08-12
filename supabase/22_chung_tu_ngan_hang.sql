-- ============================================================
-- 22_chung_tu_ngan_hang.sql
-- Dinh kem ANH CHUNG TU CHUYEN KHOAN vao don hang va but toan thu tien.
-- ------------------------------------------------------------
-- Muc dich: nhin vao So thu tien la biet ngay khoan nao tien da ve tai khoan.
--   * Kinh doanh chup man hinh chuyen khoan cua khach -> dinh vao don khi khai coc
--   * Ke toan mo anh ra doi chieu voi sao ke roi bam xac nhan
--   * Khoan nao chua co chung tu thi o do de TRANG -> nhin phat thay ngay
--
-- Kho chung tu de RIENG TU (khac kho anh mau san pham) vi trong anh co
-- so tai khoan, so du, ten chu tai khoan. Chi nguoi dang nhap moi xem duoc.
-- Chay 1 lan trong SQL Editor (sau 21).
-- ============================================================

-- ---------- 1. Cot luu duong dan anh ----------
alter table public.orders
  add column if not exists deposit_proof_path text;

alter table public.payments
  add column if not exists proof_path text;

comment on column public.orders.deposit_proof_path is
  'Anh chung tu chuyen khoan tien coc do Kinh doanh dinh kem — chua phai but toan';
comment on column public.payments.proof_path is
  'Anh chung tu chuyen khoan cua but toan nay, nam trong bucket chung-tu';

-- ---------- 2. Kho chung tu (RIENG TU) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('chung-tu', 'chung-tu', false, 5242880)     -- 5 MB / anh
on conflict (id) do update set public = false, file_size_limit = 5242880;

drop policy if exists chungtu_read on storage.objects;
create policy chungtu_read on storage.objects
  for select to authenticated using (bucket_id = 'chung-tu');

drop policy if exists chungtu_write on storage.objects;
create policy chungtu_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chung-tu' and public.is_role('sales','accounting','management'));

drop policy if exists chungtu_update on storage.objects;
create policy chungtu_update on storage.objects
  for update to authenticated
  using (bucket_id = 'chung-tu' and public.is_role('sales','accounting','management'));

drop policy if exists chungtu_delete on storage.objects;
create policy chungtu_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'chung-tu' and public.is_role('accounting','management'));

-- ---------- 3. Xac nhan coc: chuyen anh tu don sang but toan ----------
create or replace function public.xac_nhan_tien_coc(
  p_order_id uuid,
  p_amount   numeric,
  p_method   text default 'Chuyển khoản',
  p_ref      text default null,
  p_date     date default current_date,
  p_proof    text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_proof text;
begin
  if not public.is_role('accounting','management') then
    raise exception 'Chi Ke toan hoac Ban Giam doc moi duoc xac nhan tien coc';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'So tien coc phai lon hon 0';
  end if;

  -- Neu Ke toan khong dinh anh moi thi lay anh Kinh doanh da dinh vao don
  select coalesce(p_proof, deposit_proof_path) into v_proof
    from public.orders where id = p_order_id;

  insert into public.payments (order_id, payment_type, amount, payment_date,
                               method, reference_no, note, proof_path, created_by)
  values (p_order_id, 'deposit', p_amount, coalesce(p_date, current_date),
          p_method, p_ref, 'Xac nhan tien coc khach dua khi dat hang', v_proof, auth.uid())
  returning id into v_id;

  update public.orders set deposit_confirmed = true where id = p_order_id;
  return v_id;
end $$;

grant execute on function public.xac_nhan_tien_coc(uuid, numeric, text, text, date, text) to authenticated;

-- ---------- 4. Bo sung chung tu vao So thu tien ----------
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
  u.full_name as nguoi_ghi,
  o.total_amount as order_total, o.paid_amount as order_paid, o.debt_amount as order_debt,
  exists (select 1 from public.payment_amendments a
           where a.payment_id = p.id and a.status = 'pending') as co_yeu_cau_sua
from public.payments p
join public.orders    o on o.id = p.order_id
left join public.customers        c on c.id = o.customer_id
left join public.users            u on u.id = p.created_by
left join public.users            s on s.id = o.sales_id
left join public.issuing_entities e on e.id = o.entity_id;

-- ---------- 5. Bang doi chieu ngan hang ----------
-- Gom moi khoan da thu, danh dau ro: co chung tu chua, doi chieu chua.
drop view if exists public.v_doi_chieu_ngan_hang;
create view public.v_doi_chieu_ngan_hang
with (security_invoker = on) as
select
  p.id, p.payment_date, p.amount, p.method, p.reference_no, p.transfer_note,
  p.proof_path, p.reconciled, p.reconciled_at, p.voided,
  o.order_code, o.customer_name,
  e.short_name as entity_name,
  u.full_name  as nguoi_ghi,
  case
    when p.voided                       then 'Đã hủy'
    when p.reconciled                   then 'Đã khớp sao kê'
    when p.proof_path is not null       then 'Có chứng từ, chờ đối chiếu'
    else 'Chưa có chứng từ'
  end as tinh_trang
from public.payments p
join public.orders o on o.id = p.order_id
left join public.issuing_entities e on e.id = o.entity_id
left join public.users u on u.id = p.created_by;

comment on view public.v_doi_chieu_ngan_hang is
  'Doi chieu tien ve ngan hang: khoan nao co chung tu, khoan nao da khop sao ke';

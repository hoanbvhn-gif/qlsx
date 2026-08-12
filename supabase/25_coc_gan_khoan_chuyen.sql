-- ============================================================
-- 25_coc_gan_khoan_chuyen.sql
-- Luc LAP DON, kinh doanh chon luon khoan tien coc trong bang ke.
-- ------------------------------------------------------------
-- Van de: luc dang go don thi don CHUA TON TAI, chua the tao but toan.
-- Cach lam: luu tam ma khoan tien ve tren chinh don hang.
-- Khi Ke toan bam xac nhan tien coc, but toan sinh ra se mang theo
-- ma khoan do -> khoan tien tu dong bien mat khoi danh sach chua dung,
-- va chot chan chong ghi vuot (trigger o file 24) bat dau co hieu luc.
--
-- Chay 1 lan trong SQL Editor (sau 24).
-- ============================================================

alter table public.orders
  add column if not exists deposit_bank_txn_id uuid
    references public.bank_transactions(id) on delete set null;

comment on column public.orders.deposit_bank_txn_id is
  'Khoan tien ve kinh doanh chi ra khi lap don. Chi la khai bao, Ke toan xac nhan moi thanh but toan.';

create index if not exists idx_orders_deposit_txn
  on public.orders(deposit_bank_txn_id) where deposit_bank_txn_id is not null;

-- ============================================================
-- XAC NHAN TIEN COC — mang theo ma khoan tien ve
-- ============================================================
create or replace function public.xac_nhan_tien_coc(
  p_order_id uuid,
  p_amount   numeric,
  p_method   text default 'Chuyen khoan',
  p_ref      text default null,
  p_date     date default null,
  p_proof    text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id    uuid;
  v_proof text;
  v_txn   uuid;
  v_ref   text;
begin
  if not public.is_role('accounting','management') then
    raise exception 'Chi Ke toan hoac Ban Giam doc moi duoc xac nhan tien coc';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'So tien coc phai lon hon 0';
  end if;

  -- Neu Ke toan khong dinh anh moi thi lay anh Kinh doanh da dinh vao don
  select coalesce(p_proof, deposit_proof_path), deposit_bank_txn_id
    into v_proof, v_txn
    from public.orders where id = p_order_id;

  -- Khong co so chung tu thi lay so but toan ngan hang cua khoan da chon
  v_ref := p_ref;
  if v_ref is null and v_txn is not null then
    select bank_ref into v_ref from public.bank_transactions where id = v_txn;
  end if;

  insert into public.payments (order_id, payment_type, amount, payment_date,
                               method, reference_no, note, proof_path,
                               bank_txn_id, created_by)
  values (p_order_id, 'deposit', p_amount, coalesce(p_date, current_date),
          p_method, v_ref, 'Xac nhan tien coc khach dua khi dat hang', v_proof,
          v_txn, auth.uid())
  returning id into v_id;

  update public.orders set deposit_confirmed = true where id = p_order_id;
  return v_id;
end $$;

grant execute on function public.xac_nhan_tien_coc(uuid, numeric, text, text, date, text)
  to authenticated;

-- ============================================================
-- CANH BAO SOM: khoan tien da bi don khac giu cho
-- ============================================================
-- Hai kinh doanh cung tro vao mot khoan tien luc lap don thi den buoc
-- Ke toan xac nhan moi vo. View nay de Ke toan nhin thay truoc.
drop view if exists public.v_coc_cho_xac_nhan;
create view public.v_coc_cho_xac_nhan
with (security_invoker = on) as
select
  o.id as order_id, o.order_code, o.customer_name, o.total_amount,
  o.deposit_expected, o.deposit_note, o.deposit_proof_path,
  o.status, o.created_at,
  s.full_name as nguoi_lap,
  b.id        as txn_id,
  b.bank_ref, b.posting_date, b.amount_in, b.counterparty, b.content,
  b.amount_in - public.tien_da_phan_bo(b.id) as con_lai_cua_khoan,
  (select count(*) from public.orders o2
    where o2.deposit_bank_txn_id = b.id
      and not o2.deposit_confirmed
      and o2.status <> 'cancelled') as so_don_cung_giu
from public.orders o
left join public.users s on s.id = o.sales_id
left join public.bank_transactions b on b.id = o.deposit_bank_txn_id
where o.deposit_expected > 0
  and not o.deposit_confirmed
  and o.status <> 'cancelled';

comment on view public.v_coc_cho_xac_nhan is
  'Don khai co tien coc nhung Ke toan chua xac nhan. Cot so_don_cung_giu > 1 la co hai don cung tro vao mot khoan tien.';

grant select on public.v_coc_cho_xac_nhan to authenticated;

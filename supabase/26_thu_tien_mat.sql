-- ============================================================
-- 26_thu_tien_mat.sql
-- Kinh doanh ghi duoc CA HAI hinh thuc: chuyen khoan va tien mat.
-- ------------------------------------------------------------
-- Chuyen khoan -> BAT BUOC chi ra khoan trong bang ke ngan hang.
--                 Co doi chieu khach quan, Ke toan chi viec kiem lai.
-- Tien mat      -> khong co bang ke de doi chieu, nen chi la LOI KHAI.
--                 Ke toan phai dem tien thuc te roi moi xac nhan.
--
-- Ca hai deu vao trang thai CHUA XAC NHAN, chua tru cong no.
-- Khach tra 2-3 lan thi ghi 2-3 but toan, moi lan mot khoan.
--
-- Chay 1 lan trong SQL Editor (sau 25).
-- ============================================================

create or replace function public.trg_payment_dat_trang_thai()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pt text;
begin
  if public.app_role() = 'sales' then
    -- Chi duoc ghi cho don cua chinh minh
    if not exists (select 1 from public.orders o
                    where o.id = new.order_id and o.sales_id = auth.uid()) then
      raise exception 'Chi duoc ghi nhan tien ve cho don hang cua minh.';
    end if;

    if not exists (select 1 from public.orders o
                    where o.id = new.order_id
                      and o.status in ('approved','in_production','completed','delivered')) then
      raise exception 'Don chua duoc Ke toan duyet (hoac da huy) nen chua ghi nhan tien duoc.';
    end if;

    if new.amount <= 0 then
      raise exception 'Kinh doanh chi ghi duoc tien khach tra. Khoan hoan tra do Ke toan ghi.';
    end if;

    -- Hinh thuc quyet dinh viec co phai chi ra khoan trong bang ke hay khong
    v_pt := lower(coalesce(new.method, ''));

    if v_pt like '%tien mat%' or v_pt like '%tiền mặt%' then
      -- Tien mat: khong co bang ke, bat buoc phai co dien giai de Ke toan doi chieu
      new.bank_txn_id := null;
      if coalesce(btrim(new.note), '') = '' then
        raise exception 'Thu tien mat thi phai ghi dien giai (ai dua, dua o dau) de Ke toan doi chieu.';
      end if;
    else
      if new.bank_txn_id is null then
        raise exception 'Chon khoan tien ve tu bang ke ngan hang truoc khi luu.';
      end if;
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

-- ============================================================
-- COC TIEN MAT LUC LAP DON
-- ============================================================
-- Kinh doanh khai coc bang tien mat thi khong gan khoan ngan hang nao.
-- Rang buoc: da chi ra khoan chuyen khoan thi khong duoc ghi la tien mat.
create or replace function public.trg_order_coc_hop_le()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.deposit_bank_txn_id is not null
     and coalesce(new.deposit_expected, 0) <= 0 then
    raise exception 'Da chon khoan tien chuyen ve thi phai ghi so tien coc.';
  end if;
  return new;
end $$;

drop trigger if exists tr_order_coc_hop_le on public.orders;
create trigger tr_order_coc_hop_le
before insert or update on public.orders
for each row execute function public.trg_order_coc_hop_le();

-- ============================================================
-- TIEN CAN THU CON LAI — de kinh doanh biet con phai doi bao nhieu
-- ============================================================
drop view if exists public.v_don_con_phai_thu;
create view public.v_don_con_phai_thu
with (security_invoker = on) as
select
  o.id, o.order_code, o.customer_name, o.status, o.order_date,
  o.sales_id, s.full_name as sales_name,
  o.total_amount, o.paid_amount, o.pending_amount, o.debt_amount,
  o.debt_amount - o.pending_amount as con_phai_doi,
  (select count(*) from public.payments p
    where p.order_id = o.id and not p.voided) as so_lan_thu,
  (select max(p.payment_date) from public.payments p
    where p.order_id = o.id and not p.voided and p.confirmed) as lan_thu_gan_nhat
from public.orders o
left join public.users s on s.id = o.sales_id
where o.status in ('approved','in_production','completed','delivered')
  and o.debt_amount > 0;

comment on view public.v_don_con_phai_thu is
  'Don da duyet con no tien. con_phai_doi = con no tru phan da bao nhung Ke toan chua xac nhan.';

grant select on public.v_don_con_phai_thu to authenticated;

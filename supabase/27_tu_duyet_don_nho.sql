-- ============================================================
-- 27_tu_duyet_don_nho.sql
-- Bo bot khau duyet o hai cho khong tao them gia tri kiem soat:
--
--   1. Don duoi NGUONG (mac dinh 5 trieu) -> kinh doanh gui la xuong
--      San xuat luon, khong cho Ke toan duyet.
--
--   2. Tien khach CHUYEN KHOAN da chi ra dung khoan trong bang ke
--      -> vao so ngay, khong cho xac nhan. Bang ke la chung cu tu ngan
--      hang, Ke toan co ngoi duyet cung chi nhin dung so do.
--      TIEN MAT van phai cho xac nhan vi khong co gi doi chieu.
--
-- Cai gi van giu: moi thao tac deu vao nhat ky, so tien khong bao gio
-- vuot so tien thuc te cua khoan chuyen, Giam doc van xoa/dieu chinh duoc.
--
-- Chay 1 lan trong SQL Editor (sau 26).
-- ============================================================

-- ============================================================
-- 1. NGUONG TU DUYET — sua duoc trong man Cau hinh he thong
-- ============================================================
insert into public.app_settings (key, value, label) values
  ('nguong_tu_duyet', '5000000',
   'Don hang duoi so tien nay thi Kinh doanh gui la xuong San xuat luon (dong = 0 de tat)')
on conflict (key) do nothing;

create or replace function public.nguong_tu_duyet()
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(value, '')::numeric, 0)
    from public.app_settings where key = 'nguong_tu_duyet'
$$;

grant execute on function public.nguong_tu_duyet() to authenticated;

-- ============================================================
-- 2. TU DUYET KHI DON CON NHO
-- ============================================================
create or replace function public.trg_tu_duyet_don_nho()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_nguong numeric; v_duoi_nguong boolean;
begin
  v_nguong := public.nguong_tu_duyet();
  v_duoi_nguong := (v_nguong > 0
                    and coalesce(new.total_amount, 0) > 0
                    and new.total_amount < v_nguong);

  -- Don nho: kinh doanh gui la thanh da duyet, xuong San xuat luon
  if new.status = 'pending_accounting' and v_duoi_nguong then
    new.status        := 'approved';
    new.approved_at   := now();
    new.approved_by   := null;      -- khong ai duyet ca, he thong tu duyet
    new.reject_reason := null;

    insert into public.audit_log(table_name, record_id, action, actor_id, note)
    values ('orders', new.id, 'UPDATE', auth.uid(),
            'Tu duyet don ' || coalesce(new.order_code, '?') || ' (' ||
            to_char(new.total_amount, 'FM999,999,999,999') ||
            ' dong, duoi nguong ' || to_char(v_nguong, 'FM999,999,999,999') ||
            ') — xuong San xuat khong qua Ke toan');
  end if;

  -- Chot chan: kinh doanh khong duoc tu dat trang thai da duyet cho don to.
  -- Chi hop le khi la ket qua cua co che tu duyet o tren.
  if public.app_role() = 'sales' and new.status = 'approved'
     and (tg_op = 'INSERT' or old.status is distinct from 'approved')
     and not v_duoi_nguong then
    raise exception
      'Don tu % dong tro len phai qua Ke toan duyet.',
      to_char(v_nguong, 'FM999,999,999,999');
  end if;

  return new;
end $$;

drop trigger if exists tr_tu_duyet_don_nho on public.orders;
create trigger tr_tu_duyet_don_nho
before insert or update on public.orders
for each row execute function public.trg_tu_duyet_don_nho();

-- ---------- Mo RLS cho trang thai 'approved' do tu duyet sinh ra ----------
-- Chot chan that nam o trigger o tren, khong phai o policy.
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert to authenticated
  with check (
    (public.is_role('sales') and sales_id = auth.uid()
     and status in ('draft','pending_accounting','approved'))
    or public.is_role('management')
  );

drop policy if exists orders_update_sales on public.orders;
create policy orders_update_sales on public.orders
  for update to authenticated
  using (public.is_role('sales') and sales_id = auth.uid()
         and status in ('draft','pending_accounting','rejected'))
  with check (public.is_role('sales') and sales_id = auth.uid()
         and status in ('draft','pending_accounting','rejected','cancelled','approved'));

-- ---------- Vi sao recalc KHONG tu duyet ----------
-- recalc chay sau TUNG DONG hang hoa. Neu no doi trang thai ngay sau dong
-- dau tien, dong thu hai se bi RLS chan (khong duoc them hang vao don da
-- duyet). Vi vay quyet dinh duyet chi xay ra o dung mot cho: trigger tren
-- bang orders khi trang thai chuyen sang 'pending_accounting'.
-- Kinh doanh luu don o trang thai nhap -> them du hang -> moi gui duyet.

-- ============================================================
-- 3. TIEN CHUYEN KHOAN VAO SO NGAY, TIEN MAT VAN CHO XAC NHAN
-- ============================================================
create or replace function public.trg_payment_dat_trang_thai()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pt text;
begin
  -- But toan do chinh he thong sinh (coc chuyen khoan luc lap don):
  -- da co day du thong tin, khong phai kiem lai nhu thao tac thu cong.
  if coalesce(current_setting('qlsx.he_thong', true), '') = 'on' then
    return new;
  end if;

  if public.app_role() = 'sales' then
    if not exists (select 1 from public.orders o
                    where o.id = new.order_id and o.sales_id = auth.uid()) then
      raise exception 'Chi duoc ghi nhan tien ve cho don hang cua minh.';
    end if;

    if not exists (select 1 from public.orders o
                    where o.id = new.order_id
                      and o.status in ('approved','in_production','completed','delivered')) then
      raise exception 'Don chua duoc duyet (hoac da huy) nen chua ghi nhan tien duoc.';
    end if;

    if new.amount <= 0 then
      raise exception 'Kinh doanh chi ghi duoc tien khach tra. Khoan hoan tra do Ke toan ghi.';
    end if;

    v_pt := lower(coalesce(new.method, ''));

    if v_pt like '%tien mat%' or v_pt like '%tiền mặt%' then
      -- TIEN MAT: khong co gi doi chieu -> van la loi khai, cho Ke toan dem tien
      new.bank_txn_id  := null;
      if coalesce(btrim(new.note), '') = '' then
        raise exception 'Thu tien mat thi phai ghi dien giai (ai dua, dua o dau) de Ke toan doi chieu.';
      end if;
      new.confirmed    := false;
      new.confirmed_at := null;
      new.confirmed_by := null;
    else
      -- CHUYEN KHOAN: bang ke ngan hang la chung cu -> vao so ngay
      if new.bank_txn_id is null then
        raise exception 'Chon khoan tien ve tu bang ke ngan hang truoc khi luu.';
      end if;
      new.confirmed    := true;
      new.confirmed_at := now();
      new.confirmed_by := auth.uid();
    end if;

    new.created_by := auth.uid();
    new.reconciled := (new.bank_txn_id is not null);
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
-- 4. COC CHUYEN KHOAN LUC LAP DON -> SINH BUT TOAN NGAY
-- ============================================================
-- Kinh doanh chon khoan trong bang ke ngay tu luc lap don thi khong
-- can Ke toan bam xac nhan nua: tao luon but toan dat coc da vao so.
create or replace function public.trg_coc_ck_vao_so()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ref text; v_bank text; v_acc text; v_ngay date; v_noidung text;
begin
  if new.deposit_bank_txn_id is null
     or coalesce(new.deposit_expected, 0) <= 0
     or new.deposit_confirmed then
    return new;
  end if;

  -- Da co but toan gan voi khoan nay cho don nay roi thi thoi
  if exists (select 1 from public.payments p
              where p.order_id = new.id
                and p.bank_txn_id = new.deposit_bank_txn_id
                and not p.voided) then
    update public.orders set deposit_confirmed = true where id = new.id;
    return new;
  end if;

  select bank_ref, bank_name, account_no, posting_date, content
    into v_ref, v_bank, v_acc, v_ngay, v_noidung
    from public.bank_transactions where id = new.deposit_bank_txn_id;

  -- Danh dau day la but toan he thong sinh, chi trong giao dich nay
  perform set_config('qlsx.he_thong', 'on', true);

  insert into public.payments (order_id, payment_type, amount, payment_date,
                               method, reference_no, transfer_note, bank_account,
                               note, bank_txn_id, created_by,
                               confirmed, confirmed_at, confirmed_by, reconciled)
  values (new.id, 'deposit', new.deposit_expected, coalesce(v_ngay, current_date),
          'Chuyển khoản', v_ref, v_noidung, btrim(coalesce(v_bank,'') || ' ' || coalesce(v_acc,'')),
          coalesce(new.deposit_note, 'Tiền cọc khách chuyển khi đặt hàng'),
          new.deposit_bank_txn_id, coalesce(new.sales_id, auth.uid()),
          true, now(), coalesce(new.sales_id, auth.uid()), true);

  perform set_config('qlsx.he_thong', 'off', true);

  update public.orders set deposit_confirmed = true where id = new.id;
  return new;
end $$;

drop trigger if exists tr_coc_ck_vao_so on public.orders;
create trigger tr_coc_ck_vao_so
after insert or update of deposit_bank_txn_id, deposit_expected on public.orders
for each row execute function public.trg_coc_ck_vao_so();

-- ============================================================
-- 5. DANH SACH CHO XAC NHAN — gio chi con TIEN MAT
-- ============================================================
drop view if exists public.v_but_toan_cho_xac_nhan;
create view public.v_but_toan_cho_xac_nhan
with (security_invoker = on) as
select
  p.id, p.order_id, p.amount, p.payment_date, p.payment_type,
  p.method, p.reference_no, p.transfer_note, p.note, p.created_at,
  o.order_code, o.customer_name, o.total_amount, o.paid_amount, o.debt_amount,
  u.full_name  as nguoi_ghi,
  b.bank_ref, b.amount_in as so_tien_ve, b.counterparty, b.content as noi_dung_ck,
  case when b.id is null then null
       else b.amount_in - public.tien_da_phan_bo(b.id) end as con_lai_cua_khoan
from public.payments p
join public.orders o on o.id = p.order_id
left join public.users u on u.id = p.created_by
left join public.bank_transactions b on b.id = p.bank_txn_id
where not p.confirmed and not p.voided;

comment on view public.v_but_toan_cho_xac_nhan is
  'Chi con khoan TIEN MAT kinh doanh khai. Chuyen khoan da vao so ngay.';

grant select on public.v_but_toan_cho_xac_nhan to authenticated;

-- ============================================================
-- 6. AP DUNG NGAY CHO CAC DON DANG CHO DUYET MA NHO HON NGUONG
-- ============================================================
do $$
declare r record; v_nguong numeric := public.nguong_tu_duyet();
begin
  if v_nguong > 0 then
    for r in select id, order_code, total_amount from public.orders
              where status = 'pending_accounting'
                and total_amount > 0 and total_amount < v_nguong loop
      update public.orders
         set status = 'approved', approved_at = now(), reject_reason = null
       where id = r.id;

      insert into public.audit_log(table_name, record_id, action, note)
      values ('orders', r.id, 'UPDATE',
              'Tu duyet don ' || r.order_code || ' (' ||
              to_char(r.total_amount, 'FM999,999,999,999') || ' dong) — duoi nguong tu duyet');
    end loop;
  end if;
end $$;

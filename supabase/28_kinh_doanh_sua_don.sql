-- ============================================================
-- 28_kinh_doanh_sua_don.sql
-- Kinh doanh sua duoc don CHO TOI TRUOC KHI GIAO HANG.
-- ------------------------------------------------------------
-- Thuc te xuong in: khach doi so luong, doi kich thuoc, chot lai gia
-- sau khi don da xuong San xuat la chuyen thuong ngay. Bat lam don moi
-- vua mat so lieu vua sai thuc te.
--
-- Doi lai, moi lan sua sau khi don da duyet deu de lai dau vet:
--   * Ghi nhat ky: ai sua, luc nao, tong tien tu bao nhieu thanh bao nhieu
--   * Danh dau don la 'da sua sau duyet' de Ke toan / Giam doc nhin thay
--   * Don da duyet tu dong ma sua vuot nguong -> tra ve Ke toan duyet lai
--   * Don DA GIAO thi khoa hoan toan — luc do da co cong no, sua la lech so
--
-- Chay 1 lan trong SQL Editor (sau 27).
-- ============================================================

-- ============================================================
-- 1. DAU VET SUA SAU DUYET
-- ============================================================
alter table public.orders
  add column if not exists sua_sau_duyet_at timestamptz,
  add column if not exists sua_sau_duyet_by uuid references public.users(id) on delete set null,
  add column if not exists so_lan_sua      int not null default 0;

comment on column public.orders.sua_sau_duyet_at is
  'Lan gan nhat don bi sua sau khi da duyet. Null = chua ai dong vao sau duyet.';

-- ============================================================
-- 2. TRANG THAI NAO CON SUA DUOC
-- ============================================================
-- Sua duoc:   nhap, cho duyet, tra lai, da duyet, dang san xuat, xong hang
-- Khong sua:  da giao (co cong no roi), da huy
create or replace function public.don_con_sua_duoc(p_status public.order_status)
returns boolean
language sql immutable as $$
  select p_status in ('draft','pending_accounting','rejected',
                      'approved','in_production','completed')
$$;

grant execute on function public.don_con_sua_duoc(public.order_status) to authenticated;

-- ---------- RLS don hang ----------
drop policy if exists orders_update_sales on public.orders;
create policy orders_update_sales on public.orders
  for update to authenticated
  using (public.is_role('sales') and sales_id = auth.uid()
         and public.don_con_sua_duoc(status))
  with check (public.is_role('sales') and sales_id = auth.uid()
         and (public.don_con_sua_duoc(status) or status = 'cancelled'));

-- ---------- RLS dong hang hoa ----------
drop policy if exists items_write on public.order_items;
create policy items_write on public.order_items
  for insert to authenticated
  with check (exists (
    select 1 from public.orders o
    where o.id = order_id
      and (public.is_role('management')
           or (public.is_role('sales') and o.sales_id = auth.uid()
               and public.don_con_sua_duoc(o.status)))
  ));

drop policy if exists items_update on public.order_items;
create policy items_update on public.order_items
  for update to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id
      and (public.is_role('management')
           or (public.is_role('sales') and o.sales_id = auth.uid()
               and public.don_con_sua_duoc(o.status)))));

drop policy if exists items_delete on public.order_items;
create policy items_delete on public.order_items
  for delete to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id
      and (public.is_role('management')
           or (public.is_role('sales') and o.sales_id = auth.uid()
               and public.don_con_sua_duoc(o.status)))));

-- ---------- RLS file thiet ke ----------
drop policy if exists files_insert on public.order_files;
create policy files_insert on public.order_files
  for insert to authenticated
  with check (exists (
    select 1 from public.orders o where o.id = order_id
      and (public.is_role('management','accounting')
           or (public.is_role('sales') and o.sales_id = auth.uid()
               and public.don_con_sua_duoc(o.status)))));

drop policy if exists files_update on public.order_files;
create policy files_update on public.order_files
  for update to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id
      and (public.is_role('management','accounting')
           or (public.is_role('sales') and o.sales_id = auth.uid()
               and public.don_con_sua_duoc(o.status)))));

drop policy if exists files_delete on public.order_files;
create policy files_delete on public.order_files
  for delete to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id
      and (public.is_role('management','accounting')
           or (public.is_role('sales') and o.sales_id = auth.uid()
               and public.don_con_sua_duoc(o.status)))));

-- ============================================================
-- 3. SUA SAU DUYET -> GHI NHAT KY, VUOT NGUONG THI DUYET LAI
-- ============================================================
-- Chay SAU recalc nen new.total_amount da la so tien moi.
create or replace function public.trg_theo_doi_sua_don()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_nguong numeric; v_vai text;
begin
  -- Chi quan tam khi TONG TIEN doi, va don da qua khau duyet
  if new.total_amount is not distinct from old.total_amount then
    return new;
  end if;

  -- Trang thai trung gian luc dang ghi lai dong hang (da xoa, chua chen)
  -- khong phai la mot lan sua that su.
  if coalesce(new.total_amount, 0) = 0
     and not exists (select 1 from public.order_items where order_id = new.id) then
    return new;
  end if;
  if old.status not in ('approved','in_production','completed') then
    return new;
  end if;

  v_vai := coalesce(public.app_role()::text, 'he_thong');

  new.sua_sau_duyet_at := now();
  new.sua_sau_duyet_by := auth.uid();
  new.so_lan_sua       := coalesce(old.so_lan_sua, 0) + 1;

  insert into public.audit_log(table_name, record_id, action, actor_id, note)
  values ('orders', new.id, 'UPDATE', auth.uid(),
          'Sua don ' || coalesce(new.order_code, '?') || ' sau khi da duyet (' || v_vai || '): tong tien '
          || to_char(coalesce(old.total_amount, 0), 'FM999,999,999,999') || ' -> '
          || to_char(coalesce(new.total_amount, 0), 'FM999,999,999,999') || ' dong'
          || case when coalesce(old.paid_amount, 0) > 0
                  then '. Don da thu ' || to_char(old.paid_amount, 'FM999,999,999,999') || ' dong — kiem lai cong no.'
                  else '' end);

  -- Don TU DUYET (khong ai duyet tay) ma sua vuot nguong thi phai duyet lai.
  -- Chi ap dung khi San xuat CHUA bat tay vao lam, tranh keo don dang chay ra khoi bang.
  v_nguong := public.nguong_tu_duyet();
  if old.status = 'approved'
     and old.approved_by is null
     and v_nguong > 0
     and new.total_amount >= v_nguong then
    new.status := 'pending_accounting';
    new.approved_at := null;

    insert into public.audit_log(table_name, record_id, action, actor_id, note)
    values ('orders', new.id, 'UPDATE', auth.uid(),
            'Don ' || coalesce(new.order_code, '?') || ' sua len '
            || to_char(new.total_amount, 'FM999,999,999,999')
            || ' dong, vuot nguong tu duyet — tra ve Ke toan duyet lai');
  end if;

  return new;
end $$;

drop trigger if exists tr_theo_doi_sua_don on public.orders;
create trigger tr_theo_doi_sua_don
before update on public.orders
for each row execute function public.trg_theo_doi_sua_don();

-- ============================================================
-- 4. CHAN SUA DON DA GIAO / DA HUY (chac an hai lop)
-- ============================================================
create or replace function public.trg_khoa_don_da_giao()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_status public.order_status; v_code text; v_order uuid;
begin
  -- Trong trigger DELETE thi NEW chua duoc gan, khong duoc dung toi
  if tg_op = 'DELETE' then v_order := old.order_id;
  else                     v_order := new.order_id;
  end if;

  select status, order_code into v_status, v_code
    from public.orders where id = v_order;

  if public.app_role() = 'sales' and not public.don_con_sua_duoc(v_status) then
    raise exception
      'Don % da giao hang (hoac da huy) nen khong sua duoc nua. Can dieu chinh thi bao Ke toan.',
      coalesce(v_code, '?');
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists tr_khoa_items_da_giao on public.order_items;
create trigger tr_khoa_items_da_giao
before insert or update or delete on public.order_items
for each row execute function public.trg_khoa_don_da_giao();

-- ============================================================
-- 5. DANH SACH DON BI SUA SAU DUYET — de Ke toan / Giam doc soi lai
-- ============================================================
drop view if exists public.v_don_sua_sau_duyet;
create view public.v_don_sua_sau_duyet
with (security_invoker = on) as
select
  o.id, o.order_code, o.customer_name, o.status,
  o.total_amount, o.paid_amount, o.debt_amount,
  o.so_lan_sua, o.sua_sau_duyet_at,
  s.full_name as nvkd,
  u.full_name as nguoi_sua,
  e.short_name as don_vi
from public.orders o
left join public.users s on s.id = o.sales_id
left join public.users u on u.id = o.sua_sau_duyet_by
left join public.issuing_entities e on e.id = o.entity_id
where o.sua_sau_duyet_at is not null
  and o.status <> 'cancelled';

comment on view public.v_don_sua_sau_duyet is
  'Don bi sua tong tien sau khi da duyet. Cot so_lan_sua cang cao cang dang soi.';

grant select on public.v_don_sua_sau_duyet to authenticated;


-- ============================================================
-- 6. GHI LAI TOAN BO DONG HANG TRONG MOT GIAO DICH
-- ============================================================
-- Neu lam hai buoc roi (xoa het roi chen lai) tu phia trinh duyet,
-- ma buoc chen loi giua chung thi don mat sach hang hoa.
-- Ham nay chay tron ven hoac khong chay gi ca.
create or replace function public.ghi_lai_dong_hang(p_order uuid, p_items jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare v_status public.order_status; v_sales uuid; v_code text;
begin
  select status, sales_id, order_code into v_status, v_sales, v_code
    from public.orders where id = p_order;

  if v_code is null then
    raise exception 'Don hang khong ton tai.';
  end if;

  if public.is_role('sales') then
    if v_sales <> auth.uid() then
      raise exception 'Chi sua duoc don hang cua minh.';
    end if;
    if not public.don_con_sua_duoc(v_status) then
      raise exception 'Don % da giao hang (hoac da huy) nen khong sua duoc nua.', v_code;
    end if;
  elsif not public.is_role('accounting','management') then
    raise exception 'Ban khong co quyen sua don hang.';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Don hang phai con it nhat mot dong hang hoa.';
  end if;

  delete from public.order_items where order_id = p_order;

  insert into public.order_items
    (order_id, line_no, item_code, item_name, quantity, unit, unit_price, vat_rate, delivery_date)
  select
    p_order,
    (ord)::int,
    nullif(x->>'item_code', ''),
    x->>'item_name',
    (x->>'quantity')::numeric,
    coalesce(nullif(x->>'unit', ''), 'Cai'),
    (x->>'unit_price')::numeric,
    coalesce((x->>'vat_rate')::numeric, 0),
    nullif(x->>'delivery_date', '')::date
  from jsonb_array_elements(p_items) with ordinality as t(x, ord);

  perform public.recalc_order_totals(p_order);
end $$;

grant execute on function public.ghi_lai_dong_hang(uuid, jsonb) to authenticated;

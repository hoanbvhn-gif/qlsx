-- ============================================================
-- 14_xoa_don_hang.sql
-- Cho Ban Giam doc XOA DON HANG (don demo, don nhap sai) va ghi nhat ky.
-- Kinh doanh van chi xoa duoc don NHAP cua chinh minh.
-- Chay 1 lan trong SQL Editor (sau 13).
-- ============================================================

alter table public.orders
  add column if not exists delete_reason text;

-- ---------- Nhat ky cho don hang ----------
create or replace function public.trg_audit_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_log(table_name, record_id, action, actor_id, old_data, note)
    values ('orders', old.id, 'DELETE', auth.uid(),
            to_jsonb(old),
            'XOA don hang ' || old.order_code || ' — ' || coalesce(old.customer_name, '')
            || ' — ' || to_char(old.total_amount, 'FM999,999,999,999') || ' d — '
            || coalesce(old.delete_reason, 'khong ghi ly do'));
    return old;

  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.audit_log(table_name, record_id, action, actor_id, old_data, new_data, note)
    values ('orders', new.id, 'UPDATE', auth.uid(),
            jsonb_build_object('status', old.status, 'order_code', old.order_code),
            jsonb_build_object('status', new.status, 'order_code', new.order_code),
            'Don ' || new.order_code || ': ' || old.status || ' -> ' || new.status);
    return new;
  end if;
  return new;
end $$;

drop trigger if exists tr_audit_order_del on public.orders;
create trigger tr_audit_order_del after delete on public.orders
for each row execute function public.trg_audit_order();

drop trigger if exists tr_audit_order_upd on public.orders;
create trigger tr_audit_order_upd after update on public.orders
for each row execute function public.trg_audit_order();

-- ---------- Quyen xoa ----------
-- Giam doc: xoa moi don. Kinh doanh: chi don nhap cua chinh minh.
drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders
  for delete to authenticated
  using (
    public.is_role('management')
    or (public.is_role('sales') and sales_id = auth.uid() and status = 'draft')
  );

-- Xoa don se keo theo order_items, order_files, payments (ON DELETE CASCADE).
-- Trigger nhat ky cua payments van chay -> tung but toan bi xoa deu duoc ghi lai.

-- ---------- View danh sach don cho Ban Giam doc ----------
drop view if exists public.v_tat_ca_don_hang;
create view public.v_tat_ca_don_hang
with (security_invoker = on) as
select
  o.id as order_id, o.order_code, o.order_date, o.status,
  o.customer_id, o.customer_name, c.customer_code, c.tax_code,
  o.sales_id, u.full_name as sales_name,
  o.subtotal, o.vat_amount, o.total_amount, o.paid_amount, o.debt_amount, o.is_settled,
  o.estimated_delivery_date, o.approved_at, o.completed_at, o.delivered_at, o.created_at,
  (select count(*) from public.order_items i where i.order_id = o.id) as so_dong_hang,
  (select count(*) from public.order_files f where f.order_id = o.id) as so_file_thiet_ke,
  (select count(*) from public.payments  p where p.order_id = o.id and not p.voided) as so_but_toan
from public.orders o
left join public.customers c on c.id = o.customer_id
left join public.users     u on u.id = o.sales_id;

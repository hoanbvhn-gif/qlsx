-- ============================================================
-- 16_quan_ly_nhan_su.sql
-- Ho tro quan ly nhan su: xem so lieu rang buoc truoc khi xoa.
-- ------------------------------------------------------------
-- Nguyen tac: nhan vien DA PHAT SINH du lieu (lap don, ghi thu tien)
-- thi KHONG duoc xoa — neu xoa se mat dau vet ai lap don, ai thu tien.
-- Truong hop nghi viec: dung KHOA TAI KHOAN, ho van khong dang nhap duoc
-- ma so lieu lich su van nguyen ven.
-- Chay 1 lan trong SQL Editor (sau 15).
-- ============================================================

drop view if exists public.v_nhan_su;
create view public.v_nhan_su
with (security_invoker = on) as
select
  u.id, u.username, u.email, u.full_name, u.employee_code, u.phone,
  u.role, u.is_active, u.created_at,
  (select count(*) from public.orders   o where o.sales_id    = u.id) as so_don,
  (select count(*) from public.payments p where p.created_by  = u.id) as so_but_toan,
  (select count(*) from public.orders   o where o.approved_by = u.id) as so_don_da_duyet,
  (select coalesce(sum(o.total_amount),0) from public.orders o
     where o.sales_id = u.id and o.status not in ('draft','cancelled'))        as doanh_thu,
  -- Chi xoa duoc khi chua dinh den bat cu du lieu nghiep vu nao
  (
    not exists (select 1 from public.orders   o where o.sales_id    = u.id) and
    not exists (select 1 from public.orders   o where o.approved_by = u.id) and
    not exists (select 1 from public.payments p where p.created_by  = u.id)
  ) as co_the_xoa
from public.users u;

comment on view public.v_nhan_su is
  'Danh sach nhan su kem so lieu rang buoc — dung de biet ai xoa duoc, ai chi nen khoa';

-- Quyen xoa ho so nhan su: chi Ban Giam doc (da co tu 02_rls, khai lai cho chac)
drop policy if exists users_delete on public.users;
create policy users_delete on public.users
  for delete to authenticated using (public.is_role('management'));

-- Ghi nhat ky khi xoa hoac doi vai tro nhan su
create or replace function public.trg_audit_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_log(table_name, record_id, action, actor_id, old_data, note)
    values ('users', old.id, 'DELETE', auth.uid(), to_jsonb(old),
            'XOA nhan su ' || old.full_name || ' (' || old.username || ') — vai tro ' || old.role);
    return old;
  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      insert into public.audit_log(table_name, record_id, action, actor_id, old_data, new_data, note)
      values ('users', new.id, 'UPDATE', auth.uid(),
              jsonb_build_object('role', old.role, 'full_name', old.full_name),
              jsonb_build_object('role', new.role, 'full_name', new.full_name),
              'Doi vai tro ' || new.full_name || ': ' || old.role || ' -> ' || new.role);
    elsif new.is_active is distinct from old.is_active then
      insert into public.audit_log(table_name, record_id, action, actor_id, note)
      values ('users', new.id, 'UPDATE', auth.uid(),
              (case when new.is_active then 'Mo khoa' else 'KHOA' end)
              || ' tai khoan ' || new.full_name);
    end if;
    return new;
  end if;
  return new;
end $$;

drop trigger if exists tr_audit_user_del on public.users;
create trigger tr_audit_user_del after delete on public.users
for each row execute function public.trg_audit_user();

drop trigger if exists tr_audit_user_upd on public.users;
create trigger tr_audit_user_upd after update on public.users
for each row execute function public.trg_audit_user();

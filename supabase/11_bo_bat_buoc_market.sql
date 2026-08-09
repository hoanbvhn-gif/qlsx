-- ============================================================
-- 11_bo_bat_buoc_market.sql
-- Bo rang buoc "phai co file thiet ke Market moi gui duyet".
-- Ly do thuc te: file .cdr/.pdf kho in rat nang, Kinh doanh can gui don
-- truoc de San xuat va Ke toan xu ly, thiet ke bo sung sau.
-- Giao dien van hien canh bao mem de khong ai quen.
-- Chay 1 lan trong SQL Editor (sau 10).
-- ============================================================

-- 1. Go rang buoc o tang bang
alter table public.orders drop constraint if exists chk_design_required;

-- 2. Go loi chan trong trigger dong dau trang thai
create or replace function public.trg_order_status_stamp()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'pending_accounting' then
      -- Khong con bat buoc co thiet ke. Chi ghi nhan thoi diem gui.
      new.submitted_at := now();
    elsif new.status = 'approved' then
      new.approved_at := now();
      new.approved_by := auth.uid();
    elsif new.status = 'in_production' then
      new.production_started_at := coalesce(new.production_started_at, now());
    elsif new.status = 'completed' then
      new.completed_at := coalesce(new.completed_at, now());
    elsif new.status = 'delivered' then
      new.delivered_at := coalesce(new.delivered_at, now());
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists tr_order_status on public.orders;
create trigger tr_order_status before update on public.orders
for each row execute function public.trg_order_status_stamp();

-- 3. Danh dau don dang thieu thiet ke de dashboard nhac nho
create or replace view public.v_orders_thieu_thiet_ke
with (security_invoker = on) as
select o.id, o.order_code, o.order_date, o.status, o.customer_name,
       o.total_amount, u.full_name as sales_name
from public.orders o
left join public.users u on u.id = o.sales_id
where o.status not in ('draft','cancelled')
  and o.design_file_path is null
  and not exists (select 1 from public.order_files f where f.order_id = o.id);

comment on view public.v_orders_thieu_thiet_ke is
  'Don da gui di nhung chua co file thiet ke Market — dung de nhac bo sung';

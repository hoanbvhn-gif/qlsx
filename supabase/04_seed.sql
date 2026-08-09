-- ============================================================
-- 04_seed.sql  |  Tao tai khoan Giam doc dau tien + du lieu mau
-- ============================================================
-- BUOC 1 (lam tren giao dien):
--   Dashboard > Authentication > Users > Add user
--   Email: giamdoc@congty.local   Password: <tu dat>   -> tich "Auto Confirm User"
--   Trigger tr_auth_user_created se tu tao dong trong public.users voi role 'sales'.
--
-- BUOC 2: nang quyen cho tai khoan do
update public.users
   set role = 'management', full_name = 'Giam doc', employee_code = 'GD001'
 where email = 'giamdoc@congty.local';

-- BUOC 3 (tuy chon): khach hang mau
insert into public.customers (customer_code, name, tax_code, address, phone)
values
  ('KH001','Cong ty TNHH Thuong mai An Phat','0101234567','So 12 Nguyen Trai, Ha Noi','0912345678'),
  ('KH002','Cong ty CP Bao bi Minh Long','0312345678','KCN Tan Binh, TP.HCM','0987654321')
on conflict (customer_code) do nothing;

-- Kiem tra nhanh
-- select id, username, email, full_name, role from public.users;

-- ============================================================
-- 17_ma_khach_hang.sql
-- Sinh ma khach hang tu dong, tranh loi trung ma khi lap don.
-- ------------------------------------------------------------
-- Truoc day o "Ma khach hang" de trong, nhan vien tu nghi ra ma
-- -> go trung ma da co -> loi "duplicate key ... customers_customer_code_key".
-- Nay he thong tu cap ma tiep theo, nhan vien khong phai nho.
-- Chay 1 lan trong SQL Editor (sau 16).
-- ============================================================

-- Sinh ma tiep theo dang KH001, KH002... dua tren ma lon nhat dang co
create or replace function public.next_customer_code()
returns text
language sql stable security definer set search_path = public as $$
  select 'KH' || lpad((
    coalesce(max(nullif(regexp_replace(customer_code, '^KH', ''), '')::int), 0) + 1
  )::text, 3, '0')
  from public.customers
  where customer_code ~ '^KH[0-9]+$'
$$;

grant execute on function public.next_customer_code() to authenticated;

-- Tim khach theo ma — dung de kiem tra truoc khi tao moi
create or replace function public.tim_khach_theo_ma(p_code text)
returns table (id uuid, customer_code text, name text, tax_code text, address text, phone text)
language sql stable security definer set search_path = public as $$
  select c.id, c.customer_code, c.name, c.tax_code, c.address, c.phone
  from public.customers c
  where upper(btrim(c.customer_code)) = upper(btrim(p_code))
  limit 1
$$;

grant execute on function public.tim_khach_theo_ma(text) to authenticated;

-- Chuan hoa: ma khach hang luon viet hoa, khong khoang trang thua
create or replace function public.trg_chuan_hoa_khach()
returns trigger language plpgsql as $$
begin
  new.customer_code := upper(btrim(new.customer_code));
  new.name          := btrim(new.name);
  new.tax_code      := nullif(btrim(coalesce(new.tax_code, '')), '');
  new.phone         := nullif(btrim(coalesce(new.phone, '')), '');
  new.updated_at    := now();
  return new;
end $$;

drop trigger if exists tr_chuan_hoa_khach on public.customers;
create trigger tr_chuan_hoa_khach before insert or update on public.customers
for each row execute function public.trg_chuan_hoa_khach();

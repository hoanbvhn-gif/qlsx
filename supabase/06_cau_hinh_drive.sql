-- ============================================================
-- 06_cau_hinh_drive.sql
-- Bang cau hinh he thong + khai bao thu muc goc Google Drive
-- Chay 1 lan trong SQL Editor (sau 05).
-- ============================================================

create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  label      text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null
);

comment on table public.app_settings is 'Cau hinh chung toan he thong (link Drive, quy tac dat ten thu muc...)';

insert into public.app_settings (key, value, label) values
  ('drive_root_url',   '', 'Link thu muc goc Google Drive chua file thiet ke Market'),
  ('drive_pattern',    '{order_code}', 'Quy tac dat ten thu muc cho moi don hang'),
  ('company_name',     '', 'Ten cong ty hien thi tren he thong')
on conflict (key) do nothing;

-- Tu cap nhat moc thoi gian
create or replace function public.trg_settings_stamp()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists tr_settings_stamp on public.app_settings;
create trigger tr_settings_stamp before update on public.app_settings
for each row execute function public.trg_settings_stamp();

-- ---------- RLS ----------
alter table public.app_settings enable row level security;

-- Moi nhan vien deu can DOC cau hinh (de biet link Drive)
drop policy if exists settings_select on public.app_settings;
create policy settings_select on public.app_settings
  for select to authenticated using (true);

-- Chi Giam doc va Ke toan duoc SUA
drop policy if exists settings_update on public.app_settings;
create policy settings_update on public.app_settings
  for update to authenticated
  using (public.is_role('management','accounting'))
  with check (public.is_role('management','accounting'));

drop policy if exists settings_insert on public.app_settings;
create policy settings_insert on public.app_settings
  for insert to authenticated
  with check (public.is_role('management','accounting'));

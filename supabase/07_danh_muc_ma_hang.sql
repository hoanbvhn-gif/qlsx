-- ============================================================
-- 07_danh_muc_ma_hang.sql   |  Danh muc ma hang
-- ------------------------------------------------------------
-- CAU TRUC MA:  [Chat lieu 2][Gia cong 2][Do day 3][Kich thuoc 3]
--               AL   AM   050  001   ->  ALAM050001
--
-- Do day = mm x 100  (0.5mm -> 050 ; 0.65mm -> 065 ; 3.0mm -> 300)
--          => het nhap nhang giua 05 va 065 nhu cach danh cu.
-- Kich thuoc = so thu tu 3 chu so, them co moi chi can them 1 dong.
-- Chat lieu ep cung 2 ky tu => ALU doi thanh AU, tranh nhap nhang voi AL.
--
-- Ma hang do Kinh doanh/Ke toan DE XUAT, chi Ban Giam doc DUYET.
-- Chay 1 lan trong SQL Editor (sau 06).
-- ============================================================

do $$ begin
  create type public.item_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

-- ---------- 1. CHAT LIEU (2 ky tu) ----------
create table if not exists public.item_materials (
  code       char(2) primary key,
  name       text not null,
  sort_order int  not null default 100,
  is_active  boolean not null default true
);

-- ---------- 2. KIEU GIA CONG (2 ky tu) ----------
create table if not exists public.item_processes (
  code       char(2) primary key,
  name       text not null,
  sort_order int  not null default 100,
  is_active  boolean not null default true
);

-- ---------- 3. DO DAY (3 chu so = mm x 100) ----------
create table if not exists public.item_thicknesses (
  code       char(3) primary key,
  value_mm   numeric(6,2) not null,
  name       text not null,
  sort_order int  not null default 100,
  is_active  boolean not null default true
);

-- ---------- 4. KICH THUOC (3 chu so) ----------
create table if not exists public.item_sizes (
  code       char(3) primary key,
  name       text not null,          -- '40x160mm'
  width_mm   numeric(10,2),
  height_mm  numeric(10,2),
  sort_order int  not null default 100,
  is_active  boolean not null default true
);

-- ---------- 5. MA HANG ----------
create table if not exists public.items (
  id             uuid primary key default gen_random_uuid(),
  material_code  char(2) not null references public.item_materials(code)   on update cascade,
  process_code   char(2) not null references public.item_processes(code)   on update cascade,
  thickness_code char(3) not null references public.item_thicknesses(code) on update cascade,
  size_code      char(3) not null references public.item_sizes(code)       on update cascade,

  -- Ma hang tu ghep tu 4 doan -> khong bao gio go sai
  item_code text generated always as
    (material_code || process_code || thickness_code || size_code) stored,

  item_name  text not null,
  unit       text not null default 'Cái',
  list_price numeric(18,2) not null default 0,   -- don gia niem yet
  note       text,

  status      public.item_status not null default 'pending',
  is_active   boolean not null default true,
  created_by  uuid references public.users(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  reject_reason text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint uq_items_code unique (item_code),
  constraint uq_items_combo unique (material_code, process_code, thickness_code, size_code)
);
create index if not exists idx_items_status on public.items(status);
create index if not exists idx_items_code   on public.items(item_code);

-- ---------- TRIGGER: ten hang LUON sinh tu ma ----------
-- Ten san pham KHONG cho go tay. Moi ma -> mot ten duy nhat.
--   ALAM050001 -> "Tem nhôm ăn mòn 0.5mm 40x160mm"
--   DCUV000001 -> "Tem decal in UV 40x160mm"   (do day 000 = khong ap dung -> bo qua)
create or replace function public.build_item_name(
  p_material char(2), p_process char(2), p_thickness char(3), p_size char(3))
returns text
language sql stable security definer set search_path = public as $$
  select regexp_replace(btrim(
           'Tem '
           || coalesce(lower(left(m.name,1)) || substr(m.name,2), '') || ' '
           || coalesce(lower(left(p.name,1)) || substr(p.name,2), '') || ' '
           || case when t.code = '000' then '' else coalesce(t.name,'') end || ' '
           || coalesce(z.name,'')
         ), '\s+', ' ', 'g')
  from public.item_materials m, public.item_processes p,
       public.item_thicknesses t, public.item_sizes z
  where m.code = p_material and p.code = p_process
    and t.code = p_thickness and z.code = p_size
$$;

create or replace function public.trg_item_fill()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- luon ghi de: ten hang la he qua cua ma, khong phai o nhap lieu
  new.item_name := coalesce(
    public.build_item_name(new.material_code, new.process_code, new.thickness_code, new.size_code),
    new.item_name);

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status <> 'pending' and public.app_role() <> 'management' then
      raise exception 'Chi Ban Giam doc moi duoc duyet hoac tu choi ma hang';
    end if;
    if new.status = 'approved' then
      new.approved_at := now();
      new.approved_by := auth.uid();
      new.reject_reason := null;
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;

drop trigger if exists tr_item_fill on public.items;
create trigger tr_item_fill before insert or update on public.items
for each row execute function public.trg_item_fill();

grant execute on function public.build_item_name(char, char, char, char) to authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table public.item_materials   enable row level security;
alter table public.item_processes   enable row level security;
alter table public.item_thicknesses enable row level security;
alter table public.item_sizes       enable row level security;
alter table public.items            enable row level security;

-- 4 danh muc con: ai cung DOC duoc, chi Giam doc SUA
do $$
declare t text;
begin
  foreach t in array array['item_materials','item_processes','item_thicknesses','item_sizes'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (true)', t, t);

    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format($f$create policy %I_write on public.%I for all to authenticated
                     using (public.is_role('management')) with check (public.is_role('management'))$f$, t, t);
  end loop;
end $$;

-- items: ai cung DOC; chi KE TOAN de xuat; chi GIAM DOC them thang + duyet + sua
drop policy if exists items_select on public.items;
create policy items_select on public.items
  for select to authenticated using (true);

drop policy if exists items_propose on public.items;
create policy items_propose on public.items
  for insert to authenticated
  with check (
    public.is_role('management')
    or (public.is_role('accounting') and status = 'pending')
  );

drop policy if exists items_update on public.items;
create policy items_update on public.items
  for update to authenticated
  using (public.is_role('management')) with check (public.is_role('management'));

drop policy if exists items_delete on public.items;
create policy items_delete on public.items
  for delete to authenticated using (public.is_role('management'));

-- ============================================================
-- NAP DU LIEU BAN DAU (theo file Ma hang.xlsx cua cong ty)
-- ============================================================
insert into public.item_materials (code, name, sort_order) values
  ('AL','Nhôm',10), ('IN','Inox',20), ('CU','Đồng',30),
  ('MC','Mica',40), ('AU','Alu',50),  ('DC','Decal',60)
on conflict (code) do nothing;

insert into public.item_processes (code, name, sort_order) values
  ('AM','Ăn mòn',10), ('UV','In UV',20)
on conflict (code) do nothing;

insert into public.item_thicknesses (code, value_mm, name, sort_order) values
  ('000',0.00,'Không áp dụng',0),
  ('040',0.40,'0.4mm',40),  ('050',0.50,'0.5mm',50),  ('060',0.60,'0.6mm',60),
  ('065',0.65,'0.65mm',65), ('080',0.80,'0.8mm',80),  ('100',1.00,'1.0mm',100),
  ('120',1.20,'1.2mm',120), ('150',1.50,'1.5mm',150), ('200',2.00,'2.0mm',200),
  ('300',3.00,'3.0mm',300), ('500',5.00,'5.0mm',500)
on conflict (code) do nothing;

insert into public.item_sizes (code, name, width_mm, height_mm, sort_order) values
  ('001','40x160mm',40,160,10)
on conflict (code) do nothing;

-- 38 ma hang hien co -> chuyen sang chuan moi, trang thai da duyet
insert into public.items (material_code, process_code, thickness_code, size_code, item_name, status)
values
  ('AL','AM','050','001','Tem nhôm 40x160mm','approved'),
  ('AL','AM','065','001','Tem nhôm 40x160mm','approved'),
  ('AL','AM','080','001','Tem nhôm 40x160mm','approved'),
  ('AL','AM','100','001','Tem nhôm 40x160mm','approved'),
  ('AL','AM','120','001','Tem nhôm 40x160mm','approved'),
  ('AL','AM','150','001','Tem nhôm 40x160mm','approved'),
  ('AL','AM','200','001','Tem nhôm 40x160mm','approved'),
  ('AL','AM','300','001','Tem nhôm 40x160mm','approved'),
  ('AL','UV','050','001','Tem nhôm 40x160mm','approved'),
  ('AL','UV','065','001','Tem nhôm 40x160mm','approved'),
  ('AL','UV','080','001','Tem nhôm 40x160mm','approved'),
  ('AL','UV','100','001','Tem nhôm 40x160mm','approved'),
  ('AL','UV','120','001','Tem nhôm 40x160mm','approved'),
  ('AL','UV','150','001','Tem nhôm 40x160mm','approved'),
  ('AL','UV','200','001','Tem nhôm 40x160mm','approved'),
  ('AL','UV','300','001','Tem nhôm 40x160mm','approved'),
  ('IN','AM','050','001','Tem inox 40x160mm','approved'),
  ('IN','AM','060','001','Tem inox 40x160mm','approved'),
  ('IN','AM','080','001','Tem inox 40x160mm','approved'),
  ('IN','AM','100','001','Tem inox 40x160mm','approved'),
  ('IN','AM','150','001','Tem inox 40x160mm','approved'),
  ('IN','AM','200','001','Tem inox 40x160mm','approved'),
  ('IN','UV','050','001','Tem inox 40x160mm','approved'),
  ('IN','UV','060','001','Tem inox 40x160mm','approved'),
  ('IN','UV','080','001','Tem inox 40x160mm','approved'),
  ('IN','UV','100','001','Tem inox 40x160mm','approved'),
  ('IN','UV','150','001','Tem inox 40x160mm','approved'),
  ('IN','UV','200','001','Tem inox 40x160mm','approved'),
  ('CU','AM','040','001','Tem đồng 40x160mm','approved'),
  ('CU','AM','100','001','Tem đồng 40x160mm','approved'),
  ('CU','UV','040','001','Tem đồng 40x160mm','approved'),
  ('CU','UV','100','001','Tem đồng 40x160mm','approved'),
  ('MC','UV','200','001','Tem mica 40x160mm','approved'),
  ('MC','UV','300','001','Tem mica 40x160mm','approved'),
  ('MC','UV','500','001','Tem mica 40x160mm','approved'),
  ('AU','UV','200','001','Tem alu 40x160mm','approved'),
  ('AU','UV','300','001','Tem alu 40x160mm','approved'),
  ('DC','UV','000','001','Tem decal 40x160mm','approved')
on conflict (material_code, process_code, thickness_code, size_code) do nothing;

-- Dong bo ten hang cho toan bo ma (ke ca ma da tao truoc do)
update public.items i
   set item_name = public.build_item_name(i.material_code, i.process_code, i.thickness_code, i.size_code)
 where public.build_item_name(i.material_code, i.process_code, i.thickness_code, i.size_code) is not null;

-- Doi chieu nhanh:  select item_code, item_name from public.items order by item_code;

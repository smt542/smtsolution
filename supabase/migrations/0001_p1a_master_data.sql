create type fee_rounding     as enum ('up','round','down','raw');
create type occupancy_status as enum ('occupied','vacant','moving_out');
create type attachment_kind  as enum ('contract','repair','facility','etc');

create table building_types (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  label text not null, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, label));

-- deleted_at: 소프트삭제(재무이력 보존). NULL = 활성. 물리 DELETE 대신 세팅한다.
create table buildings (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  code text not null, name text not null, address text,
  type_id bigint references building_types(id) on delete set null,
  owner_name text, owner_phone text, entrance_password text,
  manager_name text, meter_staff_name text, cleaning_staff_name text, memo text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, code));

create table units (
  id bigint generated always as identity primary key,
  building_id bigint not null references buildings(id) on delete cascade,
  unit_no text not null, dong text, area_pyeong numeric(8,2), room_count int,
  elec_customer_no text, elec_meter_no text, water_customer_no text, memo text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (building_id, unit_no));
create index on units (building_id);

create table occupancies (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  tenant_name text, payer_name text, phone text, resident_count int, vehicle_no text,
  move_in_date date, move_out_date date, deposit numeric(12,0), monthly_rent numeric(12,0),
  status occupancy_status not null default 'occupied', memo text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index on occupancies (unit_id);

create table fee_items (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  type_id bigint not null references building_types(id) on delete cascade,
  name text not null, rounding fee_rounding not null default 'round',
  daily_proration boolean not null default false, carry_over boolean not null default false,
  is_required boolean not null default false, sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (type_id, name));
create index on fee_items (org_id, type_id, sort_order);

create table vendor_categories (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  label text not null, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, label));

create table vendors (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  category_id bigint references vendor_categories(id) on delete set null,
  name text not null, phone text, bank_account text, memo text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index on vendors (org_id, category_id);

create table attachments (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  entity_type text not null, entity_id bigint not null,
  kind attachment_kind not null default 'etc',
  file_url text not null, file_name text, uploaded_by uuid,
  created_at timestamptz not null default now());
create index on attachments (entity_type, entity_id);

-- updated_at triggers (P0 set_updated_at())
do $$ declare t text; begin
  foreach t in array array['building_types','buildings','units','occupancies','fee_items','vendor_categories','vendors'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();', t);
  end loop; end $$;

-- RLS
alter table building_types enable row level security;
alter table buildings enable row level security;
alter table units enable row level security;
alter table occupancies enable row level security;
alter table fee_items enable row level security;
alter table vendor_categories enable row level security;
alter table vendors enable row level security;
alter table attachments enable row level security;

create policy bt_all  on building_types    for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy bld_all on buildings         for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy fi_all  on fee_items         for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy vc_all  on vendor_categories for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy vnd_all on vendors           for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy att_all on attachments       for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy unit_all on units for all
  using (building_id in (select id from buildings where org_id in (select my_org_ids())))
  with check (building_id in (select id from buildings where org_id in (select my_org_ids())));
create policy occ_all on occupancies for all
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));

-- ===== 소프트삭제 RPC (재무이력 보존) =====
-- 물리 DELETE 대신 deleted_at 을 세팅. 하위(호실·입주)까지 한 트랜잭션에서 원자적으로 처리한다.
-- SECURITY INVOKER(기본) → 호출자 RLS가 그대로 적용되어 자기 org 데이터만 삭제된다.
create or replace function soft_delete_building(p_id bigint)
returns void language sql set search_path = public as $$
  update occupancies o set deleted_at = now()
    from units u where u.id = o.unit_id and u.building_id = p_id and o.deleted_at is null;
  update units set deleted_at = now() where building_id = p_id and deleted_at is null;
  update buildings set deleted_at = now() where id = p_id and deleted_at is null;
$$;

create or replace function soft_delete_unit(p_id bigint)
returns void language sql set search_path = public as $$
  update occupancies set deleted_at = now() where unit_id = p_id and deleted_at is null;
  update units set deleted_at = now() where id = p_id and deleted_at is null;
$$;

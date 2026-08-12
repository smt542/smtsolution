-- P3b: 입주자·세대 관리
-- 의존: P1a(units, occupancies, occupancy_status), P2a(current_user_org, current_user_has_module),
--       P2b(room_types), P3a(buildings module RLS 패턴)

-- ===== occupancies 확장 + 레거시 이관 =====
alter table occupancies
  add column phone2 text,
  add column phone3 text,
  add column room_type_id bigint references room_types(id) on delete set null,
  add column billing_enabled  boolean not null default true,
  add column print_enabled    boolean not null default true,
  add column late_fee_enabled boolean not null default true,
  add column single_print     boolean not null default false,
  add column billing_note     text,
  add column settlement_note  text,
  add column facility_note    text,
  drop column deposit,
  drop column monthly_rent;
create index on occupancies (room_type_id);

-- ===== units 레거시 이관 + unit_meters =====
alter table units
  drop column elec_customer_no,
  drop column elec_meter_no,
  drop column water_customer_no;

create table unit_meters (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  utility text not null check (utility in ('water','elec','gas')),
  meter_no text, customer_no text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, utility)
);
create index on unit_meters (unit_id);

create table unit_accounts (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  kind text not null check (kind in ('water','elec','gas','mgmt')),
  bank text, account text, holder text, cms_member_no text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, kind)
);
create index on unit_accounts (unit_id);

create table lease_contracts (
  id bigint generated always as identity primary key,
  occupancy_id bigint not null references occupancies(id) on delete cascade,
  deposit bigint, monthly_rent bigint,
  start_date date, end_date date,
  expiry_alert boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (occupancy_id)
);
create index on lease_contracts (occupancy_id);

create table occupancy_history (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  tenant_name text, move_in_date date, move_out_date date, room_type_label text,
  created_at timestamptz not null default now()
);
create index on occupancy_history (unit_id, move_out_date desc);

-- ===== updated_at 트리거 =====
do $$ declare t text; begin
  foreach t in array array['unit_meters','unit_accounts','lease_contracts'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();', t);
  end loop; end $$;

-- ===== RLS: 신규 자식(select 개방 / write tenants 모듈) =====
alter table unit_meters       enable row level security;
alter table unit_accounts     enable row level security;
alter table lease_contracts   enable row level security;
alter table occupancy_history enable row level security;

create policy um_select on unit_meters for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy um_write on unit_meters for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('tenants'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('tenants'));
create policy ua_select on unit_accounts for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy ua_write on unit_accounts for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('tenants'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('tenants'));
create policy lc_select on lease_contracts for select
  using (occupancy_id in (select o.id from occupancies o join units u on u.id=o.unit_id join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy lc_write on lease_contracts for all
  using      (occupancy_id in (select o.id from occupancies o join units u on u.id=o.unit_id join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('tenants'))
  with check (occupancy_id in (select o.id from occupancies o join units u on u.id=o.unit_id join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('tenants'));
create policy oh_select on occupancy_history for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy oh_write on occupancy_history for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('tenants'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('tenants'));

-- ===== 기존 units·occupancies 쓰기 조이기(P1a 개방 → tenants 모듈) =====
drop policy unit_all on units;
create policy unit_select on units for select
  using (building_id in (select id from buildings where org_id in (select my_org_ids())));
create policy unit_write on units for all
  using      (building_id in (select id from buildings where org_id in (select my_org_ids())) and current_user_has_module('tenants'))
  with check (building_id in (select id from buildings where org_id in (select my_org_ids())) and current_user_has_module('tenants'));
drop policy occ_all on occupancies;
create policy occ_select on occupancies for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy occ_write on occupancies for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('tenants'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('tenants'));

-- ===== 통합 저장 RPC(원자적) =====
create or replace function save_unit_occupancy(
  p_building_id bigint, p_unit_id bigint, p_occupancy_id bigint,
  p_unit jsonb, p_occupancy jsonb, p_meters jsonb, p_accounts jsonb, p_lease jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_unit_id bigint := p_unit_id; v_occ_id bigint := p_occupancy_id; v_item jsonb;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('tenants') then raise exception 'forbidden: tenants required'; end if;
  if not exists (select 1 from buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org'; end if;

  if v_unit_id is null then
    insert into units(building_id, unit_no, dong, area_pyeong, room_count)
      values (p_building_id, p_unit->>'unit_no', p_unit->>'dong',
              nullif(p_unit->>'area_pyeong','')::numeric, nullif(p_unit->>'room_count','')::int)
      returning id into v_unit_id;
  else
    update units set unit_no = coalesce(p_unit->>'unit_no', unit_no),
      dong = coalesce(p_unit->>'dong', dong),
      area_pyeong = coalesce(nullif(p_unit->>'area_pyeong','')::numeric, area_pyeong),
      room_count = coalesce(nullif(p_unit->>'room_count','')::int, room_count)
      where id = v_unit_id and building_id = p_building_id;
    if not found then raise exception 'unit not in building'; end if;
  end if;

  if v_occ_id is null then
    insert into occupancies(unit_id, tenant_name, payer_name, phone, phone2, phone3, vehicle_no,
      resident_count, room_type_id, move_in_date, move_out_date, status,
      billing_enabled, print_enabled, late_fee_enabled, single_print, billing_note, settlement_note, facility_note)
      values (v_unit_id, p_occupancy->>'tenant_name', p_occupancy->>'payer_name', p_occupancy->>'phone',
        p_occupancy->>'phone2', p_occupancy->>'phone3', p_occupancy->>'vehicle_no',
        nullif(p_occupancy->>'resident_count','')::int, nullif(p_occupancy->>'room_type_id','')::bigint,
        nullif(p_occupancy->>'move_in_date','')::date, nullif(p_occupancy->>'move_out_date','')::date,
        coalesce(p_occupancy->>'status','occupied')::occupancy_status,
        coalesce((p_occupancy->>'billing_enabled')::boolean,true), coalesce((p_occupancy->>'print_enabled')::boolean,true),
        coalesce((p_occupancy->>'late_fee_enabled')::boolean,true), coalesce((p_occupancy->>'single_print')::boolean,false),
        p_occupancy->>'billing_note', p_occupancy->>'settlement_note', p_occupancy->>'facility_note')
      returning id into v_occ_id;
  else
    update occupancies set tenant_name = p_occupancy->>'tenant_name', payer_name = p_occupancy->>'payer_name',
      phone = p_occupancy->>'phone', phone2 = p_occupancy->>'phone2', phone3 = p_occupancy->>'phone3',
      vehicle_no = p_occupancy->>'vehicle_no', resident_count = nullif(p_occupancy->>'resident_count','')::int,
      room_type_id = nullif(p_occupancy->>'room_type_id','')::bigint,
      move_in_date = nullif(p_occupancy->>'move_in_date','')::date, move_out_date = nullif(p_occupancy->>'move_out_date','')::date,
      status = coalesce(p_occupancy->>'status','occupied')::occupancy_status,
      billing_enabled = coalesce((p_occupancy->>'billing_enabled')::boolean,true),
      print_enabled = coalesce((p_occupancy->>'print_enabled')::boolean,true),
      late_fee_enabled = coalesce((p_occupancy->>'late_fee_enabled')::boolean,true),
      single_print = coalesce((p_occupancy->>'single_print')::boolean,false),
      billing_note = p_occupancy->>'billing_note', settlement_note = p_occupancy->>'settlement_note',
      facility_note = p_occupancy->>'facility_note'
      where id = v_occ_id and unit_id = v_unit_id;
    if not found then raise exception 'occupancy not in unit'; end if;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_meters,'[]'::jsonb)) loop
    insert into unit_meters(unit_id, utility, meter_no, customer_no)
      values (v_unit_id, v_item->>'utility', v_item->>'meter_no', v_item->>'customer_no')
      on conflict (unit_id, utility) do update set meter_no = excluded.meter_no, customer_no = excluded.customer_no;
  end loop;
  for v_item in select value from jsonb_array_elements(coalesce(p_accounts,'[]'::jsonb)) loop
    insert into unit_accounts(unit_id, kind, bank, account, holder, cms_member_no)
      values (v_unit_id, v_item->>'kind', v_item->>'bank', v_item->>'account', v_item->>'holder', v_item->>'cms_member_no')
      on conflict (unit_id, kind) do update set bank = excluded.bank, account = excluded.account,
        holder = excluded.holder, cms_member_no = excluded.cms_member_no;
  end loop;
  if p_lease is not null and p_lease <> 'null'::jsonb then
    insert into lease_contracts(occupancy_id, deposit, monthly_rent, start_date, end_date, expiry_alert)
      values (v_occ_id, nullif(p_lease->>'deposit','')::bigint, nullif(p_lease->>'monthly_rent','')::bigint,
        nullif(p_lease->>'start_date','')::date, nullif(p_lease->>'end_date','')::date,
        coalesce((p_lease->>'expiry_alert')::boolean,false))
      on conflict (occupancy_id) do update set deposit = excluded.deposit, monthly_rent = excluded.monthly_rent,
        start_date = excluded.start_date, end_date = excluded.end_date, expiry_alert = excluded.expiry_alert;
  end if;

  return jsonb_build_object('unit_id', v_unit_id, 'occupancy_id', v_occ_id);
end $$;
revoke execute on function save_unit_occupancy(bigint,bigint,bigint,jsonb,jsonb,jsonb,jsonb,jsonb) from anon;

-- ===== 목록 RPC =====
create or replace function list_tenants(p_building_id bigint)
returns table(
  unit_id bigint, occupancy_id bigint, unit_no text, tenant_name text,
  room_type_label text, resident_count int, move_in_date date,
  is_vacant boolean, is_overdue boolean
) language sql stable security definer set search_path = public as $$
  select u.id, o.id, u.unit_no, o.tenant_name, rt.label, o.resident_count, o.move_in_date,
    coalesce(o.status = 'vacant', true) as is_vacant,
    false as is_overdue
  from units u
  join buildings b on b.id = u.building_id and b.org_id = current_user_org()
  left join lateral (
    select * from occupancies oc where oc.unit_id = u.id and oc.deleted_at is null
    order by oc.created_at desc limit 1
  ) o on true
  left join room_types rt on rt.id = o.room_type_id
  where u.building_id = p_building_id and u.deleted_at is null
  order by u.unit_no
$$;
revoke execute on function list_tenants(bigint) from anon;

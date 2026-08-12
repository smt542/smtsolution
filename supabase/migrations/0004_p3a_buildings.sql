-- P3a: 건물 관리(/staff/buildings)
-- 의존: P0(organizations, set_updated_at, my_org_ids, auth.users),
--       P1a(buildings, units, occupancies), P2a(current_user_org, current_user_has_module, org_members, profiles)

-- ===== buildings 변경: 담당자 FK + 시설 jsonb =====
alter table buildings
  drop column manager_name,
  drop column meter_staff_name,
  drop column cleaning_staff_name,
  add column manager_user_id  uuid references auth.users(id) on delete set null,
  add column meter_user_id    uuid references auth.users(id) on delete set null,
  add column cleaning_user_id uuid references auth.users(id) on delete set null,
  add column facilities        jsonb not null default '{}'::jsonb;
create index on buildings (org_id, manager_user_id);
create index on buildings (org_id, meter_user_id);
create index on buildings (org_id, cleaning_user_id);

-- ===== 건물별 고객번호(유형별 복수) =====
create table building_customer_numbers (
  id bigint generated always as identity primary key,
  building_id bigint not null references buildings(id) on delete cascade,
  kind text not null check (kind in ('water','common_elec','elec','gas')),
  customer_no text not null,
  meter_day int check (meter_day between 1 and 31),
  billing_basis text not null default 'current' check (billing_basis in ('prev','current')),
  print_on_bill boolean not null default true,
  holder_name text,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on building_customer_numbers (building_id);

-- ===== 건물별 협력업체(계약서 파일은 attachments 재사용) =====
create table building_vendors (
  id bigint generated always as identity primary key,
  building_id bigint not null references buildings(id) on delete cascade,
  vendor_type text not null check (vendor_type in ('elevator','fire','electric','septic','etc')),
  name text not null,
  phone text,
  memo text,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on building_vendors (building_id);

-- ===== updated_at 트리거 =====
do $$ declare t text; begin
  foreach t in array array['building_customer_numbers','building_vendors'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();', t);
  end loop; end $$;

-- ===== 소프트삭제 확장(신규 자식 포함) =====
create or replace function soft_delete_building(p_id bigint)
returns void language sql set search_path = public as $$
  update occupancies o set deleted_at = now()
    from units u where u.id = o.unit_id and u.building_id = p_id and o.deleted_at is null;
  update units set deleted_at = now() where building_id = p_id and deleted_at is null;
  update building_customer_numbers set deleted_at = now() where building_id = p_id and deleted_at is null;
  update building_vendors          set deleted_at = now() where building_id = p_id and deleted_at is null;
  update buildings set deleted_at = now() where id = p_id and deleted_at is null;
$$;

-- ===== RLS: 신규 자식(select 개방 / write buildings 모듈) =====
alter table building_customer_numbers enable row level security;
alter table building_vendors          enable row level security;

create policy bcn_select on building_customer_numbers for select
  using (building_id in (select id from buildings where org_id in (select my_org_ids())));
create policy bcn_write on building_customer_numbers for all
  using      (building_id in (select id from buildings where org_id in (select my_org_ids())) and current_user_has_module('buildings'))
  with check (building_id in (select id from buildings where org_id in (select my_org_ids())) and current_user_has_module('buildings'));

create policy bv_select on building_vendors for select
  using (building_id in (select id from buildings where org_id in (select my_org_ids())));
create policy bv_write on building_vendors for all
  using      (building_id in (select id from buildings where org_id in (select my_org_ids())) and current_user_has_module('buildings'))
  with check (building_id in (select id from buildings where org_id in (select my_org_ids())) and current_user_has_module('buildings'));

-- ===== buildings 쓰기 조이기(현장직원 DB 차단) =====
drop policy bld_all on buildings;
create policy bld_select on buildings for select using (org_id in (select my_org_ids()));
create policy bld_write  on buildings for all
  using      (org_id in (select my_org_ids()) and current_user_has_module('buildings'))
  with check (org_id in (select my_org_ids()) and current_user_has_module('buildings'));

-- ===== 통합 저장 RPC(원자적) =====
create or replace function save_building(
  p_id bigint, p_code text, p_name text, p_address text,
  p_manager_user_id uuid, p_meter_user_id uuid, p_cleaning_user_id uuid,
  p_facilities jsonb, p_memo text,
  p_customer_numbers jsonb, p_vendors jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_id bigint := p_id;
  v_code text := nullif(trim(coalesce(p_code,'')), '');
  v_mgr uuid; v_meter uuid; v_clean uuid;
  v_item jsonb;
  v_vendor_map jsonb := '[]'::jsonb;
  v_new_id bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('buildings') then raise exception 'forbidden: buildings required'; end if;

  -- 담당자 uuid는 같은 org 구성원만 허용(아니면 null)
  select user_id into v_mgr   from org_members where org_id = v_org and user_id = p_manager_user_id;
  select user_id into v_meter from org_members where org_id = v_org and user_id = p_meter_user_id;
  select user_id into v_clean from org_members where org_id = v_org and user_id = p_cleaning_user_id;

  if v_id is null then
    if v_code is null then
      select 'B' || lpad((coalesce(max(nullif(regexp_replace(code,'\D','','g'),''))::int,0)+1)::text, 4, '0')
        into v_code from buildings where org_id = v_org;
    end if;
    insert into buildings(org_id, code, name, address, manager_user_id, meter_user_id, cleaning_user_id, facilities, memo)
      values (v_org, v_code, p_name, nullif(p_address,''), v_mgr, v_meter, v_clean,
              coalesce(p_facilities,'{}'::jsonb), nullif(p_memo,''))
      returning id into v_id;
  else
    update buildings set
      code = coalesce(v_code, code), name = p_name, address = nullif(p_address,''),
      manager_user_id = v_mgr, meter_user_id = v_meter, cleaning_user_id = v_clean,
      facilities = coalesce(p_facilities,'{}'::jsonb), memo = nullif(p_memo,'')
      where id = v_id and org_id = v_org;
    if not found then raise exception 'building not found in org'; end if;
  end if;

  -- 고객번호 동기화
  for v_item in select value from jsonb_array_elements(coalesce(p_customer_numbers,'[]'::jsonb)) loop
    if coalesce((v_item->>'_deleted')::boolean, false) and (v_item->>'id') is not null then
      update building_customer_numbers set deleted_at = now()
        where id = (v_item->>'id')::bigint and building_id = v_id;
    elsif (v_item->>'id') is not null then
      update building_customer_numbers set
        kind = v_item->>'kind', customer_no = v_item->>'customer_no',
        meter_day = nullif(v_item->>'meter_day','')::int,
        billing_basis = coalesce(v_item->>'billing_basis','current'),
        print_on_bill = coalesce((v_item->>'print_on_bill')::boolean, true),
        holder_name = v_item->>'holder_name', sort_order = coalesce((v_item->>'sort_order')::int, 0)
        where id = (v_item->>'id')::bigint and building_id = v_id;
    else
      insert into building_customer_numbers(building_id, kind, customer_no, meter_day, billing_basis, print_on_bill, holder_name, sort_order)
        values (v_id, v_item->>'kind', v_item->>'customer_no', nullif(v_item->>'meter_day','')::int,
                coalesce(v_item->>'billing_basis','current'), coalesce((v_item->>'print_on_bill')::boolean, true),
                v_item->>'holder_name', coalesce((v_item->>'sort_order')::int, 0));
    end if;
  end loop;

  -- 협력업체 동기화(+ client_key→id 매핑)
  for v_item in select value from jsonb_array_elements(coalesce(p_vendors,'[]'::jsonb)) loop
    if coalesce((v_item->>'_deleted')::boolean, false) and (v_item->>'id') is not null then
      update building_vendors set deleted_at = now()
        where id = (v_item->>'id')::bigint and building_id = v_id;
    elsif (v_item->>'id') is not null then
      update building_vendors set
        vendor_type = v_item->>'vendor_type', name = v_item->>'name', phone = v_item->>'phone',
        memo = v_item->>'memo', sort_order = coalesce((v_item->>'sort_order')::int, 0)
        where id = (v_item->>'id')::bigint and building_id = v_id;
    else
      insert into building_vendors(building_id, vendor_type, name, phone, memo, sort_order)
        values (v_id, v_item->>'vendor_type', v_item->>'name', v_item->>'phone', v_item->>'memo',
                coalesce((v_item->>'sort_order')::int, 0))
        returning id into v_new_id;
      if (v_item->>'client_key') is not null then
        v_vendor_map := v_vendor_map || jsonb_build_object('client_key', v_item->>'client_key', 'id', v_new_id);
      end if;
    end if;
  end loop;

  return jsonb_build_object('building_id', v_id, 'vendors', v_vendor_map);
end $$;
revoke execute on function save_building(bigint,text,text,text,uuid,uuid,uuid,jsonb,text,jsonb,jsonb) from anon;

-- ===== 목록 RPC(이름·세대수·검침일 집계 + 총건수) =====
create or replace function list_buildings(
  p_search text default null, p_manager uuid default null, p_meter uuid default null,
  p_cleaning uuid default null, p_limit int default 20, p_offset int default 0
) returns table(
  id bigint, code text, name text, address text,
  manager_user_id uuid, meter_user_id uuid, cleaning_user_id uuid,
  manager_name text, meter_name text, cleaning_name text,
  total_units bigint, occupied_units bigint, min_meter_day int, total bigint
) language sql stable security definer set search_path = public as $$
  with base as (
    select b.* from buildings b
    where b.org_id = current_user_org() and b.deleted_at is null
      and (p_search   is null or b.name ilike '%'||p_search||'%' or b.address ilike '%'||p_search||'%')
      and (p_manager  is null or b.manager_user_id  = p_manager)
      and (p_meter    is null or b.meter_user_id    = p_meter)
      and (p_cleaning is null or b.cleaning_user_id = p_cleaning)
  )
  select base.id, base.code, base.name, base.address,
    base.manager_user_id, base.meter_user_id, base.cleaning_user_id,
    mp.full_name, tp.full_name, cp.full_name,
    (select count(*) from units u where u.building_id = base.id and u.deleted_at is null),
    (select count(*) from units u join occupancies o on o.unit_id = u.id
       where u.building_id = base.id and u.deleted_at is null and o.deleted_at is null and o.status = 'occupied'),
    (select min(bcn.meter_day) from building_customer_numbers bcn where bcn.building_id = base.id and bcn.deleted_at is null),
    count(*) over()
  from base
  left join profiles mp on mp.user_id = base.manager_user_id
  left join profiles tp on tp.user_id = base.meter_user_id
  left join profiles cp on cp.user_id = base.cleaning_user_id
  order by base.created_at desc
  limit p_limit offset p_offset
$$;
revoke execute on function list_buildings(text,uuid,uuid,uuid,int,int) from anon;

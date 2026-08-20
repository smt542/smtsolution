-- 0070_partner_field_lookup.sql
-- 파트너 모바일: 프로필·조회(건물/입주자)·건물상세·입주자상세 읽기 RPC.
-- 전부 담당 건물(partner_my_building_ids, 0062) 스코프. 기존 staff 객체·RLS 불변, 신규 함수만.
-- 의존: 0062(partner_my_building_ids), P0(org_members/profiles), P1a(units/occupancies), P3a(buildings).

-- 프로필(이름·아이디·연락처·소속)
create or replace function partner_get_profile()
returns table (full_name text, username text, phone text, affiliation text)
language sql stable security definer set search_path = public as $$
  select p.full_name, p.username, p.phone, m.affiliation
  from org_members m
  join profiles p on p.user_id = m.user_id
  where m.user_id = (select auth.uid())
    and m.staff_type in ('field_staff','support_staff')
  order by m.created_at
  limit 1;
$$;
revoke execute on function partner_get_profile() from anon;

-- 담당 건물 목록(조회 건물 탭 + 검색)
create or replace function partner_list_buildings(p_search text default null)
returns table (id bigint, code text, name text, address text,
               total_units bigint, occupied_units bigint)
language sql stable security definer set search_path = public as $$
  select b.id, b.code, b.name, b.address,
    (select count(*) from units u where u.building_id = b.id and u.deleted_at is null),
    (select count(*) from units u
       join occupancies o on o.unit_id = u.id
       where u.building_id = b.id and u.deleted_at is null
         and o.deleted_at is null and o.status = 'occupied')
  from buildings b
  where b.id in (select partner_my_building_ids())
    and (p_search is null or b.name ilike '%'||p_search||'%' or b.address ilike '%'||p_search||'%')
  order by b.name;
$$;
revoke execute on function partner_list_buildings(text) from anon;

-- 건물 상세(기본 정보)
create or replace function partner_get_building(p_building_id bigint)
returns table (id bigint, code text, name text, address text, memo text)
language sql stable security definer set search_path = public as $$
  select b.id, b.code, b.name, b.address, b.memo
  from buildings b
  where b.id = p_building_id and b.id in (select partner_my_building_ids());
$$;
revoke execute on function partner_get_building(bigint) from anon;

-- 건물 세대 목록(건물 상세 입주자 탭)
create or replace function partner_list_units(p_building_id bigint)
returns table (unit_id bigint, unit_no text, dong text, tenant_name text,
               phone text, move_in_date date, status text)
language sql stable security definer set search_path = public as $$
  select u.id, u.unit_no, u.dong, o.tenant_name, o.phone, o.move_in_date,
         coalesce(o.status::text, 'vacant')
  from units u
  left join occupancies o
    on o.unit_id = u.id and o.deleted_at is null and o.status = 'occupied'
  where u.building_id = p_building_id and u.deleted_at is null
    and u.building_id in (select partner_my_building_ids())
  order by nullif(regexp_replace(u.unit_no, '\D', '', 'g'), '')::int nulls last, u.unit_no;
$$;
revoke execute on function partner_list_units(bigint) from anon;

-- 입주자(세대) 검색(조회 입주자 탭)
create or replace function partner_search_tenants(p_search text default null)
returns table (unit_id bigint, building_id bigint, building_name text,
               unit_no text, dong text, tenant_name text, phone text, move_in_date date)
language sql stable security definer set search_path = public as $$
  select u.id, b.id, b.name, u.unit_no, u.dong, o.tenant_name, o.phone, o.move_in_date
  from occupancies o
  join units u on u.id = o.unit_id
  join buildings b on b.id = u.building_id
  where o.deleted_at is null and o.status = 'occupied' and u.deleted_at is null
    and b.id in (select partner_my_building_ids())
    and (p_search is null or o.tenant_name ilike '%'||p_search||'%'
         or o.phone ilike '%'||p_search||'%' or b.name ilike '%'||p_search||'%')
  order by o.tenant_name;
$$;
revoke execute on function partner_search_tenants(text) from anon;

-- 입주자(세대) 단건 상세
create or replace function partner_get_occupancy(p_unit_id bigint)
returns table (unit_id bigint, building_id bigint, building_name text, unit_no text, dong text,
               tenant_name text, payer_name text, phone text, resident_count int,
               vehicle_no text, move_in_date date, status text)
language sql stable security definer set search_path = public as $$
  select u.id, b.id, b.name, u.unit_no, u.dong, o.tenant_name, o.payer_name, o.phone,
         o.resident_count, o.vehicle_no, o.move_in_date, coalesce(o.status::text, 'vacant')
  from units u
  join buildings b on b.id = u.building_id
  left join occupancies o
    on o.unit_id = u.id and o.deleted_at is null and o.status = 'occupied'
  where u.id = p_unit_id and b.id in (select partner_my_building_ids());
$$;
revoke execute on function partner_get_occupancy(bigint) from anon;

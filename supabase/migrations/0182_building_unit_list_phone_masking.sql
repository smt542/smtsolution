-- 0182: 건물 목록의 건물주 연락처와 파트너 세대 목록의 연락처를 서버에서 마스킹한다.
--
-- 소비자를 전수 확인해 원문이 필요한 곳이 없음을 확인하고 적용한다.
--  · list_buildings.owner_phone : BuildingDirectoryCard 의 `건물주 연락처` 열 표시 전용이고
--    이미 MaskedPhone 으로 감싸져 있다. app/api/buildings/export 는 이 RPC 를 다시 부르지만
--    내보내는 열에 owner_phone 이 없다(name·address·담당자·검침일·세대수만). 건물 편집 폼은
--    목록 행이 아니라 useBuildingFull() 로 상세를 따로 조회하므로 저장 경로에 영향이 없다.
--  · partner_list_units.phone : 서버 payload 에만 있고 화면에 렌더링되지 않는다. 파트너 세대
--    상세는 partner_get_occupancy 를 따로 호출한다. 즉 원문이 파트너 브라우저까지 내려갈
--    이유가 없다.
--
-- 두 함수 모두 where 절은 건드리지 않았다(애초에 번호로 검색하지 않는다).
-- 마스킹은 select 목록에만 적용한다.

create or replace function list_buildings(
  p_search text default null, p_manager uuid default null, p_meter uuid default null,
  p_cleaning uuid default null, p_limit int default 20, p_offset int default 0
) returns table(
  id bigint, code text, name text, address text,
  manager_user_id uuid, meter_user_id uuid, cleaning_user_id uuid,
  manager_name text, meter_name text, cleaning_name text,
  total_units bigint, occupied_units bigint, min_meter_day int, total bigint,
  type_label text, owner_name text, owner_phone text, entrance_password text,
  created_at timestamptz
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
    count(*) over(),
    bt.label, base.owner_name, public.mask_phone(base.owner_phone), base.entrance_password, base.created_at
  from base
  left join profiles mp on mp.user_id = base.manager_user_id
  left join profiles tp on tp.user_id = base.meter_user_id
  left join profiles cp on cp.user_id = base.cleaning_user_id
  left join building_types bt on bt.id = base.type_id and bt.org_id = current_user_org()
  order by base.created_at desc
  limit p_limit offset p_offset
$$;

create or replace function partner_list_units(p_building_id bigint)
returns table (unit_id bigint, unit_no text, dong text, tenant_name text,
               phone text, move_in_date date, status text)
language sql stable security definer set search_path = public as $$
  select u.id, u.unit_no, u.dong, o.tenant_name, public.mask_phone(o.phone), o.move_in_date,
         coalesce(o.status::text, 'vacant')
  from units u
  left join occupancies o
    on o.unit_id = u.id and o.deleted_at is null and o.status = 'occupied'
  where u.building_id = p_building_id and u.deleted_at is null
    and u.building_id in (select partner_my_building_ids())
  order by nullif(regexp_replace(u.unit_no, '\D', '', 'g'), '')::int nulls last, u.unit_no;
$$;

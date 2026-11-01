-- 0344: QA #15 건물 기본 정렬 = 건물 코드 오름차순 (list_buildings 기본값, partner_list_buildings)
--  list_buildings: p_sort 기본값 'created_desc' -> 'code_asc'. 'created_desc'/'created_asc'/'meter_day_*' 는 명시 시 그대로.
--  partner_list_buildings: order by b.name -> b.code, b.id. 시그니처·반환 컬럼 동일.
begin;

create or replace function public.list_buildings(
  p_search text default null::text,
  p_manager uuid default null::uuid,
  p_meter uuid default null::uuid,
  p_cleaning uuid default null::uuid,
  p_limit integer default 20,
  p_offset integer default 0,
  p_sort text default 'code_asc',
  p_meter_kind text default null::text
)
 returns table(id bigint, code text, name text, address text, manager_user_id uuid, meter_user_id uuid, cleaning_user_id uuid, manager_name text, meter_name text, cleaning_name text, total_units bigint, occupied_units bigint, min_meter_day integer, total bigint, type_label text, owner_name text, owner_phone text, entrance_password text, created_at timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with base as (
    select b.*,
      -- 검침일 정렬 키: 지정 항목(수도·전기·가스·공용전기)의 고객번호 검침일 중 가장 이른 날. 항목 미지정이면 전체 항목.
      (select min(bcn.meter_day) from building_customer_numbers bcn
         where bcn.building_id = b.id and bcn.deleted_at is null
           and (p_meter_kind is null or bcn.kind = p_meter_kind)) as sort_meter_day
    from buildings b
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
    bt.label, base.owner_name, base.owner_phone, base.entrance_password, base.created_at
  from base
  left join profiles mp on mp.user_id = base.manager_user_id
  left join profiles tp on tp.user_id = base.meter_user_id
  left join profiles cp on cp.user_id = base.cleaning_user_id
  left join building_types bt on bt.id = base.type_id and bt.org_id = current_user_org()
  order by
    -- 검침일이 없는 건물은 방향과 관계없이 뒤로 보낸다.
    case when p_sort = 'meter_day_asc'  then base.sort_meter_day end asc  nulls last,
    case when p_sort = 'meter_day_desc' then base.sort_meter_day end desc nulls last,
    case when p_sort in ('meter_day_asc', 'meter_day_desc') then base.code end asc,
    case when p_sort = 'created_asc' then base.created_at end asc,
    case when p_sort = 'created_asc' then base.id end asc,
    case when p_sort = 'created_desc' then base.created_at end desc,
    case when p_sort = 'created_desc' then base.id end desc,
    -- 기본(code_asc·미지정): 건물 코드 오름차순(코드는 3자리 zero-padding이라 text 정렬 = 숫자 정렬)
    base.code asc,
    base.id asc
  limit p_limit offset p_offset
$function$;

revoke all on function public.list_buildings(text, uuid, uuid, uuid, integer, integer, text, text) from public, anon;
grant execute on function public.list_buildings(text, uuid, uuid, uuid, integer, integer, text, text) to authenticated, service_role;

create or replace function public.partner_list_buildings(p_search text default null::text)
 returns table(id bigint, code text, name text, address text, total_units bigint, occupied_units bigint)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select b.id, b.code, b.name, b.address,
    (select count(*) from units u where u.building_id = b.id and u.deleted_at is null),
    (select count(*) from units u
       join occupancies o on o.unit_id = u.id
       where u.building_id = b.id and u.deleted_at is null
         and o.deleted_at is null and o.status = 'occupied')
  from buildings b
  where b.id in (select partner_my_building_ids())
    and (p_search is null or b.name ilike '%'||p_search||'%' or b.address ilike '%'||p_search||'%')
  order by b.code, b.id;
$function$;

commit;

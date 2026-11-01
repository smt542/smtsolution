-- QA #50 #51: 협력업체 구분 고정 8종·고정 순서, 유선방송정보업체 제외, building_vendors.vendor_role 도입.
-- 순서: 청소 → 승강기보수 → CCTV → 인터넷 → 소방검사 → 정화조 → 전기안전 → 승강기정기검사

-- 1) building_vendors.vendor_role
alter table public.building_vendors add column if not exists vendor_role text;

-- 백필(추정 매핑, 판별 불가는 NULL 유지 -> 화면에서 맨 뒤 표시)
update public.building_vendors set vendor_role = case vendor_type
    when 'fire' then 'fire'
    when 'electric' then 'elec_safety'
    when 'septic' then 'septic'
  end
 where deleted_at is null and vendor_role is null and vendor_type in ('fire','electric','septic');

-- elevator: 건물 내 sort_order 순 첫 행 = 승강기보수, 둘째 = 승강기정기검사
with ranked as (
  select id, row_number() over (partition by building_id order by sort_order, id) rn
    from public.building_vendors
   where deleted_at is null and vendor_type = 'elevator' and vendor_role is null
)
update public.building_vendors v
   set vendor_role = case when r.rn = 1 then 'elevator_maint' when r.rn = 2 then 'elevator_insp' end
  from ranked r where r.id = v.id;

-- etc: buildings.vendor_details 에서 etc 계열 역할(cleaning/internet/cctv)이 정확히 1개 assigned 이고
--      그 건물의 활성 etc 행이 1개일 때만 매핑
with etc_rows as (
  select v.id, v.building_id,
         count(*) over (partition by v.building_id) cnt
    from public.building_vendors v
   where v.deleted_at is null and v.vendor_type = 'etc' and v.vendor_role is null
), cand as (
  select e.id, (array_agg(k.key))[1] role_key, count(*) n
    from etc_rows e
    join public.buildings b on b.id = e.building_id
    join lateral jsonb_each(coalesce(b.vendor_details->'vendors','{}'::jsonb)) k(key, value) on true
   where e.cnt = 1 and k.key in ('cleaning','internet','cctv')
     and coalesce((k.value->>'assigned')::boolean, false)
   group by e.id
)
update public.building_vendors v set vendor_role = c.role_key
  from cand c where c.id = v.id and c.n = 1;

-- 2) 기본 구분 = 8종(요청 순서). 유선방송정보업체는 제외(연결 업체가 없을 때만 삭제).
create or replace function public.provision_default_vendor_categories(p_org_id bigint)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_default record;
  v_category_id bigint;
  v_inserted integer := 0;
begin
  if p_org_id is null then
    return 0;
  end if;

  perform set_config('app.vc_provisioning', '1', true);

  for v_default in
    select *
    from (values
      (0, '청소 업체'),
      (1, '승강기보수업체'),
      (2, 'CCTV 업체'),
      (3, '인터넷 업체'),
      (4, '소방검사업체'),
      (5, '정화조 업체'),
      (6, '전기안전업체'),
      (7, '승강기정기검사업체')
    ) as defaults(sort_order, label)
  loop
    v_category_id := null;

    select id into v_category_id
      from public.vendor_categories
     where org_id = p_org_id and label = v_default.label
     limit 1;

    if v_category_id is null then
      select id into v_category_id
        from public.vendor_categories
       where org_id = p_org_id
         and regexp_replace(lower(label), '[[:space:]]+', '', 'g') =
             regexp_replace(lower(v_default.label), '[[:space:]]+', '', 'g')
       order by id
       limit 1;

      if v_category_id is not null then
        update public.vendor_categories
           set label = v_default.label
         where id = v_category_id;
      else
        insert into public.vendor_categories (org_id, label, sort_order, is_default)
        values (p_org_id, v_default.label, v_default.sort_order, true)
        on conflict (org_id, label) do update
          set sort_order = excluded.sort_order
        returning id into v_category_id;
        v_inserted := v_inserted + 1;
      end if;
    end if;

    update public.vendors
       set category_id = v_category_id
     where org_id = p_org_id
       and category_id in (
         select id from public.vendor_categories
          where org_id = p_org_id
            and id <> v_category_id
            and regexp_replace(lower(label), '[[:space:]]+', '', 'g') =
                regexp_replace(lower(v_default.label), '[[:space:]]+', '', 'g')
       );

    delete from public.vendor_categories
     where org_id = p_org_id
       and id <> v_category_id
       and regexp_replace(lower(label), '[[:space:]]+', '', 'g') =
           regexp_replace(lower(v_default.label), '[[:space:]]+', '', 'g');

    update public.vendor_categories
       set sort_order = v_default.sort_order,
           is_default = true
     where id = v_category_id;
  end loop;

  -- 유선방송정보업체: 연결 업체가 없으면 삭제(있으면 보존, 화면에서만 숨김)
  delete from public.vendor_categories c
   where c.org_id = p_org_id
     and regexp_replace(lower(c.label), '[[:space:]]+', '', 'g') = '유선방송정보업체'
     and not exists (select 1 from public.vendors v where v.category_id = c.id);

  -- 사용자 정의 구분은 기본 8종 뒤로
  update public.vendor_categories
     set sort_order = 100 + sort_order
   where org_id = p_org_id and not is_default and sort_order < 100;

  perform set_config('app.vc_provisioning', '', true);
  return v_inserted;
end
$function$;

-- 기존 조직 전체 재적용
select public.provision_default_vendor_categories(id) from public.organizations;

-- 3) save_building: vendor_role 저장 (그 외 본문은 라이브 정의 그대로)
create or replace function public.save_building(p_id bigint, p_code text, p_name text, p_address text, p_manager_user_id uuid, p_meter_user_id uuid, p_cleaning_user_id uuid, p_facilities jsonb, p_memo text, p_customer_numbers jsonb, p_vendors jsonb, p_type_id bigint DEFAULT NULL::bigint, p_entrance_password text DEFAULT NULL::text, p_owner_name text DEFAULT NULL::text, p_owner_phone text DEFAULT NULL::text, p_billing_note text DEFAULT NULL::text, p_reserve_fund jsonb DEFAULT NULL::jsonb, p_owner_extra jsonb DEFAULT NULL::jsonb, p_basic_extra jsonb DEFAULT NULL::jsonb, p_extra_info jsonb DEFAULT NULL::jsonb, p_vendor_details jsonb DEFAULT NULL::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint;
  v_id bigint := p_id;
  v_code text := nullif(trim(coalesce(p_code,'')), '');
  v_mgr uuid; v_meter uuid; v_clean uuid;
  v_type bigint;
  v_item jsonb;
  v_vendor_map jsonb := '[]'::jsonb;
  v_new_id bigint;
  v_meter_day int;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('buildings') then raise exception 'forbidden: buildings required'; end if;

  select user_id into v_mgr   from org_members where org_id = v_org and user_id = p_manager_user_id;
  select user_id into v_meter from org_members where org_id = v_org and user_id = p_meter_user_id;
  select user_id into v_clean from org_members where org_id = v_org and user_id = p_cleaning_user_id;
  select id into v_type from building_types where id = p_type_id and org_id = v_org;

  if v_code is null or v_code !~ '^[0-9]{3}$' then
    raise exception 'invalid building code: 3 digits required' using errcode = '22023';
  end if;

  if v_mgr is null then
    raise exception '사무 담당자를 선택해 주세요.' using errcode = '22023';
  end if;
  if v_meter is null then
    raise exception '현장 관리자를 선택해 주세요.' using errcode = '22023';
  end if;

  if coalesce(p_basic_extra->>'contractDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
     and coalesce(p_basic_extra->>'terminationDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
     and (p_basic_extra->>'terminationDate') < (p_basic_extra->>'contractDate') then
    raise exception '해지일은 계약일보다 빠를 수 없어요.' using errcode = '22023';
  end if;

  if v_id is null then
    insert into buildings(
      org_id, code, name, address, manager_user_id, meter_user_id, cleaning_user_id, facilities, memo,
      type_id, entrance_password, owner_name, owner_phone, billing_note,
      reserve_fund, owner_extra, basic_extra, extra_info, vendor_details)
      values (v_org, v_code, p_name, nullif(p_address,''), v_mgr, v_meter, v_clean,
              coalesce(p_facilities,'{}'::jsonb), nullif(p_memo,''),
              v_type, nullif(p_entrance_password,''), nullif(p_owner_name,''), nullif(p_owner_phone,''),
              nullif(p_billing_note,''),
              p_reserve_fund, p_owner_extra, p_basic_extra, p_extra_info, p_vendor_details)
      returning id into v_id;
  else
    update buildings set
      code = v_code, name = p_name, address = nullif(p_address,''),
      manager_user_id = v_mgr, meter_user_id = v_meter, cleaning_user_id = v_clean,
      facilities = coalesce(p_facilities,'{}'::jsonb), memo = nullif(p_memo,''),
      type_id = v_type, entrance_password = nullif(p_entrance_password,''),
      owner_name = nullif(p_owner_name,''), owner_phone = nullif(p_owner_phone,''),
      billing_note = nullif(p_billing_note,''),
      reserve_fund = p_reserve_fund, owner_extra = p_owner_extra, basic_extra = p_basic_extra,
      extra_info = p_extra_info, vendor_details = p_vendor_details
      where id = v_id and org_id = v_org;
    if not found then raise exception 'building not found in org'; end if;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_customer_numbers,'[]'::jsonb)) loop
    if not coalesce((v_item->>'_deleted')::boolean, false)
       and nullif(v_item->>'meter_day','') is not null then
      v_meter_day := (v_item->>'meter_day')::int;
      if v_meter_day < 1 or v_meter_day > 28 then
        raise exception '일금일은 1~28일만 입력할 수 있어요.' using errcode = '22023';
      end if;
    end if;

    if coalesce((v_item->>'_deleted')::boolean, false) and (v_item->>'id') is not null then
      update building_customer_numbers set deleted_at = now()
        where id = (v_item->>'id')::bigint and building_id = v_id;
    elsif (v_item->>'id') is not null then
      update building_customer_numbers set
        kind = v_item->>'kind', customer_no = v_item->>'customer_no',
        meter_day = nullif(v_item->>'meter_day','')::int,
        billing_basis = coalesce(v_item->>'billing_basis','current'),
        print_on_bill = coalesce((v_item->>'print_on_bill')::boolean, false),
        holder_name = v_item->>'holder_name',
        line_name = nullif(trim(v_item->>'line_name'), ''),
        calculation_method = case
          when v_item->>'kind' = 'common_elec' then 'auto'
          else coalesce(nullif(v_item->>'calculation_method', ''), 'auto')
        end,
        note = nullif(trim(v_item->>'note'), ''),
        sort_order = coalesce((v_item->>'sort_order')::int, 0)
        where id = (v_item->>'id')::bigint and building_id = v_id;
    else
      insert into building_customer_numbers(
        building_id, kind, customer_no, meter_day, billing_basis, print_on_bill,
        holder_name, line_name, calculation_method, note, sort_order
      ) values (
        v_id, v_item->>'kind', v_item->>'customer_no', nullif(v_item->>'meter_day','')::int,
        coalesce(v_item->>'billing_basis','current'),
        coalesce((v_item->>'print_on_bill')::boolean, false),
        v_item->>'holder_name', nullif(trim(v_item->>'line_name'), ''),
        case
          when v_item->>'kind' = 'common_elec' then 'auto'
          else coalesce(nullif(v_item->>'calculation_method', ''), 'auto')
        end,
        nullif(trim(v_item->>'note'), ''),
        coalesce((v_item->>'sort_order')::int, 0)
      );
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_vendors,'[]'::jsonb)) loop
    if coalesce((v_item->>'_deleted')::boolean, false) and (v_item->>'id') is not null then
      update building_vendors set deleted_at = now()
        where id = (v_item->>'id')::bigint and building_id = v_id;
    elsif (v_item->>'id') is not null then
      update building_vendors set
        vendor_type = v_item->>'vendor_type', name = v_item->>'name', phone = v_item->>'phone',
        memo = v_item->>'memo', sort_order = coalesce((v_item->>'sort_order')::int, 0),
        vendor_role = coalesce(nullif(v_item->>'vendor_role',''), vendor_role)
        where id = (v_item->>'id')::bigint and building_id = v_id;
    else
      insert into building_vendors(building_id, vendor_type, name, phone, memo, sort_order, vendor_role)
        values (v_id, v_item->>'vendor_type', v_item->>'name', v_item->>'phone', v_item->>'memo',
                coalesce((v_item->>'sort_order')::int, 0), nullif(v_item->>'vendor_role',''))
        returning id into v_new_id;
      if (v_item->>'client_key') is not null then
        v_vendor_map := v_vendor_map || jsonb_build_object('client_key', v_item->>'client_key', 'id', v_new_id);
      end if;
    end if;
  end loop;

  return jsonb_build_object('building_id', v_id, 'vendors', v_vendor_map);
end $function$;

-- 4) 현장 모바일: 역할 키 반환 + 역할 순서 정렬 (반환 컬럼 추가라 drop 후 재생성, 기존 컬럼은 그대로)
drop function if exists public.partner_list_building_vendors(bigint);
create function public.partner_list_building_vendors(p_building_id bigint)
 returns table(id bigint, vendor_type text, name text, phone text, memo text, vendor_role text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select v.id, v.vendor_type, v.name,
    v.phone,
    v.memo,
    v.vendor_role
  from building_vendors v
  where v.building_id = p_building_id
    and v.deleted_at is null
    and v.building_id in (select partner_my_building_ids())
  order by array_position(
             array['cleaning','elevator_maint','cctv','internet','fire','septic','elec_safety','elevator_insp'],
             v.vendor_role) nulls last,
           v.sort_order, v.id;
$function$;
revoke all on function public.partner_list_building_vendors(bigint) from public, anon;
grant execute on function public.partner_list_building_vendors(bigint) to authenticated, service_role;

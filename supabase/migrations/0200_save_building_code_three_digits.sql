-- 건물 코드 숫자 3자리를 서버에서도 강제한다(2026-09-30 퍼블리싱 QA W04 후속).
-- 화면(건물 등록·상세)은 00e21dc1부터 숫자 3자리만 저장하게 막고 있다. 여기서는 save_building이
--   · 등록·수정 모두 코드가 숫자 3자리가 아니면 거절(22023)하고
--   · 코드를 비워 등록하면 B0001식으로 자동 생성하던 분기를 없앤다.
-- 시그니처·기본값·권한은 0124 그대로다(create or replace라 오버로드가 새로 생기지 않는다).
-- 기존 건물 중 코드가 3자리가 아닌 행(B001 등)은 그대로 두고, 그 건물을 save_building으로 저장할 때만 막힌다.
-- 다른 화면의 부분 수정·삭제는 이 함수를 거치지 않아 영향이 없다. 기존 데이터 영향은 사용자 확인(무관).

create or replace function public.save_building(
  p_id bigint, p_code text, p_name text, p_address text,
  p_manager_user_id uuid, p_meter_user_id uuid, p_cleaning_user_id uuid,
  p_facilities jsonb, p_memo text,
  p_customer_numbers jsonb, p_vendors jsonb,
  p_type_id bigint default null,
  p_entrance_password text default null,
  p_owner_name text default null,
  p_owner_phone text default null,
  p_billing_note text default null,
  p_reserve_fund jsonb default null,
  p_owner_extra jsonb default null,
  p_basic_extra jsonb default null,
  p_extra_info jsonb default null,
  p_vendor_details jsonb default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_id bigint := p_id;
  v_code text := nullif(trim(coalesce(p_code,'')), '');
  v_mgr uuid; v_meter uuid; v_clean uuid;
  v_type bigint;
  v_item jsonb;
  v_vendor_map jsonb := '[]'::jsonb;
  v_new_id bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('buildings') then raise exception 'forbidden: buildings required'; end if;

  select user_id into v_mgr   from org_members where org_id = v_org and user_id = p_manager_user_id;
  select user_id into v_meter from org_members where org_id = v_org and user_id = p_meter_user_id;
  select user_id into v_clean from org_members where org_id = v_org and user_id = p_cleaning_user_id;
  -- 건물 유형은 org 소유 building_types 로만 세팅(타 org 유형 방지). 미매칭이면 null.
  select id into v_type from building_types where id = p_type_id and org_id = v_org;

  -- 건물 코드 = 숫자 3자리(기획·클라이언트 요구). 등록·수정 모두 검사하고, 빈 코드 자동 생성(B0001식)은 없앤다.
  if v_code is null or v_code !~ '^[0-9]{3}$' then
    raise exception 'invalid building code: 3 digits required' using errcode = '22023';
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
    if coalesce((v_item->>'_deleted')::boolean, false) and (v_item->>'id') is not null then
      update building_customer_numbers set deleted_at = now()
        where id = (v_item->>'id')::bigint and building_id = v_id;
    elsif (v_item->>'id') is not null then
      update building_customer_numbers set
        kind = v_item->>'kind', customer_no = v_item->>'customer_no',
        meter_day = nullif(v_item->>'meter_day','')::int,
        billing_basis = coalesce(v_item->>'billing_basis','current'),
        print_on_bill = coalesce((v_item->>'print_on_bill')::boolean, true),
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
        coalesce((v_item->>'print_on_bill')::boolean, true),
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

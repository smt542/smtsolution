-- 건물 등록/상세 재설계(Figma 673:55474) — 6개 섹션 저장 배선.
-- 기존 컬럼(type_id·entrance_password·owner_name·owner_phone·billing_note)에 더해
-- 정규화 테이블에 대응이 없는 리치 섹션(적립금·건물주 부가·부가정보 유틸·기본정보 부가·업체 상세)을
-- 섹션 단위 JSONB 컬럼으로 왕복 저장한다. WRITE ONLY(라이브 미적용).

alter table buildings
  add column if not exists reserve_fund   jsonb,  -- ③ 적립금 { type, memo }
  add column if not exists owner_extra    jsonb,  -- ④ 건물주 부가 { phoneSub, address, addressDetail, memo }
  add column if not exists basic_extra    jsonb,  -- ① 기본정보 부가 { groupType, waterCount, contractDate, terminationDate, standingNotice, addressDetail, buildingTypeLabel }
  add column if not exists extra_info     jsonb,  -- ⑤ 부가정보 { utilities: { <kind>: { cards[], extra } } }
  add column if not exists vendor_details jsonb;  -- ② 업체 상세 { vendors: { <key>: { fields, memo } } }

-- 기존 공개 시그니처(11-arg)를 걷어내고, 재설계 섹션 파라미터를 덧붙인 확장 시그니처로 교체한다.
-- 추가 파라미터는 전부 default null 이라 레거시 호출(부분 인자)과도 호환된다.
drop function if exists save_building(bigint,text,text,text,uuid,uuid,uuid,jsonb,text,jsonb,jsonb);

create function save_building(
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

  if v_id is null then
    if v_code is null then
      select 'B' || lpad((coalesce(max(nullif(regexp_replace(code,'\D','','g'),''))::int,0)+1)::text, 4, '0')
        into v_code from buildings where org_id = v_org;
    end if;
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
      code = coalesce(v_code, code), name = p_name, address = nullif(p_address,''),
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

revoke execute on function save_building(
  bigint,text,text,text,uuid,uuid,uuid,jsonb,text,jsonb,jsonb,
  bigint,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb
) from anon;

-- 입주자 연체료 부과 여부·단수 출력 여부 기본값 = O.
--
-- late_fee_enabled 는 이미 DB 기본값 O(true)였으나 single_print 는 X(false)였다.
-- 입주자 등록 폼 기본값도 둘 다 X라 신규 등록은 항상 X로 저장됐다(폼은 함께 수정).
-- 데이터 이관(migrate_tenant)은 이미 빈칸 = O 라 변경 없음.
--   - occupancies.single_print 컬럼 기본값 true.
--   - save_unit_occupancy: 값이 빠졌을 때 single_print 기본 true.
--   - reset_occupancy_on_vacate: 공실 초기화 값 single_print = true(새 입주 등록 시 기본 O로 보이게).
--   - 기존 공실 행(초기화 값)만 single_print = true 로 보정. 입주 중 세대는 사무실이 고른 값일 수 있어 건드리지 않는다.

alter table public.occupancies alter column single_print set default true;

CREATE OR REPLACE FUNCTION public.save_unit_occupancy(p_building_id bigint, p_unit_id bigint, p_occupancy_id bigint, p_unit jsonb, p_occupancy jsonb, p_meters jsonb, p_accounts jsonb, p_lease jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_org bigint; v_unit_id bigint := p_unit_id; v_occ_id bigint := p_occupancy_id; v_item jsonb;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('tenants') then raise exception 'forbidden: tenants required'; end if;
  if not exists (select 1 from buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org'; end if;

  if v_unit_id is null then
    insert into units(building_id, unit_no, dong, area_pyeong, room_count, floor, usage_type)
      values (p_building_id, p_unit->>'unit_no', p_unit->>'dong',
              nullif(p_unit->>'area_pyeong','')::numeric, nullif(p_unit->>'room_count','')::int,
              nullif(p_unit->>'floor','')::int,
              coalesce(nullif(p_unit->>'usage_type',''), 'residential'))
      returning id into v_unit_id;
  else
    update units set unit_no = coalesce(p_unit->>'unit_no', unit_no),
      dong = coalesce(p_unit->>'dong', dong),
      area_pyeong = coalesce(nullif(p_unit->>'area_pyeong','')::numeric, area_pyeong),
      room_count = coalesce(nullif(p_unit->>'room_count','')::int, room_count),
      floor = case when p_unit ? 'floor' then nullif(p_unit->>'floor','')::int else floor end,
      usage_type = case when p_unit ? 'usage_type'
        then coalesce(nullif(p_unit->>'usage_type',''), 'residential') else usage_type end
      where id = v_unit_id and building_id = p_building_id;
    if not found then raise exception 'unit not in building'; end if;
  end if;

  if v_occ_id is null then
    insert into occupancies(unit_id, tenant_name, payer_name, phone, phone2, phone3, vehicle_no,
      resident_count, room_type_id, move_in_date, move_out_date, status,
      billing_enabled, print_enabled, late_fee_enabled, single_print, billing_note, settlement_note, facility_note,
      transfer_method, bill_name_display, bill_delivery, bill_auth, move_out_scheduled_date)
      values (v_unit_id, p_occupancy->>'tenant_name', p_occupancy->>'payer_name', p_occupancy->>'phone',
        p_occupancy->>'phone2', p_occupancy->>'phone3', p_occupancy->>'vehicle_no',
        nullif(p_occupancy->>'resident_count','')::int, nullif(p_occupancy->>'room_type_id','')::bigint,
        nullif(p_occupancy->>'move_in_date','')::date, nullif(p_occupancy->>'move_out_date','')::date,
        coalesce(p_occupancy->>'status','occupied')::occupancy_status,
        coalesce((p_occupancy->>'billing_enabled')::boolean,true), coalesce((p_occupancy->>'print_enabled')::boolean,true),
        coalesce((p_occupancy->>'late_fee_enabled')::boolean,true), coalesce((p_occupancy->>'single_print')::boolean,true),
        p_occupancy->>'billing_note', p_occupancy->>'settlement_note', p_occupancy->>'facility_note',
        coalesce(nullif(p_occupancy->>'transfer_method',''), 'none'),
        coalesce(nullif(p_occupancy->>'bill_name_display',''), 'name'),
        coalesce(nullif(p_occupancy->>'bill_delivery',''), 'post'),
        coalesce((p_occupancy->>'bill_auth')::boolean, false),
        nullif(p_occupancy->>'move_out_scheduled_date','')::date)
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
      single_print = coalesce((p_occupancy->>'single_print')::boolean,true),
      billing_note = p_occupancy->>'billing_note', settlement_note = p_occupancy->>'settlement_note',
      facility_note = p_occupancy->>'facility_note',
      transfer_method = coalesce(nullif(p_occupancy->>'transfer_method',''), 'none'),
      bill_name_display = coalesce(nullif(p_occupancy->>'bill_name_display',''), 'name'),
      bill_delivery = coalesce(nullif(p_occupancy->>'bill_delivery',''), 'post'),
      bill_auth = coalesce((p_occupancy->>'bill_auth')::boolean, false),
      move_out_scheduled_date = nullif(p_occupancy->>'move_out_scheduled_date','')::date
      where id = v_occ_id and unit_id = v_unit_id;
    if not found then raise exception 'occupancy not in unit'; end if;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_meters,'[]'::jsonb)) loop
    insert into unit_meters(unit_id, utility, meter_no, customer_no)
      values (v_unit_id, v_item->>'utility', v_item->>'meter_no', v_item->>'customer_no')
      on conflict (unit_id, utility) do update set meter_no = excluded.meter_no, customer_no = excluded.customer_no;
  end loop;
  for v_item in select value from jsonb_array_elements(coalesce(p_accounts,'[]'::jsonb)) loop
    insert into unit_accounts(unit_id, kind, bank, account, holder, cms_member_no, payer_no)
      values (v_unit_id, v_item->>'kind', v_item->>'bank', v_item->>'account', v_item->>'holder', v_item->>'cms_member_no', v_item->>'payer_no')
      on conflict (unit_id, kind) do update set bank = excluded.bank, account = excluded.account,
        holder = excluded.holder, cms_member_no = excluded.cms_member_no, payer_no = excluded.payer_no;
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
end $function$;

CREATE OR REPLACE FUNCTION public.reset_occupancy_on_vacate(p_occupancy_id bigint, p_move_out_date date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_occ record;
  v_date date := coalesce(p_move_out_date, (now() at time zone 'Asia/Seoul')::date);
begin
  select o.id, o.unit_id, o.status, o.tenant_name, o.phone, o.phone2, o.phone3,
         o.move_in_date, rt.label as room_type_label
    into v_occ
    from occupancies o
    left join room_types rt on rt.id = o.room_type_id
    where o.id = p_occupancy_id and o.deleted_at is null
    for update of o;
  if not found then raise exception 'occupancy not found'; end if;

  -- 전출정보 이력: 입주 중인 행을 공실화할 때만 적재(이미 공실이면 이미 비워진 값이라 중복 적재 금지).
  -- 전화 스냅샷 매핑: phone=주, phone2=부, phone3=집전화.
  if v_occ.status <> 'vacant' then
    insert into occupancy_history(
      unit_id, tenant_name, move_in_date, move_out_date, room_type_label, phone, phone2, phone3
    ) values (
      v_occ.unit_id, v_occ.tenant_name, v_occ.move_in_date, v_date, v_occ.room_type_label,
      v_occ.phone, v_occ.phone2, v_occ.phone3
    );
  end if;

  -- 정책 25필드 중 occupancies 귀속 18필드(+추가 연락처/차량, 인증 정보) 초기화.
  update occupancies set
    -- 기본 정보 7
    tenant_name = null,
    payer_name = null,
    resident_count = null,
    move_in_date = null,
    expected_move_in_date = null,
    discount_type = null,
    discount_amount = null,
    -- 연락처·차량 4 (추가 연락처/차량 포함)
    phone = null,
    phone2 = null,
    phone3 = null,
    phones_extra = '{}',
    vehicle_no = null,
    vehicles_extra = '{}',
    sms_opt_in = false,
    alimtalk_opt_in = false,
    -- 관리비·부과 3 (연체료·단수 출력 기본 O)
    transfer_method = 'none',
    late_fee_enabled = true,
    single_print = true,
    -- 고지서 4
    print_enabled = true,
    bill_name_display = 'name',
    bill_delivery = 'post',
    bill_auth = false,
    bill_auth_info = null,
    -- 상태
    status = 'vacant',
    move_out_date = v_date,
    move_out_scheduled_date = null
  where id = p_occupancy_id;

  -- 임대 정보 7필드(lease_type/start_date/end_date/deposit/deposit_date/monthly_rent/jeonse_deposit)
  delete from lease_contracts where occupancy_id = p_occupancy_id;
end $function$;

-- 기존 공실 행 보정(초기화 값이 X였던 것만).
update public.occupancies
   set single_print = true, late_fee_enabled = true
 where status = 'vacant' and deleted_at is null
   and (not single_print or not late_fee_enabled);

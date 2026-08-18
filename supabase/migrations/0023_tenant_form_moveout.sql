-- 0023_tenant_form_moveout.sql
-- 입주자 폼: 이체 방식, 고지서 설정, 퇴실 예약/실행, 전출 연락처 스냅샷

-- ===== 1) 입주자/임대/이력 컬럼 =====
alter table occupancies
  add column if not exists transfer_method text not null default 'none',
  add column if not exists bill_name_display text not null default 'name',
  add column if not exists bill_delivery text not null default 'post',
  add column if not exists bill_auth boolean not null default false,
  add column if not exists move_out_scheduled_date date;

-- 기존 스키마에 없던 입주자 귀속 필드다. 퇴실 시 기획 확정 25필드를 정확히
-- 초기화할 수 있도록 같은 마이그레이션에서 명시적으로 보완한다.
alter table occupancies
  add column if not exists move_in_scheduled_date date,
  add column if not exists discount_type text,
  add column if not exists discount_amount bigint,
  add column if not exists sms_opt_in boolean not null default false,
  add column if not exists alimtalk_opt_in boolean not null default false;

alter table occupancy_history
  add column if not exists phone text,
  add column if not exists phone2 text,
  add column if not exists phone3 text;

-- 기존 lease_contracts에는 7개 임대정보 중 3개가 없었다.
alter table lease_contracts
  add column if not exists lease_type text,
  add column if not exists deposit_date date,
  add column if not exists jeonse_deposit bigint;

-- 부분 적용 뒤 재실행해도 확정 default/not-null 계약을 복구한다.
alter table occupancies
  alter column transfer_method set default 'none',
  alter column bill_name_display set default 'name',
  alter column bill_delivery set default 'post',
  alter column bill_auth set default false,
  alter column sms_opt_in set default false,
  alter column alimtalk_opt_in set default false;
update occupancies set
  transfer_method = coalesce(transfer_method, 'none'),
  bill_name_display = coalesce(bill_name_display, 'name'),
  bill_delivery = coalesce(bill_delivery, 'post'),
  bill_auth = coalesce(bill_auth, false),
  sms_opt_in = coalesce(sms_opt_in, false),
  alimtalk_opt_in = coalesce(alimtalk_opt_in, false)
where transfer_method is null or bill_name_display is null or bill_delivery is null
   or bill_auth is null or sms_opt_in is null or alimtalk_opt_in is null;
alter table occupancies
  alter column transfer_method set not null,
  alter column bill_name_display set not null,
  alter column bill_delivery set not null,
  alter column bill_auth set not null,
  alter column sms_opt_in set not null,
  alter column alimtalk_opt_in set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'occupancies_transfer_method_check'
      and conrelid = 'public.occupancies'::regclass
  ) then
    alter table occupancies add constraint occupancies_transfer_method_check
      check (transfer_method in ('giro','transfer','auto_transfer','deposit','none'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'occupancies_bill_name_display_check'
      and conrelid = 'public.occupancies'::regclass
  ) then
    alter table occupancies add constraint occupancies_bill_name_display_check
      check (bill_name_display in ('none','name','code'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'occupancies_bill_delivery_check'
      and conrelid = 'public.occupancies'::regclass
  ) then
    alter table occupancies add constraint occupancies_bill_delivery_check
      check (bill_delivery in ('post','alimtalk'));
  end if;
end $$;

-- ===== 2) 통합 저장 RPC (0018 최신본 + 신규 입주자 폼 필드) =====
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
        coalesce((p_occupancy->>'late_fee_enabled')::boolean,true), coalesce((p_occupancy->>'single_print')::boolean,false),
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
      single_print = coalesce((p_occupancy->>'single_print')::boolean,false),
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
end $$;
revoke execute on function save_unit_occupancy(bigint,bigint,bigint,jsonb,jsonb,jsonb,jsonb,jsonb) from anon;

-- ===== 3) 퇴실 단일 진실원천 =====
create or replace function execute_move_out(
  p_occupancy_id bigint,
  p_move_out_date date default current_date
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_unit_id bigint;
  v_tenant_name text;
  v_phone text;
  v_phone2 text;
  v_phone3 text;
  v_move_in_date date;
  v_room_type_label text;
  v_status occupancy_status;
  v_effective_date date := coalesce(p_move_out_date, current_date);
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('tenants') then raise exception 'forbidden: tenants required'; end if;

  select o.unit_id, o.tenant_name, o.phone, o.phone2, o.phone3, o.move_in_date, rt.label, o.status
    into v_unit_id, v_tenant_name, v_phone, v_phone2, v_phone3, v_move_in_date, v_room_type_label, v_status
    from occupancies o
    join units u on u.id = o.unit_id and u.deleted_at is null
    join buildings b on b.id = u.building_id and b.org_id = v_org and b.deleted_at is null
    left join room_types rt on rt.id = o.room_type_id
    where o.id = p_occupancy_id and o.deleted_at is null
    for update of o;
  if not found then raise exception 'occupancy not in org'; end if;
  if v_status = 'vacant' then return; end if;

  -- 전화 스냅샷 매핑: phone=주, phone2=부, phone3=집전화.
  insert into occupancy_history(
    unit_id, tenant_name, move_in_date, move_out_date, room_type_label, phone, phone2, phone3
  ) values (
    v_unit_id, v_tenant_name, v_move_in_date, v_effective_date, v_room_type_label, v_phone, v_phone2, v_phone3
  );

  -- 기획 확정 25필드 중 입주자 귀속 18필드만 초기화한다.
  -- 호실/룸/평형, 공과금 계정·계량기, billing_enabled 및 적요/재무 이력은 유지한다.
  update occupancies set
    tenant_name = null,
    payer_name = null,
    resident_count = null,
    move_in_date = null,
    move_in_scheduled_date = null,
    discount_type = null,
    discount_amount = null,
    phone = null,
    phone2 = null,
    phone3 = null,
    vehicle_no = null,
    sms_opt_in = false,
    alimtalk_opt_in = false,
    transfer_method = 'none',
    late_fee_enabled = true,
    single_print = false,
    print_enabled = true,
    bill_name_display = 'name',
    bill_delivery = 'post',
    bill_auth = false,
    status = 'vacant',
    move_out_date = v_effective_date,
    move_out_scheduled_date = null
  where id = p_occupancy_id;

  -- 임대정보 7필드(lease_type/start_date/end_date/deposit/deposit_date/
  -- monthly_rent/jeonse_deposit)는 행 삭제로 함께 초기화한다.
  delete from lease_contracts where occupancy_id = p_occupancy_id;
end $$;

create or replace function schedule_move_out(p_occupancy_id bigint, p_move_out_date date)
returns date language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_scheduled date;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('tenants') then raise exception 'forbidden: tenants required'; end if;
  if p_move_out_date is null or p_move_out_date < current_date then
    raise exception 'move out date must be today or later';
  end if;

  update occupancies o set move_out_scheduled_date = p_move_out_date
    from units u, buildings b
    where o.id = p_occupancy_id and o.unit_id = u.id and u.building_id = b.id
      and b.org_id = v_org and o.deleted_at is null and u.deleted_at is null and b.deleted_at is null
      and o.status <> 'vacant'
    returning o.move_out_scheduled_date into v_scheduled;
  if not found then raise exception 'active occupancy not in org'; end if;
  return v_scheduled;
end $$;

create or replace function cancel_move_out_schedule(p_occupancy_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('tenants') then raise exception 'forbidden: tenants required'; end if;

  update occupancies o set move_out_scheduled_date = null
    from units u, buildings b
    where o.id = p_occupancy_id and o.unit_id = u.id and u.building_id = b.id
      and b.org_id = v_org and o.deleted_at is null and u.deleted_at is null and b.deleted_at is null;
  if not found then raise exception 'occupancy not in org'; end if;
end $$;

create or replace function execute_due_move_outs()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_due record;
  v_executed integer := 0;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('tenants') then raise exception 'forbidden: tenants required'; end if;

  for v_due in
    select o.id, o.move_out_scheduled_date
    from occupancies o
    join units u on u.id = o.unit_id and u.deleted_at is null
    join buildings b on b.id = u.building_id and b.org_id = v_org and b.deleted_at is null
    where o.deleted_at is null
      and o.move_out_scheduled_date is not null
      and o.move_out_scheduled_date <= current_date
      and o.status <> 'vacant'
    order by o.move_out_scheduled_date, o.id
  loop
    perform execute_move_out(v_due.id, v_due.move_out_scheduled_date);
    v_executed := v_executed + 1;
  end loop;
  return v_executed;
end $$;

revoke execute on function execute_move_out(bigint,date) from public, anon;
revoke execute on function schedule_move_out(bigint,date) from public, anon;
revoke execute on function cancel_move_out_schedule(bigint) from public, anon;
revoke execute on function execute_due_move_outs() from public, anon;
grant execute on function execute_move_out(bigint,date) to authenticated;
grant execute on function schedule_move_out(bigint,date) to authenticated;
grant execute on function cancel_move_out_schedule(bigint) to authenticated;
grant execute on function execute_due_move_outs() to authenticated;

-- NOTE: 이사정산 완료(complete_moving_settlement)는 0008의 원래 정의를 유지한다.
-- 그 함수는 'moving' 권한만으로 definer 내부에서 occupancies 공실화+이력을 처리하도록
-- 의도 설계됐다(p7a design 4.3·본문). execute_move_out은 'tenants' 게이트라 재사용 시
-- moving 전용 사용자의 정산 완료가 막힌다 → 재정의하지 않는다(도메인 분리).

-- 0023가 구 정책서 기준으로 추가한 죽은 컬럼 제거: discount_type·discount_amount·move_in_scheduled_date
-- 근거: PRD 정본(tenant-detail.md)에 없음(입주예정일=미래 move_in_date)·폼/TS 미배선·save_unit_occupancy 미참조.
--       유일 참조는 execute_move_out의 reset뿐 → 먼저 함수에서 제거 후 컬럼 드롭.
-- 유지: sms_opt_in·alimtalk_opt_in 은 messaging 0030(list_tenant_alimtalk_consent·schedule_messages)이 라이브 사용 → 드롭 금지.

-- 1) execute_move_out을 0023 정의와 동일하게 재현하되, 죽은 3컬럼 reset 라인만 제거.
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

  -- 기획 확정 25필드 중 입주자 귀속 값 초기화(죽은 3필드는 컬럼 삭제로 대체).
  -- 호실/룸/평형, 공과금 계정·계량기, billing_enabled 및 적요/재무 이력은 유지한다.
  update occupancies set
    tenant_name = null,
    payer_name = null,
    resident_count = null,
    move_in_date = null,
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

-- 2) 죽은 컬럼 드롭(멱등).
alter table occupancies
  drop column if exists discount_type,
  drop column if exists discount_amount,
  drop column if exists move_in_scheduled_date;

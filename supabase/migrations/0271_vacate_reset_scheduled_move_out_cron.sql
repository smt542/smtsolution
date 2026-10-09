-- 0271: 퇴실 초기화 공용화·예약 퇴실 자동 실행 (배포본비교 개선3차 12, 15, 16)
--
-- 12/15. reset_occupancy_on_vacate(occupancy_id, date)
--   정책 `사무실 관리자_입주자 상세.md` 3.10 「퇴실 완료 시 초기화되는 입주자 귀속 값」 25필드
--   (기본정보 7·연락처/차량 4·관리비/부과 3·고지서 4·임대정보 7)를 한 곳에서 초기화한다.
--   - 15번: 기존 execute_move_out에서 빠졌던 expected_move_in_date, discount_type, discount_amount,
--     phones_extra, vehicles_extra 포함. 고지서 「인증」은 bill_auth + bill_auth_info(인증 정보)를 함께 비운다.
--   - 전출정보(occupancy_history)에 phone/phone2/phone3 포함 적재(이미 공실이면 중복 적재하지 않음).
--   - 임대정보 7필드는 lease_contracts 행 삭제로 초기화.
--   - 호실·룸·평형, 공과금 고객번호·계량기, billing_enabled, 부과/수납 이력은 유지(정책 3.10 유지 목록).
--   execute_move_out · complete_moving_settlement · execute_due_move_outs_all 이 호출한다.
--   complete_moving_settlement 의 자동수납은 정산 대상 occupancy(bc.occupancy_id = 정산 occupancy)로
--   한정한다(③ settlement_billing_unpaid 와 동일 범위). payments 에 연체료 컬럼이 없으므로 원금만 수납한다.
--
-- 16. execute_due_move_outs_all(): 전 조직의 도래한 예약 퇴실을 실행하는 서비스 함수(SECURITY DEFINER).
--   pg_cron 'execute-due-move-outs' 매일 UTC 15:05 = KST 00:05. 날짜 기준은 KST 오늘.
--   기존 조회 시 호출(execute_due_move_outs)은 보조 경로로 유지하되 기준일을 KST 오늘로 맞춘다.
--
-- 일회성 보정: 퇴실로 공실이 된(move_out_date 존재) occupancy 에 남은 입주자 귀속 값을 초기화한다.
--   공실 생성 행(move_out_date 없음, 입주 이력 없음)은 퇴실 초기화 대상이 아니므로 건드리지 않는다.

-- ─────────────────────────────────────────────────────────────
-- 1) 공용 초기화 함수
-- ─────────────────────────────────────────────────────────────
create or replace function public.reset_occupancy_on_vacate(
  p_occupancy_id bigint,
  p_move_out_date date
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    -- 관리비·부과 3
    transfer_method = 'none',
    late_fee_enabled = true,
    single_print = false,
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

revoke all on function public.reset_occupancy_on_vacate(bigint, date) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2) execute_move_out: 권한·조직 검증 후 공용 함수 호출(기존 동작 보존)
-- ─────────────────────────────────────────────────────────────
create or replace function public.execute_move_out(p_occupancy_id bigint, p_move_out_date date default current_date)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint;
  v_status occupancy_status;
  v_effective_date date := coalesce(p_move_out_date, (now() at time zone 'Asia/Seoul')::date);
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('tenants') then raise exception 'forbidden: tenants required'; end if;

  select o.status
    into v_status
    from occupancies o
    join units u on u.id = o.unit_id and u.deleted_at is null
    join buildings b on b.id = u.building_id and b.org_id = v_org and b.deleted_at is null
    where o.id = p_occupancy_id and o.deleted_at is null
    for update of o;
  if not found then raise exception 'occupancy not in org'; end if;
  if v_status = 'vacant' then return; end if;

  perform reset_occupancy_on_vacate(p_occupancy_id, v_effective_date);
end $function$;

-- ─────────────────────────────────────────────────────────────
-- 3) complete_moving_settlement: 공실화를 공용 함수로, 자동수납을 정산 occupancy 로 한정
-- ─────────────────────────────────────────────────────────────
create or replace function public.complete_moving_settlement(p_settlement_id bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint;
  v_unit_id bigint;
  v_occupancy_id bigint;
  v_move_out_date date;
  v_status text;
  v_mode text;
  v_row record;
  v_pay_id bigint;
  v_collected_count int := 0;
  v_collected_total bigint := 0;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('moving') then raise exception 'forbidden: moving required'; end if;

  select s.unit_id, s.occupancy_id, s.move_out_date, s.status
    into v_unit_id, v_occupancy_id, v_move_out_date, v_status
    from moving_settlements s
    join units u on u.id = s.unit_id
    join buildings b on b.id = u.building_id and b.org_id = v_org
    where s.id = p_settlement_id
    for update of s;
  if not found then raise exception 'settlement not in org'; end if;
  if v_status = 'completed' then return jsonb_build_object('ok', true); end if;
  if v_occupancy_id is null then raise exception 'settlement has no occupancy'; end if;
  if v_move_out_date is null then raise exception 'move out date required'; end if;

  select coalesce(sc.vacancy_payment_mode, 'manual') into v_mode
    from setup_config sc where sc.org_id = v_org;
  v_mode := coalesce(v_mode, 'manual');

  update moving_settlements
    set status = 'completed', processed_at = now()
    where id = p_settlement_id;

  perform 1 from occupancies
    where id = v_occupancy_id and unit_id = v_unit_id and deleted_at is null;
  if not found then raise exception 'occupancy not in unit'; end if;

  -- 공실화 + 25필드 초기화 + 전화 포함 전출 이력 + 임대정보 삭제(12번).
  perform reset_occupancy_on_vacate(v_occupancy_id, v_move_out_date);
  update occupancies set settlement_note = null where id = v_occupancy_id;

  if v_mode = 'auto' then
    -- 미납 관리비 자동수납: 정산 대상 occupancy 의 확정 부과 period 마다 잔여 미납 원금을 수납 기록.
    -- 범위는 ③ settlement_billing_unpaid(unit, occupancy)와 동일(bc.occupancy_id = 정산 occupancy).
    -- payments 에 연체료 컬럼이 없어 연체료는 수납하지 않는다(원금만).
    for v_row in
      select bc.period,
             bc.occupancy_id as charged_occupancy_id,
             (bc.total_amount - coalesce(sum(p.amount) filter (where p.status = 'active'), 0))::int as unpaid
      from billing_confirmations bc
      left join payments p
        on p.unit_id = bc.unit_id
       and p.period = bc.period
       and p.occupancy_id = bc.occupancy_id   -- reader(list_overdue)와 동일 귀속 합산 → 실행 후 미납=0 보장
      where bc.unit_id = v_unit_id
        and bc.occupancy_id = v_occupancy_id
        and bc.confirmed_at is not null
      group by bc.period, bc.occupancy_id, bc.total_amount
      having (bc.total_amount - coalesce(sum(p.amount) filter (where p.status = 'active'), 0)) > 0
      order by bc.period
    loop
      insert into payments(
        org_id, unit_id, period, occupancy_id, amount, method, kind, memo, paid_at, source, created_by
      ) values (
        v_org, v_unit_id, v_row.period, v_row.charged_occupancy_id, v_row.unpaid,
        'other', 'full', '퇴실정산 자동수납', v_move_out_date, 'manual', auth.uid()
      ) returning id into v_pay_id;

      v_collected_count := v_collected_count + 1;
      v_collected_total := v_collected_total + v_row.unpaid;
    end loop;
  end if;

  if v_collected_count > 0 then
    insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
      values (v_org, auth.uid(), 'SETTLEMENT_AUTOCOLLECT', 'moving_settlements', p_settlement_id::text,
        jsonb_build_object(
          'unit_id', v_unit_id,
          'occupancy_id', v_occupancy_id,
          'move_out_date', v_move_out_date,
          'collected_count', v_collected_count,
          'collected_total', v_collected_total));
  end if;

  -- 수도지침은 다음 월 list_utility_rows가 전월 current를 previous로 읽으므로 별도 이월 write가 없다.
  return jsonb_build_object(
    'ok', true,
    'vacancy_payment_mode', v_mode,
    'collected_count', v_collected_count,
    'collected_total', v_collected_total);
end $function$;

-- ─────────────────────────────────────────────────────────────
-- 4) 예약 퇴실: 조회 시 보조 실행(기준일 KST) + 전 조직 서비스 함수 + pg_cron
-- ─────────────────────────────────────────────────────────────
create or replace function public.execute_due_move_outs()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint;
  v_due record;
  v_executed integer := 0;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
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
      and o.move_out_scheduled_date <= v_today
      and o.status <> 'vacant'
    order by o.move_out_scheduled_date, o.id
  loop
    perform execute_move_out(v_due.id, v_due.move_out_scheduled_date);
    v_executed := v_executed + 1;
  end loop;
  return v_executed;
end $function$;

create or replace function public.execute_due_move_outs_all()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_due record;
  v_executed integer := 0;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  for v_due in
    select o.id, o.move_out_scheduled_date
    from occupancies o
    join units u on u.id = o.unit_id and u.deleted_at is null
    join buildings b on b.id = u.building_id and b.deleted_at is null
    join organizations org on org.id = b.org_id and org.deleted_at is null
    where o.deleted_at is null
      and o.move_out_scheduled_date is not null
      and o.move_out_scheduled_date <= v_today
      and o.status <> 'vacant'
    order by b.org_id, o.move_out_scheduled_date, o.id
  loop
    -- 한 건 실패가 나머지 조직·세대 실행을 막지 않도록 건별 서브트랜잭션.
    begin
      perform reset_occupancy_on_vacate(v_due.id, v_due.move_out_scheduled_date);
      v_executed := v_executed + 1;
    exception when others then
      raise warning 'execute_due_move_outs_all: occupancy % failed: %', v_due.id, sqlerrm;
    end;
  end loop;
  return v_executed;
end $function$;

revoke all on function public.execute_due_move_outs_all() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'execute-due-move-outs') then
    perform cron.unschedule('execute-due-move-outs');
  end if;
  perform cron.schedule('execute-due-move-outs', '5 15 * * *', 'select public.execute_due_move_outs_all()');
end $$;

-- ─────────────────────────────────────────────────────────────
-- 5) 일회성 보정: 퇴실로 공실이 된 행의 잔존 입주자 귀속 값 정리
-- ─────────────────────────────────────────────────────────────
-- 5-1) 정산 완료 경로에서 전화 없이 적재된 전출 이력에 전화 스냅샷 보강(같은 세대·이름·퇴실일).
update occupancy_history h set
  phone = o.phone, phone2 = o.phone2, phone3 = o.phone3
from occupancies o
where o.status = 'vacant'
  and o.move_out_date is not null
  and o.tenant_name is not null
  and (o.phone is not null or o.phone2 is not null or o.phone3 is not null)
  and h.unit_id = o.unit_id
  and h.tenant_name = o.tenant_name
  and h.move_out_date = o.move_out_date
  and h.phone is null and h.phone2 is null and h.phone3 is null;

-- 5-2) 임대정보 삭제
delete from lease_contracts l
using occupancies o
where l.occupancy_id = o.id
  and o.status = 'vacant'
  and o.move_out_date is not null;

-- 5-3) 25필드 초기화(status/move_out_date 는 유지)
update occupancies set
  tenant_name = null,
  payer_name = null,
  resident_count = null,
  move_in_date = null,
  expected_move_in_date = null,
  discount_type = null,
  discount_amount = null,
  phone = null,
  phone2 = null,
  phone3 = null,
  phones_extra = '{}',
  vehicle_no = null,
  vehicles_extra = '{}',
  sms_opt_in = false,
  alimtalk_opt_in = false,
  transfer_method = 'none',
  late_fee_enabled = true,
  single_print = false,
  print_enabled = true,
  bill_name_display = 'name',
  bill_delivery = 'post',
  bill_auth = false,
  bill_auth_info = null,
  move_out_scheduled_date = null
where status = 'vacant'
  and move_out_date is not null
  and (tenant_name is not null or payer_name is not null or resident_count is not null
    or move_in_date is not null or expected_move_in_date is not null or discount_type is not null
    or discount_amount is not null or phone is not null or phone2 is not null or phone3 is not null
    or phones_extra <> '{}' or vehicle_no is not null or vehicles_extra <> '{}'
    or sms_opt_in or alimtalk_opt_in or transfer_method <> 'none' or not late_fee_enabled
    or single_print or not print_enabled or bill_name_display <> 'name' or bill_delivery <> 'post'
    or bill_auth or bill_auth_info is not null or move_out_scheduled_date is not null);

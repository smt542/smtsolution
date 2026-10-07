-- 0232_partner_meter_guard.sql
-- 문제점 개선1차 #10: 파트너 검침 저장이 부과 확정된 달도 수정함.
-- 기존 partner_save_meter_readings(0072, 유일한 정의)는
--  - current_user_is_field_partner()를 확인하지 않았고,
--  - utility_confirmations(건물·공과금·월 단위 확정)를 확인하지 않아 확정된 달 지침도 덮어썼다.
--
-- 조치:
--  - (현장 파트너 여부 검사는 넣지 않았다: 검침 담당으로 배정된 사무실 직원도 이 화면을 쓴다.
--     접근 범위는 기존대로 partner_my_building_ids()가 막는다.)
--  - 저장하려는 건물·공과금·월이 utility_confirmations에 확정(confirmed_at not null)되어 있으면
--    한국어 메시지로 거절한다(트랜잭션 전체 롤백 → 일부만 저장되는 일 없음).
--    utility_confirmations.period는 월 1일(check 제약)이므로 date_trunc('month')로 맞춰 비교한다.
-- 하지 않은 것: calc_charge·unit_price·needs_review 재계산은 이번 범위 밖이다
--   (미확정 달은 사무실 확정 전 재계산 경로에서 처리되어야 함 — 별도 과제).
-- 그 외 본문은 실 DB 정의와 동일. create or replace는 기존 ACL을 유지한다.

create or replace function public.partner_save_meter_readings(p_building_id bigint, p_period date, p_readings jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_item jsonb; v_unit bigint; v_util text; v_prev numeric; v_cur numeric; v_use numeric;
begin
  if p_building_id not in (select partner_my_building_ids()) then
    raise exception 'forbidden: not your building';
  end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_readings, '[]'::jsonb)) loop
    v_unit := (v_item->>'unit_id')::bigint;
    v_util := v_item->>'utility';
    if v_util not in ('water', 'elec', 'gas') then continue; end if;
    if exists (
      select 1 from utility_confirmations uc
      where uc.building_id = p_building_id
        and uc.utility = v_util
        and uc.period = date_trunc('month', p_period)::date
        and uc.confirmed_at is not null
    ) then
      raise exception '이미 확정된 검침월입니다. 확정된 달의 지침은 수정할 수 없습니다. (%, %)',
        v_util, to_char(p_period, 'YYYY-MM');
    end if;
    if not exists (
      select 1 from units where id = v_unit and building_id = p_building_id and deleted_at is null
    ) then
      continue;
    end if;
    v_prev := nullif(v_item->>'previous_reading', '')::numeric;
    v_cur := nullif(v_item->>'current_reading', '')::numeric;
    v_use := case when v_cur is not null and v_prev is not null then greatest(0, v_cur - v_prev) else null end;
    update meter_readings set previous_reading = v_prev, current_reading = v_cur, usage = v_use
      where unit_id = v_unit and utility = v_util and period = p_period;
    if not found then
      insert into meter_readings(unit_id, utility, period, previous_reading, current_reading, usage)
        values (v_unit, v_util, p_period, v_prev, v_cur, v_use);
    end if;
  end loop;
end $function$;

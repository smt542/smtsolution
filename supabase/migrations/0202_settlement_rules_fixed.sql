-- 0202: 이사정산 정산 기준 3개를 고정값으로 — 수도 단가 반영·전기 단가 반영·공실 수납 수동
--
-- 퍼블리싱 QA S26(2026-09-29) 2-a: 셋업 > 이사정산 설정 > 정산 기준의 수도 단가 반영·전기 단가 반영은
-- 기본 '반영', 공실 수납 처리는 기본 '수동'으로 하고 셋 다 변경할 수 없게(disabled) 한다.
-- 정본 setup.dc.html 도 세 칸이 잠금(.st-seg.lock)이고 설명에 '· 변경 불가'가 붙어 있다.
-- 사용자 결정(2026-09-30): QA대로 수동 고정. 0167 의 공실 수납 기본값 auto(기존 자동수납 동작 보존)를 대체한다.
--
-- · setup_config 세 컬럼 기본값을 true / true / 'manual' 로 바꾸고 기존 행도 같은 값으로 맞춘다.
--   → 공실 수납이 수동이 되어 complete_moving_settlement 는 확정 미납을 자동수납하지 않고 공실 전환만 한다
--     (남은 미납은 수납관리에서 처리). 수도·전기 단가 반영은 운영 조직이 이미 true 였다.
-- · setup_config 행이 없는 조직(셋업을 한 번도 저장하지 않은 조직)도 같은 값을 쓰도록
--   get_settlement_context(0172 정의)·complete_moving_settlement(0167 정의)의 빈 설정 기본값만 바꾼다.
--   두 함수 본문은 운영 prosrc 와 글자 단위로 같은 것을 확인하고 옮겼다(2026-09-30).
--
-- ※ 운영 적용은 Claude/사용자가 Management API로 한다.

-- =====================================================================
-- A) setup_config 기본값 + 기존 행
-- =====================================================================
alter table setup_config alter column water_unit_reflect set default true;
alter table setup_config alter column electric_unit_reflect set default true;
alter table setup_config alter column vacancy_payment_mode set default 'manual';

update setup_config
  set water_unit_reflect = true,
      electric_unit_reflect = true,
      vacancy_payment_mode = 'manual',
      updated_at = now()
  where water_unit_reflect is distinct from true
     or electric_unit_reflect is distinct from true
     or vacancy_payment_mode is distinct from 'manual';

-- =====================================================================
-- B) get_settlement_context — 0172 정의에서 설정 행이 없을 때의 기본값만 변경
-- =====================================================================
create or replace function get_settlement_context(
  p_unit_id bigint,
  p_settlement_id bigint default null
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org bigint;
  v_unit jsonb;
  v_occupancy jsonb;
  v_settlement_id bigint;
  v_settlement jsonb;
  v_account jsonb;
  v_settings jsonb;
  v_checklist jsonb;
  v_meter_summary jsonb;
  v_period date;
  v_billing_unpaid bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;

  select jsonb_build_object(
      'id', u.id,
      'unit_no', u.unit_no,
      'dong', u.dong,
      'building_id', u.building_id,
      'building_name', b.name
    ) into v_unit
    from units u
    join buildings b on b.id = u.building_id and b.org_id = v_org
    where u.id = p_unit_id and u.deleted_at is null;
  if v_unit is null then raise exception 'unit not in org'; end if;

  select jsonb_build_object(
      'id', o.id,
      'tenant_name', o.tenant_name,
      'phone', o.phone,
      'alimtalk_opt_in', coalesce(o.alimtalk_opt_in, false),
      'move_in_date', o.move_in_date,
      'settlement_note', o.settlement_note,
      'billing_note', o.billing_note,
      'status', o.status
    ) into v_occupancy
    from occupancies o
    where o.unit_id = p_unit_id and o.deleted_at is null
    order by o.created_at desc limit 1;

  if p_settlement_id is not null then
    -- 지정 건은 status 로 거르지 않는다(완료된 과거 건도 열어봐야 한다).
    -- unit_id 로 묶어 조회하므로 위에서 검증한 org 스코프를 벗어나지 않는다.
    select s.id, to_jsonb(s) into v_settlement_id, v_settlement
      from moving_settlements s
      where s.id = p_settlement_id and s.unit_id = p_unit_id;
    if v_settlement is null then raise exception 'settlement not in unit'; end if;
  else
    select s.id, to_jsonb(s) into v_settlement_id, v_settlement
      from moving_settlements s
      where s.unit_id = p_unit_id and s.status in ('draft','saved')
      order by s.created_at desc limit 1;
  end if;

  -- 검침 기준월: 정산건의 퇴실월. 신규 작성(퇴실일 미입력)이면 null → 최신 검침을 쓴다.
  v_period := date_trunc('month', (v_settlement->>'move_out_date')::date)::date;

  select jsonb_build_object(
      'settle_bank', sc.settle_bank,
      'settle_acct', sc.settle_acct,
      'settle_holder', sc.settle_holder
    ) into v_account
    from setup_config sc where sc.org_id = v_org;
  v_account := coalesce(v_account, jsonb_build_object(
    'settle_bank', null, 'settle_acct', null, 'settle_holder', null
  ));

  select jsonb_build_object(
      'water_unit_reflect', coalesce(sc.water_unit_reflect, true),
      'electric_unit_reflect', coalesce(sc.electric_unit_reflect, true),
      'vacancy_payment_mode', coalesce(sc.vacancy_payment_mode, 'manual')
    ) into v_settings
    from setup_config sc where sc.org_id = v_org;
  v_settings := coalesce(v_settings, jsonb_build_object(
    'water_unit_reflect', true, 'electric_unit_reflect', true, 'vacancy_payment_mode', 'manual'
  ));

  -- billing 미납액: 확정 부과된 period 의 (부과액 - 유효수납) 합. 0132 자동수납 루프와 동일 귀속.
  select coalesce(sum(greatest(0, per_period.unpaid)), 0) into v_billing_unpaid
    from (
      select (bc.total_amount - coalesce(sum(p.amount) filter (where p.status = 'active'), 0))::bigint as unpaid
      from billing_confirmations bc
      left join payments p
        on p.unit_id = bc.unit_id
       and p.period = bc.period
       and p.occupancy_id = bc.occupancy_id
      where bc.unit_id = p_unit_id
        and bc.confirmed_at is not null
      group by bc.period, bc.occupancy_id, bc.total_amount
    ) per_period;

  select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', sci.id,
        'label', sci.label,
        'checked', coalesce(scr.checked, false),
        'note', scr.note
      ) order by sci.sort_order, sci.id
    ), '[]'::jsonb) into v_checklist
    from settlement_check_items sci
    left join settlement_checklist_results scr
      on scr.check_item_id = sci.id and scr.settlement_id = v_settlement_id
    where sci.org_id = v_org and sci.deleted_at is null;

  select coalesce(jsonb_agg(
      jsonb_build_object(
        'utility', utility_row.utility,
        'previous_reading', coalesce(cur.previous_reading, prev.current_reading),
        'current_reading', cur.current_reading,
        'unit_price', cur.unit_price,
        'discount_amount', cur.discount_amount,
        -- 실효 요금: 수동 보정 우선, 없으면 계산요금(할인 반영됨). 0014:410 · 0130:383 과 동일한 식.
        'charge', coalesce(cur.manual_charge, cur.calc_charge),
        'usage', coalesce(
          cur.usage,
          case
            when cur.current_reading is not null
              and coalesce(cur.previous_reading, prev.current_reading) is not null
            then cur.current_reading - coalesce(cur.previous_reading, prev.current_reading)
          end
        )
      ) order by utility_row.sort_order
    ), '[]'::jsonb) into v_meter_summary
    from (values ('water', 1), ('elec', 2), ('gas', 3)) as utility_row(utility, sort_order)
    left join lateral (
      select mr.* from meter_readings mr
      where mr.unit_id = p_unit_id and mr.utility = utility_row.utility
        and (v_period is null or mr.period <= v_period)
      order by mr.period desc limit 1
    ) cur on true
    left join meter_readings prev
      on prev.unit_id = p_unit_id and prev.utility = utility_row.utility
      and prev.period = (cur.period - interval '1 month')::date;

  return jsonb_build_object(
    'unit', v_unit,
    'occupancy', v_occupancy,
    'latest_settlement', v_settlement,
    'settle_account', v_account,
    'settlement_settings', v_settings,
    'billing_unpaid', v_billing_unpaid,
    'checklist', v_checklist,
    'meter_summary', v_meter_summary
  );
end $$;
revoke execute on function get_settlement_context(bigint, bigint) from public, anon;
grant execute on function get_settlement_context(bigint, bigint) to authenticated;

-- =====================================================================
-- C) complete_moving_settlement — 0167 정의에서 설정 행이 없을 때의 기본값만 변경
-- =====================================================================
create or replace function complete_moving_settlement(p_settlement_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
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

  update occupancies
    set status = 'vacant', move_out_date = v_move_out_date, settlement_note = null
    where id = v_occupancy_id and unit_id = v_unit_id and deleted_at is null;
  if not found then raise exception 'occupancy not in unit'; end if;

  insert into occupancy_history(unit_id, tenant_name, move_in_date, move_out_date, room_type_label)
    select o.unit_id, o.tenant_name, o.move_in_date, v_move_out_date, rt.label
    from occupancies o
    left join room_types rt on rt.id = o.room_type_id
    where o.id = v_occupancy_id and o.unit_id = v_unit_id;

  if v_mode = 'auto' then
    -- 미납 관리비 자동수납: 확정 부과된 period마다 잔여 미납을 수납 기록.
    -- 귀속 occupancy는 부과 당시 값(bc.occupancy_id)을 사용한다(0131 규약).
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
end $$;
revoke execute on function complete_moving_settlement(bigint) from public, anon;
grant execute on function complete_moving_settlement(bigint) to authenticated;

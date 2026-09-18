-- 0167: 이사정산 설정 3개를 실제 동작에 연결
--
-- /staff/setup?tab=settlement 의 세 설정은 지금까지 저장·조회만 되고 어디서도 읽히지 않았다.
-- P2b 설계에서 "설정값의 실제 소비 → P5·P6·P7" 로 미뤘는데 그 단계가 끝난 뒤에도 누락돼 있었다.
--
-- 결정(사용자 2026-09-18):
--  · 단가 반영 ON  = 공과금 금액을 "해당 퇴실월 검침의 단가 x 사용량" 으로 계산(단가·금액 읽기전용)
--                   OFF = 현행 유지(정산건에 저장된 금액, 단가는 금액/사용량 역산 표시)
--  · 공실 수납 방식 = 설정 우선. 기본값을 auto 로 바꾸고 기존 org 도 auto 로 이관해
--                   0132 의 현행 자동수납 동작을 보존한다. manual 이면 자동수납을 생략한다.
--
-- ※ 라이브 미적용. Claude/사용자가 Management API로 적용한다.

-- =====================================================================
-- A) vacancy_payment_mode 기본값 auto + 기존 org 이관
--   0132 는 설정을 읽지 않고 무조건 자동수납했다(PRD moving-settlement.md §3.4 근거).
--   아래 B/C 로 설정을 실제로 분기시키면 기본값 'manual' 때문에 모든 org 에서
--   자동수납이 꺼진다 → 동작 보존을 위해 기본값을 auto 로 올리고 기존 행도 이관한다.
--   지금까지 이 값은 읽힌 적이 없으므로 'manual' 은 의도적 선택이 아니라 초기 기본값이다.
-- =====================================================================
alter table setup_config alter column vacancy_payment_mode set default 'auto';

update setup_config
  set vacancy_payment_mode = 'auto', updated_at = now()
  where vacancy_payment_mode = 'manual';

-- =====================================================================
-- B) get_settlement_context — 검침 요약을 정산건의 퇴실월로 스코프 + 단가 노출 + 설정 동봉
--   ① meter_summary 가 항상 최신 검침을 돌려줘서 과거 정산건을 열면 전월/이사/량은
--      최신월인데 금액은 그 정산의 저장값이라 단가(=금액/량)가 틀렸다.
--      list_settlement_inquiries 는 이미 period <= date_trunc(month, move_out_date) 로 스코프한다.
--   ② 단가 반영 ON 계산에 쓸 unit_price 를 함께 내린다.
--   ③ settlement_settings 로 단가 반영 2종 + 공실 수납 방식을 한 번에 내려 왕복을 줄인다.
--   0165 의 정의를 그대로 옮기고 위 3가지만 더한다(시그니처 동일 → drop 불필요).
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
      'water_unit_reflect', coalesce(sc.water_unit_reflect, false),
      'electric_unit_reflect', coalesce(sc.electric_unit_reflect, false),
      'vacancy_payment_mode', coalesce(sc.vacancy_payment_mode, 'auto')
    ) into v_settings
    from setup_config sc where sc.org_id = v_org;
  v_settings := coalesce(v_settings, jsonb_build_object(
    'water_unit_reflect', false, 'electric_unit_reflect', false, 'vacancy_payment_mode', 'auto'
  ));

  select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', sci.id,
        'label', sci.label,
        'checked', coalesce(scr.checked, false)
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
    'checklist', v_checklist,
    'meter_summary', v_meter_summary
  );
end $$;
revoke execute on function get_settlement_context(bigint, bigint) from public, anon;
grant execute on function get_settlement_context(bigint, bigint) to authenticated;

-- =====================================================================
-- C) complete_moving_settlement — vacancy_payment_mode 분기
--   0132 의 정의를 그대로 옮기고 자동수납 루프만 mode='auto' 로 게이트한다.
--   manual 이면 미납을 남긴 채 공실 전환만 수행하고, 반환값으로 생략 사실을 알린다
--   (담당자가 수납 화면에서 처리하는 운영). 공실 전환·occupancy_history 는 모드와 무관.
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

  select coalesce(sc.vacancy_payment_mode, 'auto') into v_mode
    from setup_config sc where sc.org_id = v_org;
  v_mode := coalesce(v_mode, 'auto');

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

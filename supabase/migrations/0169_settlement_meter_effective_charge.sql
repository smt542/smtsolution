-- 0169: 단가 반영 ON 의 금액을 시스템 표준 요금식으로 교정
--
-- 0167 에서 단가 반영 ON 을 "사용량 x 단가" 로 구현했는데, 이 시스템의 공과금 요금은
-- 그게 아니다. 검침 저장 RPC(0135)가 계산해 넣는 값이 정본이다:
--
--   calc_charge = greatest(0, round_charge(usage * unit_price, 'round') - coalesce(discount_amount, 0))
--   실효 요금    = coalesce(manual_charge, calc_charge)          -- 0014:410 · 0130:383 과 동일
--
-- 즉 "사용량 x 단가" 는 ①수도 할인(discount_amount ← water_discounts) ②담당자 수동 보정
-- (manual_charge) 을 모두 빠뜨린다. 이사정산은 세입자 최종 정산이라 이 차이가 곧 오차다.
--
-- 그래서 클라이언트에서 곱하지 않고, meter_summary 에 **실효 요금을 그대로 실어** 내린다.
-- 이렇게 하면 이사정산 공과금 금액이 /staff/utilities 의 그 달 요금과 항상 같은 값이 된다.
-- 단가(unit_price)는 표시용으로 유지한다 — 할인·수동보정이 있으면 단가 x 량 != 금액 이며,
-- 이는 정상이다(정본 레이아웃도 단가·량·금액을 별개 셀로 둔다).
--
-- 모바일(partner_get_settlement_context)은 단가를 직접 입력받고 extra.util 에 저장하므로
-- 이 값을 쓰지 않는다 → 0168 그대로 두고 건드리지 않는다.
--
-- ※ 라이브 미적용. Claude/사용자가 Management API로 적용한다.

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
    'checklist', v_checklist,
    'meter_summary', v_meter_summary
  );
end $$;
revoke execute on function get_settlement_context(bigint, bigint) from public, anon;
grant execute on function get_settlement_context(bigint, bigint) to authenticated;

-- 0171: 완료 가드용 billing 미납액을 get_settlement_context 에 추가
--
-- gap-analysis:135 "완료 가드(미수금>0 차단) 미구현(3.12)" 을 붙이기 위한 데이터.
--
-- 결정(사용자 2026-09-18):
--  · Q1 "미수금" = **정산건 미수금과 billing 미납 둘 다**. 정산건 미수금(정산금액-수납액)은
--    폼이 이미 알지만 billing 미납(확정부과-유효수납)은 몰랐다 → 여기서 내려준다.
--  · Q2 자동수납(auto)이 있어도 중도퇴실 경로가 따로 있으므로 **auto 예외는 두지 않는다**.
--    즉 두 완료 액션 모두 미수금을 확인한다(가드는 클라이언트에서).
--  · Q3 **서버 하드블록은 넣지 않는다**("미수금 남긴 채 완료"를 일단 허용). 그래서 이 마이그는
--    RPC 에 가드를 넣지 않고 금액만 노출한다. complete/mid RPC 는 무변경.
--
-- 산식은 0132 의 자동수납 루프와 **동일한 귀속 조인**(p.occupancy_id = bc.occupancy_id)을 쓴다.
-- 그래야 폼이 보여주는 미납액이 미납관리(list_overdue) · 자동수납이 지울 금액과 같은 숫자가 된다.
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
      'water_unit_reflect', coalesce(sc.water_unit_reflect, false),
      'electric_unit_reflect', coalesce(sc.electric_unit_reflect, false),
      'vacancy_payment_mode', coalesce(sc.vacancy_payment_mode, 'auto')
    ) into v_settings
    from setup_config sc where sc.org_id = v_org;
  v_settings := coalesce(v_settings, jsonb_build_object(
    'water_unit_reflect', false, 'electric_unit_reflect', false, 'vacancy_payment_mode', 'auto'
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
    'billing_unpaid', v_billing_unpaid,
    'checklist', v_checklist,
    'meter_summary', v_meter_summary
  );
end $$;
revoke execute on function get_settlement_context(bigint, bigint) from public, anon;
grant execute on function get_settlement_context(bigint, bigint) to authenticated;

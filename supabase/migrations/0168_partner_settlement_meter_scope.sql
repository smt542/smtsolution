-- 0168: partner_get_settlement_context 의 검침 요약도 정산건의 퇴실월로 스코프
--
-- 0167 에서 staff 쪽 get_settlement_context 의 같은 문제를 고쳤다. 모바일(파트너) 쪽도
-- meter_summary 가 `order by mr.period desc limit 1` 로 **항상 최신 검침**을 돌려준다.
--
-- 모바일은 저장 시 단가·입금계좌·입금일을 `moving_settlements.extra.util[]` 에 함께 넣고
-- 열 때 그 값을 우선 쓴다(`_ms.ts` seededUtil) → 모바일에서 저장한 건은 영향이 없다.
-- 문제가 되는 경로는 **extra.util 이 없는 정산건**이다:
--   · staff 화면 저장은 extra 를 쓰지 않는다(save_moving_settlement 는 표준 컬럼만 갱신)
--   · 시드/외부 유입 건도 extra 가 없다
-- 이때 모바일은 meterSummary 로 폴백하는데, 과거 퇴실월 건을 열어도 최신월 지침이 뜬다.
--
-- 0122 의 정의를 그대로 옮기고 meter_summary 의 기간 가드만 더한다(시그니처 동일).
-- staff 쪽과 달리 unit_price·settlement_settings 는 싣지 않는다 — 모바일은 단가 반영 설정을
-- 쓰지 않고 단가를 직접 입력받으므로, 쓰지 않는 값을 내리면 페이로드만 늘어난다.
--
-- ※ 라이브 미적용. Claude/사용자가 Management API로 적용한다.

create or replace function partner_get_settlement_context(
  p_unit_id bigint, p_settlement_id bigint default null
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org bigint;
  v_unit jsonb;
  v_occupancy jsonb;
  v_settlement_id bigint;
  v_settlement jsonb;
  v_account jsonb;
  v_checklist jsonb;
  v_meter_summary jsonb;
  v_period date;
begin
  select b.org_id into v_org
    from units u
    join buildings b on b.id = u.building_id
    where u.id = p_unit_id and u.deleted_at is null
      and b.id in (select partner_my_building_ids());
  if v_org is null then raise exception 'unit not assigned to caller'; end if;

  select jsonb_build_object(
      'id', u.id, 'unit_no', u.unit_no, 'dong', u.dong,
      'building_id', u.building_id, 'building_name', b.name
    ) into v_unit
    from units u
    join buildings b on b.id = u.building_id
    where u.id = p_unit_id and u.deleted_at is null;

  select jsonb_build_object(
      'id', o.id, 'tenant_name', o.tenant_name, 'phone', o.phone,
      'alimtalk_opt_in', coalesce(o.alimtalk_opt_in, false),
      'move_in_date', o.move_in_date, 'settlement_note', o.settlement_note,
      'billing_note', o.billing_note, 'status', o.status
    ) into v_occupancy
    from occupancies o
    where o.unit_id = p_unit_id and o.deleted_at is null
    order by o.created_at desc limit 1;

  if p_settlement_id is not null then
    select s.id, to_jsonb(s) into v_settlement_id, v_settlement
      from moving_settlements s
      where s.id = p_settlement_id and s.unit_id = p_unit_id;
  else
    select s.id, to_jsonb(s) into v_settlement_id, v_settlement
      from moving_settlements s
      where s.unit_id = p_unit_id and s.status in ('draft','saved')
      order by s.created_at desc limit 1;
  end if;

  -- 검침 기준월: 정산건의 퇴실월. 신규 작성(퇴실일 미입력)이면 null → 최신 검침을 쓴다.
  v_period := date_trunc('month', (v_settlement->>'move_out_date')::date)::date;

  select jsonb_build_object(
      'settle_bank', sc.settle_bank, 'settle_acct', sc.settle_acct,
      'settle_holder', sc.settle_holder
    ) into v_account
    from setup_config sc where sc.org_id = v_org;
  v_account := coalesce(v_account, jsonb_build_object(
    'settle_bank', null, 'settle_acct', null, 'settle_holder', null
  ));

  select coalesce(jsonb_agg(
      jsonb_build_object('id', sci.id, 'label', sci.label, 'checked', coalesce(scr.checked, false))
      order by sci.sort_order, sci.id
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
        'usage', coalesce(
          cur.usage,
          case when cur.current_reading is not null and coalesce(cur.previous_reading, prev.current_reading) is not null
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
    'checklist', v_checklist,
    'meter_summary', v_meter_summary
  );
end $$;
revoke execute on function partner_get_settlement_context(bigint, bigint) from public, anon;
grant execute on function partner_get_settlement_context(bigint, bigint) to authenticated;

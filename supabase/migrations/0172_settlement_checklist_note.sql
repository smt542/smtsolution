-- 0172: 정산 체크 항목에 메모(note) 추가
--
-- settlement_checklist_results 는 `checked boolean` 뿐이라, 화면의 420px 입력칸이 사실
-- 체크박스였다 — 무엇을 입력해도 '확인'/빈칸 두 값으로만 저장됐다.
-- 사용자 결정(2026-09-18): **항목별로 메모를 적을 수 있게 한다.**
--
-- · note 컬럼 추가 + 기존 checked=true 행은 note='확인' 로 백필한다(현 표시 보존).
-- · staff 는 note 를 본문으로 쓰고 checked 는 "메모가 비어있지 않음" 으로 파생시킨다.
-- · 모바일은 체크박스 UI 를 유지한다(payload 에 note 를 싣지 않는다) → 저장 RPC 가
--   **payload 에 'note' 키가 있을 때만** note 를 갱신해, 모바일 저장이 사무실 메모를 지우지 않게 한다.
--
-- ※ 라이브 미적용. Claude/사용자가 Management API로 적용한다.

alter table settlement_checklist_results
  add column if not exists note text;

comment on column settlement_checklist_results.note is
  '정산 체크 항목별 메모. staff 화면의 입력값이고 checked 는 이 값이 비어있지 않은지로 파생된다.';

-- 기존 데이터 보존: checked=true 였던 행은 화면에 '확인' 으로 보였으므로 그대로 옮긴다.
update settlement_checklist_results
  set note = '확인'
  where checked = true and note is null;

-- =====================================================================
-- 조회 RPC 2종 — checklist 에 note 노출 (0171 / 0168 정의에서 집계만 변경)
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
      jsonb_build_object('id', sci.id, 'label', sci.label,
                         'checked', coalesce(scr.checked, false), 'note', scr.note)
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


-- =====================================================================
-- 저장 RPC 2종 — p_checklist 의 note 수용 (0008 / 0122 정의에서 루프만 변경)
--   ⚠️ 'note' 키가 없으면 기존 note 를 유지한다(모바일 저장이 메모를 지우지 않도록).
-- =====================================================================
create or replace function save_moving_settlement(
  p_unit_id bigint, p_occupancy_id bigint, p_settlement_id bigint,
  p_data jsonb, p_checklist jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_settlement_id bigint := p_settlement_id;
  v_amount integer;
  v_item jsonb;
  v_check_item_id bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('moving') then raise exception 'forbidden: moving required'; end if;
  if not exists (
    select 1 from units u join buildings b on b.id = u.building_id
    where u.id = p_unit_id and u.deleted_at is null and b.org_id = v_org
  ) then raise exception 'unit not in org'; end if;
  if p_occupancy_id is not null and not exists (
    select 1 from occupancies o
    where o.id = p_occupancy_id and o.unit_id = p_unit_id and o.deleted_at is null
  ) then raise exception 'occupancy not in unit'; end if;

  v_amount :=
    coalesce(nullif(p_data->>'mgmt_fee_prorated','')::integer, 0) +
    coalesce(nullif(p_data->>'water_charge','')::integer, 0) +
    coalesce(nullif(p_data->>'elec_charge','')::integer, 0) +
    coalesce(nullif(p_data->>'gas_charge','')::integer, 0) +
    coalesce(nullif(p_data->>'repair_amount','')::integer, 0);

  if v_settlement_id is null then
    insert into moving_settlements(
      unit_id, occupancy_id, move_out_date, mgmt_fee_monthly, mgmt_fee_prorated,
      water_charge, elec_charge, gas_charge, elec_paid_date, gas_paid_date,
      repair_amount, repair_attribution, repair_memo,
      settle_bank, settle_acct, settle_holder, settlement_amount,
      note, settlement_note, status
    ) values (
      p_unit_id, p_occupancy_id, nullif(p_data->>'move_out_date','')::date,
      nullif(p_data->>'mgmt_fee_monthly','')::integer,
      nullif(p_data->>'mgmt_fee_prorated','')::integer,
      nullif(p_data->>'water_charge','')::integer,
      nullif(p_data->>'elec_charge','')::integer,
      nullif(p_data->>'gas_charge','')::integer,
      nullif(p_data->>'elec_paid_date','')::date,
      nullif(p_data->>'gas_paid_date','')::date,
      nullif(p_data->>'repair_amount','')::integer,
      nullif(p_data->>'repair_attribution',''),
      nullif(p_data->>'repair_memo',''),
      nullif(p_data->>'settle_bank',''),
      nullif(p_data->>'settle_acct',''),
      nullif(p_data->>'settle_holder',''),
      v_amount,
      nullif(p_data->>'note',''),
      nullif(p_data->>'settlement_note',''),
      'saved'
    ) returning id into v_settlement_id;
  else
    update moving_settlements set
      occupancy_id = p_occupancy_id,
      move_out_date = nullif(p_data->>'move_out_date','')::date,
      mgmt_fee_monthly = nullif(p_data->>'mgmt_fee_monthly','')::integer,
      mgmt_fee_prorated = nullif(p_data->>'mgmt_fee_prorated','')::integer,
      water_charge = nullif(p_data->>'water_charge','')::integer,
      elec_charge = nullif(p_data->>'elec_charge','')::integer,
      gas_charge = nullif(p_data->>'gas_charge','')::integer,
      elec_paid_date = nullif(p_data->>'elec_paid_date','')::date,
      gas_paid_date = nullif(p_data->>'gas_paid_date','')::date,
      repair_amount = nullif(p_data->>'repair_amount','')::integer,
      repair_attribution = nullif(p_data->>'repair_attribution',''),
      repair_memo = nullif(p_data->>'repair_memo',''),
      settle_bank = nullif(p_data->>'settle_bank',''),
      settle_acct = nullif(p_data->>'settle_acct',''),
      settle_holder = nullif(p_data->>'settle_holder',''),
      settlement_amount = v_amount,
      note = nullif(p_data->>'note',''),
      settlement_note = nullif(p_data->>'settlement_note',''),
      status = 'saved',
      processed_at = null
      where id = v_settlement_id and unit_id = p_unit_id and status in ('draft','saved');
    if not found then raise exception 'editable settlement not in unit'; end if;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_checklist, '[]'::jsonb)) loop
    v_check_item_id := (v_item->>'check_item_id')::bigint;
    if not exists (
      select 1 from settlement_check_items sci
      where sci.id = v_check_item_id and sci.org_id = v_org and sci.deleted_at is null
    ) then raise exception 'check item % not in org', v_check_item_id; end if;

    -- note 는 payload 에 'note' 키가 있을 때만 갱신한다. 모바일은 checked 만 보내므로
    -- 그 저장이 사무실에서 적은 메모를 지우지 않아야 한다(0172).
    insert into settlement_checklist_results as r(settlement_id, check_item_id, checked, note)
      values (
        v_settlement_id, v_check_item_id,
        coalesce((v_item->>'checked')::boolean, false),
        nullif(v_item->>'note', '')
      )
      on conflict (settlement_id, check_item_id) do update set
        checked = excluded.checked,
        note = case when v_item ? 'note' then excluded.note else r.note end;
  end loop;

  return jsonb_build_object('settlement_id', v_settlement_id, 'settlement_amount', v_amount);
end $$;
revoke execute on function save_moving_settlement(bigint,bigint,bigint,jsonb,jsonb) from public, anon;
grant execute on function save_moving_settlement(bigint,bigint,bigint,jsonb,jsonb) to authenticated;

create or replace function partner_save_moving_settlement(
  p_unit_id bigint, p_occupancy_id bigint, p_settlement_id bigint,
  p_data jsonb, p_checklist jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_settlement_id bigint := p_settlement_id;
  v_amount integer;
  v_item jsonb;
  v_check_item_id bigint;
  v_extra jsonb;
begin
  select b.org_id into v_org
    from units u
    join buildings b on b.id = u.building_id
    where u.id = p_unit_id and u.deleted_at is null
      and b.id in (select partner_my_building_ids());
  if v_org is null then raise exception 'unit not assigned to caller'; end if;

  if p_occupancy_id is not null and not exists (
    select 1 from occupancies o
    where o.id = p_occupancy_id and o.unit_id = p_unit_id and o.deleted_at is null
  ) then raise exception 'occupancy not in unit'; end if;

  v_amount :=
    coalesce(nullif(p_data->>'mgmt_fee_prorated','')::integer, 0) +
    coalesce(nullif(p_data->>'water_charge','')::integer, 0) +
    coalesce(nullif(p_data->>'elec_charge','')::integer, 0) +
    coalesce(nullif(p_data->>'gas_charge','')::integer, 0) +
    coalesce(nullif(p_data->>'repair_amount','')::integer, 0);

  v_extra := case when jsonb_typeof(p_data->'extra') = 'object' then p_data->'extra' else null end;

  if v_settlement_id is null then
    insert into moving_settlements(
      unit_id, occupancy_id, move_out_date, mgmt_fee_monthly, mgmt_fee_prorated,
      water_charge, elec_charge, gas_charge, elec_paid_date, gas_paid_date,
      repair_amount, repair_attribution, repair_memo,
      settle_bank, settle_acct, settle_holder, settlement_amount,
      note, settlement_note, cleaning_cost, extra, checked_by, status
    ) values (
      p_unit_id, p_occupancy_id, nullif(p_data->>'move_out_date','')::date,
      nullif(p_data->>'mgmt_fee_monthly','')::integer,
      nullif(p_data->>'mgmt_fee_prorated','')::integer,
      nullif(p_data->>'water_charge','')::integer,
      nullif(p_data->>'elec_charge','')::integer,
      nullif(p_data->>'gas_charge','')::integer,
      nullif(p_data->>'elec_paid_date','')::date,
      nullif(p_data->>'gas_paid_date','')::date,
      nullif(p_data->>'repair_amount','')::integer,
      nullif(p_data->>'repair_attribution',''),
      nullif(p_data->>'repair_memo',''),
      nullif(p_data->>'settle_bank',''),
      nullif(p_data->>'settle_acct',''),
      nullif(p_data->>'settle_holder',''),
      v_amount,
      nullif(p_data->>'note',''),
      nullif(p_data->>'settlement_note',''),
      nullif(p_data->>'cleaning_cost','')::integer,
      v_extra,
      (select auth.uid()),
      'saved'
    ) returning id into v_settlement_id;
  else
    update moving_settlements set
      occupancy_id = p_occupancy_id,
      move_out_date = nullif(p_data->>'move_out_date','')::date,
      mgmt_fee_monthly = nullif(p_data->>'mgmt_fee_monthly','')::integer,
      mgmt_fee_prorated = nullif(p_data->>'mgmt_fee_prorated','')::integer,
      water_charge = nullif(p_data->>'water_charge','')::integer,
      elec_charge = nullif(p_data->>'elec_charge','')::integer,
      gas_charge = nullif(p_data->>'gas_charge','')::integer,
      elec_paid_date = nullif(p_data->>'elec_paid_date','')::date,
      gas_paid_date = nullif(p_data->>'gas_paid_date','')::date,
      repair_amount = nullif(p_data->>'repair_amount','')::integer,
      repair_attribution = nullif(p_data->>'repair_attribution',''),
      repair_memo = nullif(p_data->>'repair_memo',''),
      settle_bank = nullif(p_data->>'settle_bank',''),
      settle_acct = nullif(p_data->>'settle_acct',''),
      settle_holder = nullif(p_data->>'settle_holder',''),
      settlement_amount = v_amount,
      note = nullif(p_data->>'note',''),
      settlement_note = nullif(p_data->>'settlement_note',''),
      cleaning_cost = nullif(p_data->>'cleaning_cost','')::integer,
      extra = v_extra,
      checked_by = (select auth.uid()),
      status = 'saved',
      processed_at = null
      where id = v_settlement_id and unit_id = p_unit_id and status in ('draft','saved');
    if not found then raise exception 'editable settlement not in unit'; end if;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_checklist, '[]'::jsonb)) loop
    v_check_item_id := (v_item->>'check_item_id')::bigint;
    if not exists (
      select 1 from settlement_check_items sci
      where sci.id = v_check_item_id and sci.org_id = v_org and sci.deleted_at is null
    ) then raise exception 'check item % not in org', v_check_item_id; end if;

    -- note 는 payload 에 'note' 키가 있을 때만 갱신한다. 모바일은 checked 만 보내므로
    -- 그 저장이 사무실에서 적은 메모를 지우지 않아야 한다(0172).
    insert into settlement_checklist_results as r(settlement_id, check_item_id, checked, note)
      values (
        v_settlement_id, v_check_item_id,
        coalesce((v_item->>'checked')::boolean, false),
        nullif(v_item->>'note', '')
      )
      on conflict (settlement_id, check_item_id) do update set
        checked = excluded.checked,
        note = case when v_item ? 'note' then excluded.note else r.note end;
  end loop;

  return jsonb_build_object('settlement_id', v_settlement_id, 'settlement_amount', v_amount);
end $$;
revoke execute on function partner_save_moving_settlement(bigint,bigint,bigint,jsonb,jsonb) from public, anon;
grant execute on function partner_save_moving_settlement(bigint,bigint,bigint,jsonb,jsonb) to authenticated;

-- 0122_partner_moving_settlement.sql
-- 현장(field) 파트너 모바일 "이사정산 등록" 화면 백엔드.
-- 기존 staff 이사정산 원장(moving_settlements/settlement_checklist_results)을 재사용하되,
-- 현장 계정이 "담당 건물"만 읽고/쓰는 SECURITY DEFINER RPC를 추가한다.
-- staff RPC(get_settlement_context/save_moving_settlement)는 current_user_has_module('moving')를
-- 요구하므로 모듈 권한이 없는 field_staff는 호출할 수 없다. 담당 건물(partner_my_building_ids, 0062)
-- 스코프로만 접근하는 partner_* RPC를 별도로 둔다. 기존 staff RLS/정책/화면/RPC는 불변.
-- 의존: 0062(partner_my_building_ids), P2b(settlement_check_items, setup_config),
--       P7a(moving_settlements, settlement_checklist_results), P5a(meter_readings), 0121(cleaning_cost/checked_by).

-- 모바일 폼 부가 항목(단가·입금계좌·관리비 항목별 내역·가수금·기타 항목·청소 상세·수납액·계산일수 등)을
-- 기존 컬럼으로 표현할 수 없어 세대별 정산 레코드에 jsonb로 보관한다(왕복 편집 복원용). staff는 이 컬럼을 읽지 않는다.
alter table public.moving_settlements
  add column if not exists extra jsonb;

-- ===== 정산 입력 컨텍스트(담당 건물 스코프) =====
-- p_settlement_id 지정 시 해당 정산을, 없으면 최신 draft/saved 정산을 latest_settlement로 반환.
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

-- ===== 정산 저장(담당 건물 스코프, 원자적) =====
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

    insert into settlement_checklist_results(settlement_id, check_item_id, checked)
      values (v_settlement_id, v_check_item_id, coalesce((v_item->>'checked')::boolean, false))
      on conflict (settlement_id, check_item_id) do update set checked = excluded.checked;
  end loop;

  return jsonb_build_object('settlement_id', v_settlement_id, 'settlement_amount', v_amount);
end $$;
revoke execute on function partner_save_moving_settlement(bigint,bigint,bigint,jsonb,jsonb) from public, anon;
grant execute on function partner_save_moving_settlement(bigint,bigint,bigint,jsonb,jsonb) to authenticated;

-- ===== 정산 삭제(담당 건물 스코프, 미완료 정산만) =====
create or replace function partner_delete_moving_settlement(p_settlement_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_deleted bigint;
begin
  delete from moving_settlements s
    using units u, buildings b
    where s.id = p_settlement_id
      and u.id = s.unit_id and u.deleted_at is null
      and b.id = u.building_id
      and b.id in (select partner_my_building_ids())
      and s.status in ('draft','saved')
    returning s.id into v_deleted;
  if v_deleted is null then raise exception 'deletable settlement not assigned to caller'; end if;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function partner_delete_moving_settlement(bigint) from public, anon;
grant execute on function partner_delete_moving_settlement(bigint) to authenticated;

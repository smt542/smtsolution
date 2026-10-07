-- 0236_partner_settlement_keep_office_fields.sql
-- 파트너 이사정산 저장이 사무실이 입력한 값을 덮어쓰던 문제(문제점 개선1차 #11).
--   · 파트너 화면엔 수리비 귀책 입력이 없어 항상 null을 보낸다 → 수정 시 기존 귀책을 유지한다.
--   · 정산 계좌는 조직 기본값을 보낸다 → 수정 시 기존 계좌가 있으면 유지하고, 비어 있을 때만 채운다.
-- 신규 생성(insert) 경로와 그 밖의 동작은 기존과 같다.

create or replace function public.partner_save_moving_settlement(p_unit_id bigint, p_occupancy_id bigint, p_settlement_id bigint, p_data jsonb, p_checklist jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

  v_amount := calculate_moving_settlement_amount(p_data);
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
      repair_attribution = coalesce(nullif(p_data->>'repair_attribution',''), repair_attribution),
      repair_memo = nullif(p_data->>'repair_memo',''),
      settle_bank = coalesce(settle_bank, nullif(p_data->>'settle_bank','')),
      settle_acct = coalesce(settle_acct, nullif(p_data->>'settle_acct','')),
      settle_holder = coalesce(settle_holder, nullif(p_data->>'settle_holder','')),
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
end $function$;

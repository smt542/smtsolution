-- 0191_settlement_total_cleaning_cost.sql
-- 이사정산 총액은 관리비 일할 + 수도 + 전기 + 가스 + 수선 + 청소비다.
-- 기존 이력은 이 규칙을 따르지만, 0172의 저장 RPC 두 개는 청소비를 컬럼에만
-- 저장하고 settlement_amount 계산에서 제외했다. 계산 규칙을 한 함수로 고정하고,
-- RPC 외 쓰기(정산 조회 화면의 청소비 수정 포함)도 트리거로 보호한다.

create or replace function calculate_moving_settlement_amount(p_data jsonb)
returns integer
language sql
immutable
set search_path = public
as $$
  select
    coalesce(nullif(p_data->>'mgmt_fee_prorated','')::integer, 0) +
    coalesce(nullif(p_data->>'water_charge','')::integer, 0) +
    coalesce(nullif(p_data->>'elec_charge','')::integer, 0) +
    coalesce(nullif(p_data->>'gas_charge','')::integer, 0) +
    coalesce(nullif(p_data->>'repair_amount','')::integer, 0) +
    coalesce(nullif(p_data->>'cleaning_cost','')::integer, 0)
$$;
revoke execute on function calculate_moving_settlement_amount(jsonb) from public, anon;
grant execute on function calculate_moving_settlement_amount(jsonb) to authenticated;

create or replace function set_moving_settlement_amount()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.settlement_amount := calculate_moving_settlement_amount(
    jsonb_build_object(
      'mgmt_fee_prorated', new.mgmt_fee_prorated,
      'water_charge', new.water_charge,
      'elec_charge', new.elec_charge,
      'gas_charge', new.gas_charge,
      'repair_amount', new.repair_amount,
      'cleaning_cost', new.cleaning_cost
    )
  );
  return new;
end $$;

drop trigger if exists trg_moving_settlement_amount on moving_settlements;
create trigger trg_moving_settlement_amount
before insert or update of mgmt_fee_prorated, water_charge, elec_charge, gas_charge,
  repair_amount, cleaning_cost on moving_settlements
for each row execute function set_moving_settlement_amount();

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

  v_amount := calculate_moving_settlement_amount(p_data);

  if v_settlement_id is null then
    insert into moving_settlements(
      unit_id, occupancy_id, move_out_date, mgmt_fee_monthly, mgmt_fee_prorated,
      water_charge, elec_charge, gas_charge, elec_paid_date, gas_paid_date,
      repair_amount, repair_attribution, repair_memo,
      settle_bank, settle_acct, settle_holder, settlement_amount,
      note, settlement_note, cleaning_cost, status
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

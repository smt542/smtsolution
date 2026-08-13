-- P7a: 이사정산(/staff/moving-settlement)
-- 의존: P1a(units, buildings), P2a(current_user_org, current_user_has_module, my_org_ids, set_updated_at),
--       P2b(setup_config, settlement_check_items, room_types),
--       P3b(occupancies 확장, occupancy_history), P5a(meter_readings)

-- ===== moving_settlements: 세대별 이사정산 이력 =====
create table moving_settlements (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  occupancy_id bigint references occupancies(id) on delete set null,
  move_out_date date,
  mgmt_fee_monthly integer,
  mgmt_fee_prorated integer,
  water_charge integer,
  elec_charge integer,
  gas_charge integer,
  elec_paid_date date,
  gas_paid_date date,
  repair_amount integer,
  repair_attribution text check (repair_attribution in ('owner','manager','office')),
  repair_memo text,
  settle_bank text,
  settle_acct text,
  settle_holder text,
  settlement_amount integer,
  note text,
  settlement_note text,
  status text not null default 'draft' check (status in ('draft','saved','mid_moveout','completed')),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on moving_settlements (unit_id, created_at desc);

-- ===== settlement_checklist_results: 정산별 시설점검 결과 =====
create table settlement_checklist_results (
  id bigint generated always as identity primary key,
  settlement_id bigint not null references moving_settlements(id) on delete cascade,
  check_item_id bigint not null references settlement_check_items(id) on delete cascade,
  checked boolean not null default false,
  unique (settlement_id, check_item_id)
);
create index on settlement_checklist_results (settlement_id);

-- ===== updated_at 트리거 =====
do $$ declare t text; begin
  foreach t in array array['moving_settlements'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();', t);
  end loop; end $$;

-- ===== RLS: select org 개방 / write moving 모듈 =====
alter table moving_settlements enable row level security;
alter table settlement_checklist_results enable row level security;

create policy ms_select on moving_settlements for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy ms_write on moving_settlements for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('moving'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('moving'));
create policy scr_select on settlement_checklist_results for select
  using (settlement_id in (select s.id from moving_settlements s join units u on u.id=s.unit_id join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy scr_write on settlement_checklist_results for all
  using      (settlement_id in (select s.id from moving_settlements s join units u on u.id=s.unit_id join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('moving'))
  with check (settlement_id in (select s.id from moving_settlements s join units u on u.id=s.unit_id join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('moving'));

-- ===== 정산 입력 컨텍스트 조회 RPC =====
create or replace function get_settlement_context(p_unit_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
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
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;

  select jsonb_build_object(
      'id', u.id, 'unit_no', u.unit_no, 'dong', u.dong, 'building_id', u.building_id
    ) into v_unit
    from units u
    join buildings b on b.id = u.building_id and b.org_id = v_org
    where u.id = p_unit_id and u.deleted_at is null;
  if v_unit is null then raise exception 'unit not in org'; end if;

  select jsonb_build_object(
      'id', o.id, 'tenant_name', o.tenant_name, 'move_in_date', o.move_in_date,
      'settlement_note', o.settlement_note, 'billing_note', o.billing_note, 'status', o.status
    ) into v_occupancy
    from occupancies o
    where o.unit_id = p_unit_id and o.deleted_at is null
    order by o.created_at desc limit 1;

  select s.id, to_jsonb(s) into v_settlement_id, v_settlement
    from moving_settlements s
    where s.unit_id = p_unit_id and s.status in ('draft','saved')
    order by s.created_at desc limit 1;

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
revoke execute on function get_settlement_context(bigint) from anon;

-- ===== 정산 저장 RPC(원자적) =====
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

    insert into settlement_checklist_results(settlement_id, check_item_id, checked)
      values (v_settlement_id, v_check_item_id, coalesce((v_item->>'checked')::boolean, false))
      on conflict (settlement_id, check_item_id) do update set checked = excluded.checked;
  end loop;

  return jsonb_build_object('settlement_id', v_settlement_id, 'settlement_amount', v_amount);
end $$;
revoke execute on function save_moving_settlement(bigint,bigint,bigint,jsonb,jsonb) from anon;

-- ===== 정산완료 + 공실 처리 RPC =====
create or replace function complete_moving_settlement(p_settlement_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_unit_id bigint;
  v_occupancy_id bigint;
  v_move_out_date date;
  v_status text;
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

  -- TODO(payments/P6): 미납 수납은 UI 확인 팝업만 제공하며 실제 수납 처리는 후속한다.
  -- 수도지침은 다음 월 list_utility_rows가 전월 current를 previous로 읽으므로 별도 이월 write가 없다.
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function complete_moving_settlement(bigint) from anon;

-- ===== 중도퇴실 처리 RPC =====
create or replace function mid_moveout_settlement(p_settlement_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_unit_id bigint;
  v_occupancy_id bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('moving') then raise exception 'forbidden: moving required'; end if;

  select s.unit_id, s.occupancy_id into v_unit_id, v_occupancy_id
    from moving_settlements s
    join units u on u.id = s.unit_id
    join buildings b on b.id = u.building_id and b.org_id = v_org
    where s.id = p_settlement_id
    for update of s;
  if not found then raise exception 'settlement not in org'; end if;
  if v_occupancy_id is null then raise exception 'settlement has no occupancy'; end if;

  update moving_settlements set status = 'mid_moveout'
    where id = p_settlement_id;
  update occupancies set billing_note = '중도퇴실', print_enabled = false
    where id = v_occupancy_id and unit_id = v_unit_id and deleted_at is null;
  if not found then raise exception 'occupancy not in unit'; end if;

  return jsonb_build_object('ok', true);
end $$;
revoke execute on function mid_moveout_settlement(bigint) from anon;

-- ===== 날짜범위 정산 이력 RPC =====
create or replace function list_settlements(
  p_building_id bigint, p_from date, p_to date
) returns table(
  settlement_id bigint, unit_id bigint, occupancy_id bigint,
  unit_no text, tenant_name text, status text, settlement_amount integer,
  move_out_date date, processed_at timestamptz, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select s.id, s.unit_id, s.occupancy_id,
    u.unit_no, o.tenant_name, s.status, s.settlement_amount,
    s.move_out_date, s.processed_at, s.created_at
  from moving_settlements s
  join units u on u.id = s.unit_id and u.building_id = p_building_id
  join buildings b on b.id = u.building_id and b.org_id = current_user_org()
  left join occupancies o on o.id = s.occupancy_id
  where s.move_out_date between p_from and p_to
  order by u.unit_no, s.created_at desc
$$;
revoke execute on function list_settlements(bigint,date,date) from anon;

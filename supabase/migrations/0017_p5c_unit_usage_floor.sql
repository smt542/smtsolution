-- P5c Task 4: persist unit floor/usage_type through the tenant hub save RPC.
-- Depends on 0016_p5c_utility_mixeduse.sql.

create or replace function save_unit_occupancy(
  p_building_id bigint, p_unit_id bigint, p_occupancy_id bigint,
  p_unit jsonb, p_occupancy jsonb, p_meters jsonb, p_accounts jsonb, p_lease jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_unit_id bigint := p_unit_id; v_occ_id bigint := p_occupancy_id; v_item jsonb;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('tenants') then raise exception 'forbidden: tenants required'; end if;
  if not exists (select 1 from buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org'; end if;

  if v_unit_id is null then
    insert into units(building_id, unit_no, dong, area_pyeong, room_count, floor, usage_type)
      values (p_building_id, p_unit->>'unit_no', p_unit->>'dong',
              nullif(p_unit->>'area_pyeong','')::numeric, nullif(p_unit->>'room_count','')::int,
              nullif(p_unit->>'floor','')::int,
              coalesce(nullif(p_unit->>'usage_type',''), 'residential'))
      returning id into v_unit_id;
  else
    update units set unit_no = coalesce(p_unit->>'unit_no', unit_no),
      dong = coalesce(p_unit->>'dong', dong),
      area_pyeong = coalesce(nullif(p_unit->>'area_pyeong','')::numeric, area_pyeong),
      room_count = coalesce(nullif(p_unit->>'room_count','')::int, room_count),
      floor = case when p_unit ? 'floor' then nullif(p_unit->>'floor','')::int else floor end,
      usage_type = case when p_unit ? 'usage_type'
        then coalesce(nullif(p_unit->>'usage_type',''), 'residential') else usage_type end
      where id = v_unit_id and building_id = p_building_id;
    if not found then raise exception 'unit not in building'; end if;
  end if;

  if v_occ_id is null then
    insert into occupancies(unit_id, tenant_name, payer_name, phone, phone2, phone3, vehicle_no,
      resident_count, room_type_id, move_in_date, move_out_date, status,
      billing_enabled, print_enabled, late_fee_enabled, single_print, billing_note, settlement_note, facility_note)
      values (v_unit_id, p_occupancy->>'tenant_name', p_occupancy->>'payer_name', p_occupancy->>'phone',
        p_occupancy->>'phone2', p_occupancy->>'phone3', p_occupancy->>'vehicle_no',
        nullif(p_occupancy->>'resident_count','')::int, nullif(p_occupancy->>'room_type_id','')::bigint,
        nullif(p_occupancy->>'move_in_date','')::date, nullif(p_occupancy->>'move_out_date','')::date,
        coalesce(p_occupancy->>'status','occupied')::occupancy_status,
        coalesce((p_occupancy->>'billing_enabled')::boolean,true), coalesce((p_occupancy->>'print_enabled')::boolean,true),
        coalesce((p_occupancy->>'late_fee_enabled')::boolean,true), coalesce((p_occupancy->>'single_print')::boolean,false),
        p_occupancy->>'billing_note', p_occupancy->>'settlement_note', p_occupancy->>'facility_note')
      returning id into v_occ_id;
  else
    update occupancies set tenant_name = p_occupancy->>'tenant_name', payer_name = p_occupancy->>'payer_name',
      phone = p_occupancy->>'phone', phone2 = p_occupancy->>'phone2', phone3 = p_occupancy->>'phone3',
      vehicle_no = p_occupancy->>'vehicle_no', resident_count = nullif(p_occupancy->>'resident_count','')::int,
      room_type_id = nullif(p_occupancy->>'room_type_id','')::bigint,
      move_in_date = nullif(p_occupancy->>'move_in_date','')::date, move_out_date = nullif(p_occupancy->>'move_out_date','')::date,
      status = coalesce(p_occupancy->>'status','occupied')::occupancy_status,
      billing_enabled = coalesce((p_occupancy->>'billing_enabled')::boolean,true),
      print_enabled = coalesce((p_occupancy->>'print_enabled')::boolean,true),
      late_fee_enabled = coalesce((p_occupancy->>'late_fee_enabled')::boolean,true),
      single_print = coalesce((p_occupancy->>'single_print')::boolean,false),
      billing_note = p_occupancy->>'billing_note', settlement_note = p_occupancy->>'settlement_note',
      facility_note = p_occupancy->>'facility_note'
      where id = v_occ_id and unit_id = v_unit_id;
    if not found then raise exception 'occupancy not in unit'; end if;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_meters,'[]'::jsonb)) loop
    insert into unit_meters(unit_id, utility, meter_no, customer_no)
      values (v_unit_id, v_item->>'utility', v_item->>'meter_no', v_item->>'customer_no')
      on conflict (unit_id, utility) do update set meter_no = excluded.meter_no, customer_no = excluded.customer_no;
  end loop;
  for v_item in select value from jsonb_array_elements(coalesce(p_accounts,'[]'::jsonb)) loop
    insert into unit_accounts(unit_id, kind, bank, account, holder, cms_member_no)
      values (v_unit_id, v_item->>'kind', v_item->>'bank', v_item->>'account', v_item->>'holder', v_item->>'cms_member_no')
      on conflict (unit_id, kind) do update set bank = excluded.bank, account = excluded.account,
        holder = excluded.holder, cms_member_no = excluded.cms_member_no;
  end loop;
  if p_lease is not null and p_lease <> 'null'::jsonb then
    insert into lease_contracts(occupancy_id, deposit, monthly_rent, start_date, end_date, expiry_alert)
      values (v_occ_id, nullif(p_lease->>'deposit','')::bigint, nullif(p_lease->>'monthly_rent','')::bigint,
        nullif(p_lease->>'start_date','')::date, nullif(p_lease->>'end_date','')::date,
        coalesce((p_lease->>'expiry_alert')::boolean,false))
      on conflict (occupancy_id) do update set deposit = excluded.deposit, monthly_rent = excluded.monthly_rent,
        start_date = excluded.start_date, end_date = excluded.end_date, expiry_alert = excluded.expiry_alert;
  end if;

  return jsonb_build_object('unit_id', v_unit_id, 'occupancy_id', v_occ_id);
end $$;

revoke execute on function save_unit_occupancy(bigint,bigint,bigint,jsonb,jsonb,jsonb,jsonb,jsonb) from anon;

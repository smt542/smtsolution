-- 0189: expose the occupancy fields that are already editable in the tenant form.
-- Keep homepage_password out of the directory RPC: it is a credential and must
-- not be exposed in a multi-tenant grid or its exports.

drop function if exists list_tenants(bigint);

create function list_tenants(p_building_id bigint)
returns table(
  unit_id bigint, occupancy_id bigint, unit_no text, tenant_name text, phone text,
  room_type_label text, resident_count int, move_in_date date,
  is_vacant boolean, is_overdue boolean,
  payer_name text, vehicle_no text, area_pyeong numeric, mgmt_fee_amount bigint,
  billing_enabled boolean, print_enabled boolean, bill_name_display text,
  move_out_date date, expected_move_in_date date, increase_amount bigint, billing_day text,
  late_fee_enabled boolean, single_print boolean,
  transfer_method text, sms_opt_in boolean, billing_note text,
  bill_auth boolean, bill_delivery text, occupancy_created_at timestamptz,
  water_customer_no text, water_meter_no text,
  elec_customer_no text, elec_meter_no text,
  common_elec_customer_no text, common_elec_meter_no text,
  gas_customer_no text, gas_meter_no text,
  kepco_customer_no text, kepco_meter_no text,
  mgmt_account text, water_account text, elec_account text, gas_account text,
  common_elec_no text
) language sql stable security definer set search_path = public as $$
  select u.id, o.id, u.unit_no, o.tenant_name, public.mask_phone(o.phone), rt.label, o.resident_count, o.move_in_date,
    coalesce(o.status = 'vacant', true) as is_vacant,
    false as is_overdue,
    o.payer_name, o.vehicle_no, u.area_pyeong, o.mgmt_fee_amount,
    o.billing_enabled, o.print_enabled, o.bill_name_display,
    o.move_out_date, o.expected_move_in_date, o.increase_amount, o.billing_day,
    o.late_fee_enabled, o.single_print,
    o.transfer_method, o.sms_opt_in, o.billing_note,
    o.bill_auth, o.bill_delivery, o.created_at,
    water_meter.customer_no, water_meter.meter_no,
    elec_meter.customer_no, elec_meter.meter_no,
    coalesce(common_elec_meter.customer_no, common_elec.customer_no),
    common_elec_meter.meter_no,
    gas_meter.customer_no, gas_meter.meter_no,
    coalesce(kepco_meter.customer_no, elec_meter.customer_no),
    coalesce(kepco_meter.meter_no, elec_meter.meter_no),
    mgmt_account.account, water_account.account, elec_account.account, gas_account.account,
    common_elec.customer_no
  from units u
  join buildings b on b.id = u.building_id and b.org_id = current_user_org()
  left join lateral (
    select * from occupancies oc where oc.unit_id = u.id and oc.deleted_at is null
    order by oc.created_at desc limit 1
  ) o on true
  left join room_types rt on rt.id = o.room_type_id
  left join lateral (
    select um.customer_no, um.meter_no
    from unit_meters um
    where um.unit_id = u.id and um.utility = 'water'
    order by um.created_at desc, um.id desc
    limit 1
  ) water_meter on true
  left join lateral (
    select um.customer_no, um.meter_no
    from unit_meters um
    where um.unit_id = u.id and um.utility = 'elec'
    order by um.created_at desc, um.id desc
    limit 1
  ) elec_meter on true
  left join lateral (
    select um.customer_no, um.meter_no
    from unit_meters um
    where um.unit_id = u.id and um.utility = 'elec_shared'
    order by um.created_at desc, um.id desc
    limit 1
  ) common_elec_meter on true
  left join lateral (
    select um.customer_no, um.meter_no
    from unit_meters um
    where um.unit_id = u.id and um.utility = 'gas'
    order by um.created_at desc, um.id desc
    limit 1
  ) gas_meter on true
  left join lateral (
    select um.customer_no, um.meter_no
    from unit_meters um
    where um.unit_id = u.id and um.utility = 'kepco'
    order by um.created_at desc, um.id desc
    limit 1
  ) kepco_meter on true
  left join lateral (
    select ua.account
    from unit_accounts ua
    where ua.unit_id = u.id and ua.kind = 'mgmt'
    order by ua.created_at desc, ua.id desc
    limit 1
  ) mgmt_account on true
  left join lateral (
    select ua.account
    from unit_accounts ua
    where ua.unit_id = u.id and ua.kind = 'water'
    order by ua.created_at desc, ua.id desc
    limit 1
  ) water_account on true
  left join lateral (
    select ua.account
    from unit_accounts ua
    where ua.unit_id = u.id and ua.kind = 'elec'
    order by ua.created_at desc, ua.id desc
    limit 1
  ) elec_account on true
  left join lateral (
    select ua.account
    from unit_accounts ua
    where ua.unit_id = u.id and ua.kind = 'gas'
    order by ua.created_at desc, ua.id desc
    limit 1
  ) gas_account on true
  left join lateral (
    select bcn.customer_no
    from building_customer_numbers bcn
    where bcn.building_id = u.building_id
      and bcn.kind = 'common_elec'
      and bcn.deleted_at is null
    order by bcn.sort_order, bcn.id
    limit 1
  ) common_elec on true
  where u.building_id = p_building_id and u.deleted_at is null
  order by u.unit_no
$$;

revoke execute on function list_tenants(bigint) from public, anon;
grant execute on function list_tenants(bigint) to authenticated;

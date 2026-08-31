-- Building/tenant manager deferred directory columns.

drop function if exists list_tenants(bigint);
create function list_tenants(p_building_id bigint)
returns table(
  unit_id bigint, occupancy_id bigint, unit_no text, tenant_name text, phone text,
  room_type_label text, resident_count int, move_in_date date,
  is_vacant boolean, is_overdue boolean,
  payer_name text, vehicle_no text, area_pyeong numeric,
  billing_enabled boolean, print_enabled boolean, bill_name_display text,
  move_out_date date, late_fee_enabled boolean, single_print boolean,
  transfer_method text, sms_opt_in boolean, billing_note text,
  bill_auth boolean, bill_delivery text, occupancy_created_at timestamptz,
  kepco_customer_no text, kepco_meter_no text,
  mgmt_account text, water_account text, elec_account text, gas_account text,
  common_elec_no text
) language sql stable security definer set search_path = public as $$
  select u.id, o.id, u.unit_no, o.tenant_name, o.phone, rt.label, o.resident_count, o.move_in_date,
    coalesce(o.status = 'vacant', true) as is_vacant,
    false as is_overdue,
    o.payer_name, o.vehicle_no, u.area_pyeong,
    o.billing_enabled, o.print_enabled, o.bill_name_display,
    o.move_out_date, o.late_fee_enabled, o.single_print,
    o.transfer_method, o.sms_opt_in, o.billing_note,
    o.bill_auth, o.bill_delivery, o.created_at,
    elec_meter.customer_no, elec_meter.meter_no,
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
    where um.unit_id = u.id and um.utility = 'elec'
    order by um.created_at desc, um.id desc
    limit 1
  ) elec_meter on true
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

drop function if exists list_buildings(text,uuid,uuid,uuid,int,int);
create function list_buildings(
  p_search text default null, p_manager uuid default null, p_meter uuid default null,
  p_cleaning uuid default null, p_limit int default 20, p_offset int default 0
) returns table(
  id bigint, code text, name text, address text,
  manager_user_id uuid, meter_user_id uuid, cleaning_user_id uuid,
  manager_name text, meter_name text, cleaning_name text,
  total_units bigint, occupied_units bigint, min_meter_day int, total bigint,
  type_label text, owner_name text, owner_phone text, entrance_password text,
  created_at timestamptz
) language sql stable security definer set search_path = public as $$
  with base as (
    select b.* from buildings b
    where b.org_id = current_user_org() and b.deleted_at is null
      and (p_search   is null or b.name ilike '%'||p_search||'%' or b.address ilike '%'||p_search||'%')
      and (p_manager  is null or b.manager_user_id  = p_manager)
      and (p_meter    is null or b.meter_user_id    = p_meter)
      and (p_cleaning is null or b.cleaning_user_id = p_cleaning)
  )
  select base.id, base.code, base.name, base.address,
    base.manager_user_id, base.meter_user_id, base.cleaning_user_id,
    mp.full_name, tp.full_name, cp.full_name,
    (select count(*) from units u where u.building_id = base.id and u.deleted_at is null),
    (select count(*) from units u join occupancies o on o.unit_id = u.id
       where u.building_id = base.id and u.deleted_at is null and o.deleted_at is null and o.status = 'occupied'),
    (select min(bcn.meter_day) from building_customer_numbers bcn where bcn.building_id = base.id and bcn.deleted_at is null),
    count(*) over(),
    bt.label, base.owner_name, base.owner_phone, base.entrance_password, base.created_at
  from base
  left join profiles mp on mp.user_id = base.manager_user_id
  left join profiles tp on tp.user_id = base.meter_user_id
  left join profiles cp on cp.user_id = base.cleaning_user_id
  left join building_types bt on bt.id = base.type_id and bt.org_id = current_user_org()
  order by base.created_at desc
  limit p_limit offset p_offset
$$;
revoke execute on function list_buildings(text,uuid,uuid,uuid,int,int) from anon;

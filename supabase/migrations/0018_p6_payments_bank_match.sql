-- 0018_p6_payments_bank_match.sql
-- P6 Phase B: bank deposit auto-matching (payer number + batch recording)
-- Depends on: P3b (unit_accounts, save_unit_occupancy, occupancies.payer_name),
--             P6 Phase A (payments, list_payment_rows)

-- ===== 1) Payer number =====
alter table unit_accounts add column if not exists payer_no text;

-- ===== 2) save_unit_occupancy: include payer_no in account upserts =====
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
    insert into units(building_id, unit_no, dong, area_pyeong, room_count)
      values (p_building_id, p_unit->>'unit_no', p_unit->>'dong',
              nullif(p_unit->>'area_pyeong','')::numeric, nullif(p_unit->>'room_count','')::int)
      returning id into v_unit_id;
  else
    update units set unit_no = coalesce(p_unit->>'unit_no', unit_no),
      dong = coalesce(p_unit->>'dong', dong),
      area_pyeong = coalesce(nullif(p_unit->>'area_pyeong','')::numeric, area_pyeong),
      room_count = coalesce(nullif(p_unit->>'room_count','')::int, room_count)
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
    insert into unit_accounts(unit_id, kind, bank, account, holder, cms_member_no, payer_no)
      values (v_unit_id, v_item->>'kind', v_item->>'bank', v_item->>'account', v_item->>'holder', v_item->>'cms_member_no', v_item->>'payer_no')
      on conflict (unit_id, kind) do update set bank = excluded.bank, account = excluded.account,
        holder = excluded.holder, cms_member_no = excluded.cms_member_no, payer_no = excluded.payer_no;
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

-- ===== 3) Payment rows: append payer_no and payer_name =====
drop function if exists list_payment_rows(bigint, date);
create or replace function list_payment_rows(p_building_id bigint, p_period date)
returns table(
  unit_id bigint, unit_no text, dong text, occupancy_id bigint, tenant_name text,
  is_vacant boolean, is_auto_debit boolean, due_date date, charged int, paid int,
  payer_no text, payer_name text
) language sql stable security definer set search_path = public as $$
  with u as (
    select id, unit_no, dong from units
    where building_id=p_building_id and deleted_at is null
      and building_id in (select id from buildings where org_id=current_user_org())
  ),
  occ as (
    select distinct on (o.unit_id) o.unit_id, o.id as occupancy_id, o.tenant_name, o.payer_name, o.status
    from occupancies o join u on u.id=o.unit_id
    where o.deleted_at is null
    order by o.unit_id, o.created_at desc, o.id desc
  ),
  pay as (
    select p.unit_id, coalesce(sum(p.amount),0)::int as paid
    from payments p join u on u.id=p.unit_id
    where p.period=p_period and p.status='active'
    group by p.unit_id
  )
  select
    u.id, u.unit_no, u.dong, occ.occupancy_id, occ.tenant_name,
    coalesce(occ.status='vacant', true) as is_vacant,
    (ua.cms_member_no is not null) as is_auto_debit,
    bi.due_date,
    bc.total_amount as charged,
    coalesce(pay.paid, 0) as paid,
    ua.payer_no,
    occ.payer_name
  from u
  left join occ on occ.unit_id=u.id
  left join pay on pay.unit_id=u.id
  left join billing_confirmations bc on bc.unit_id=u.id and bc.period=p_period
  left join lateral (
    select cms_member_no, payer_no from unit_accounts a
    where a.unit_id=u.id and a.kind='mgmt' order by a.id desc limit 1
  ) ua on true
  left join lateral (
    select due_date from bill_issues x
    where x.unit_id=u.id and x.period=p_period
    order by x.issued_at desc nulls last, x.id desc limit 1
  ) bi on true
  order by u.unit_no
$$;
revoke execute on function list_payment_rows(bigint, date) from public, anon;
grant execute on function list_payment_rows(bigint, date) to authenticated;

-- ===== 4) Record bank payments in a batch =====
create or replace function record_bank_payments(p_building_id bigint, p_period date, p_entries jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_item jsonb; v_unit bigint; v_amount int; v_occ bigint;
        v_recorded int := 0; v_skipped int := 0;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('payment') then raise exception 'forbidden: payment required'; end if;
  if not exists (select 1 from buildings where id=p_building_id and org_id=v_org) then
    raise exception 'building not in org'; end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month'; end if;
  if jsonb_typeof(coalesce(p_entries,'[]'::jsonb)) is distinct from 'array' then
    raise exception 'entries must be an array'; end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_entries,'[]'::jsonb)) loop
    v_unit := nullif(v_item->>'unit_id','')::bigint;
    v_amount := nullif(v_item->>'amount','')::int;
    if v_unit is null or coalesce(v_amount,0) <= 0 then v_skipped := v_skipped + 1; continue; end if;
    if not exists (select 1 from units uu join buildings b on b.id=uu.building_id
                   where uu.id=v_unit and uu.building_id=p_building_id and b.org_id=v_org and uu.deleted_at is null) then
      v_skipped := v_skipped + 1; continue; end if;
    select o.id into v_occ from occupancies o where o.unit_id=v_unit and o.deleted_at is null
      order by o.created_at desc, o.id desc limit 1;
    insert into payments(org_id, unit_id, period, occupancy_id, amount, method, kind, memo, paid_at, source, created_by)
      values (v_org, v_unit, p_period, v_occ, v_amount, 'transfer', 'full', nullif(v_item->>'memo',''),
              coalesce(nullif(v_item->>'paid_at','')::date, current_date), 'bank_excel', auth.uid());
    v_recorded := v_recorded + 1;
  end loop;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'PAYMENT_BANK_IMPORT', 'payments', p_building_id::text,
      jsonb_build_object('period', p_period, 'recorded', v_recorded, 'skipped', v_skipped));

  return jsonb_build_object('recorded', v_recorded, 'skipped', v_skipped);
end $$;
revoke execute on function record_bank_payments(bigint, date, jsonb) from public, anon;
grant execute on function record_bank_payments(bigint, date, jsonb) to authenticated;

-- ===== 5) List existing bank payments =====
create or replace function list_bank_payments(p_building_id bigint, p_period date)
returns table(unit_id bigint, amount int, paid_at date)
language sql stable security definer set search_path = public as $$
  select p.unit_id, p.amount, p.paid_at
  from payments p
  join units u on u.id=p.unit_id
  join buildings b on b.id=u.building_id and b.org_id=current_user_org()
  where u.building_id=p_building_id and p.period=p_period
    and p.source='bank_excel' and p.status='active'
$$;
revoke execute on function list_bank_payments(bigint, date) from public, anon;
grant execute on function list_bank_payments(bigint, date) to authenticated;

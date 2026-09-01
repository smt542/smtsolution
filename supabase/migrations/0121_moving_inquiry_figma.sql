-- Figma 673:185236 / 정책 730:6954: 전체 이사조회 통합표 확장.
-- 기존 정산 원장을 유지하면서 조회에 필요한 건물·입주·검침 정보와
-- 통합표에서 직접 편집하는 입금일/청소비 저장 경로를 제공한다.

alter table public.moving_settlements
  add column if not exists cleaning_cost integer,
  add column if not exists checked_by uuid references public.profiles(user_id) on delete set null;

drop function if exists public.list_settlement_inquiries(
  text, bigint, date, date, text, text, integer, integer
);

create function public.list_settlement_inquiries(
  p_type text,
  p_building_id bigint,
  p_from date,
  p_to date,
  p_search text,
  p_status text,
  p_sort text,
  p_limit integer,
  p_offset integer
) returns table(
  settlement_id bigint,
  building_id bigint,
  building_code text,
  building_name text,
  building_address text,
  unit_id bigint,
  occupancy_id bigint,
  dong text,
  unit_no text,
  tenant_name text,
  status text,
  move_out_date date,
  move_in_date date,
  mgmt_fee_prorated integer,
  water_charge integer,
  elec_charge integer,
  gas_charge integer,
  elec_previous_reading numeric,
  elec_current_reading numeric,
  elec_usage numeric,
  gas_previous_reading numeric,
  gas_current_reading numeric,
  gas_usage numeric,
  elec_paid_date date,
  gas_paid_date date,
  repair_amount integer,
  cleaning_cost integer,
  checked_by_name text,
  settlement_amount integer,
  processed_at timestamptz,
  created_at timestamptz,
  total_count bigint
) language plpgsql stable security definer set search_path = public as $$
declare
  v_org bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('moving') then
    raise exception 'forbidden: moving required';
  end if;
  if p_type not in ('water', 'elec', 'gas', 'all') then
    raise exception 'invalid inquiry type';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid date range';
  end if;
  if p_status is not null and p_status not in (
    'draft', 'saved', 'mid_moveout', 'completed', 'incomplete'
  ) then
    raise exception 'invalid settlement status';
  end if;
  if p_sort not in ('code', 'date') then
    raise exception 'invalid inquiry sort';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'limit must be between 1 and 500';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'offset must be zero or greater';
  end if;

  return query
  select
    s.id,
    b.id,
    b.code,
    b.name,
    b.address,
    u.id,
    s.occupancy_id,
    u.dong,
    u.unit_no,
    o.tenant_name,
    s.status,
    s.move_out_date,
    o.move_in_date,
    s.mgmt_fee_prorated,
    s.water_charge,
    s.elec_charge,
    s.gas_charge,
    coalesce(elec.previous_reading, elec_prev.current_reading),
    elec.current_reading,
    coalesce(
      elec.usage,
      elec.current_reading - coalesce(elec.previous_reading, elec_prev.current_reading)
    ),
    coalesce(gas.previous_reading, gas_prev.current_reading),
    gas.current_reading,
    coalesce(
      gas.usage,
      gas.current_reading - coalesce(gas.previous_reading, gas_prev.current_reading)
    ),
    s.elec_paid_date,
    s.gas_paid_date,
    s.repair_amount,
    s.cleaning_cost,
    checker.full_name,
    s.settlement_amount,
    s.processed_at,
    s.created_at,
    count(*) over ()
  from public.moving_settlements s
  join public.units u on u.id = s.unit_id and u.deleted_at is null
  join public.buildings b
    on b.id = u.building_id and b.org_id = v_org and b.deleted_at is null
  left join public.occupancies o on o.id = s.occupancy_id
  left join public.profiles checker on checker.user_id = s.checked_by
  left join lateral (
    select reading.*
    from public.meter_readings reading
    where reading.unit_id = u.id
      and reading.utility = 'elec'
      and reading.period <= date_trunc('month', s.move_out_date)::date
    order by reading.period desc
    limit 1
  ) elec on true
  left join public.meter_readings elec_prev
    on elec_prev.unit_id = u.id
    and elec_prev.utility = 'elec'
    and elec_prev.period = (elec.period - interval '1 month')::date
  left join lateral (
    select reading.*
    from public.meter_readings reading
    where reading.unit_id = u.id
      and reading.utility = 'gas'
      and reading.period <= date_trunc('month', s.move_out_date)::date
    order by reading.period desc
    limit 1
  ) gas on true
  left join public.meter_readings gas_prev
    on gas_prev.unit_id = u.id
    and gas_prev.utility = 'gas'
    and gas_prev.period = (gas.period - interval '1 month')::date
  where s.move_out_date between p_from and p_to
    and (p_building_id is null or b.id = p_building_id)
    and (
      p_status is null
      or (p_status = 'incomplete' and s.status <> 'completed')
      or (p_status <> 'incomplete' and s.status = p_status)
    )
    and (
      p_search is null
      or nullif(btrim(p_search), '') is null
      or b.name ilike '%' || btrim(p_search) || '%'
      or coalesce(b.address, '') ilike '%' || btrim(p_search) || '%'
      or coalesce(u.dong, '') ilike '%' || btrim(p_search) || '%'
      or u.unit_no ilike '%' || btrim(p_search) || '%'
      or coalesce(o.tenant_name, '') ilike '%' || btrim(p_search) || '%'
    )
    and (
      p_type = 'all'
      or (p_type = 'water' and s.water_charge is not null)
      or (p_type = 'elec' and s.elec_charge is not null)
      or (p_type = 'gas' and s.gas_charge is not null)
    )
  order by
    case when p_sort = 'code' then b.code end,
    case when p_sort = 'code' then b.name end,
    case when p_sort = 'code' then u.unit_no end,
    case when p_sort = 'date' then s.move_out_date end desc,
    s.created_at desc,
    s.id desc
  limit p_limit offset p_offset;
end $$;

revoke execute on function public.list_settlement_inquiries(
  text, bigint, date, date, text, text, text, integer, integer
) from public, anon;
grant execute on function public.list_settlement_inquiries(
  text, bigint, date, date, text, text, text, integer, integer
) to authenticated;

create or replace function public.update_settlement_inquiry_rows(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_item jsonb;
  v_settlement_id bigint;
  v_count integer := 0;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('moving') then
    raise exception 'forbidden: moving required';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be an array';
  end if;

  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_settlement_id := nullif(v_item->>'settlement_id', '')::bigint;
    if v_settlement_id is null then raise exception 'settlement id required'; end if;

    update public.moving_settlements settlement
    set
      elec_paid_date = case
        when v_item ? 'elec_paid_date'
          then nullif(v_item->>'elec_paid_date', '')::date
        else settlement.elec_paid_date
      end,
      gas_paid_date = case
        when v_item ? 'gas_paid_date'
          then nullif(v_item->>'gas_paid_date', '')::date
        else settlement.gas_paid_date
      end,
      cleaning_cost = case
        when v_item ? 'cleaning_cost'
          then nullif(v_item->>'cleaning_cost', '')::integer
        else settlement.cleaning_cost
      end,
      checked_by = auth.uid()
    from public.units unit
    join public.buildings building on building.id = unit.building_id
    where settlement.id = v_settlement_id
      and unit.id = settlement.unit_id
      and unit.deleted_at is null
      and building.org_id = v_org
      and building.deleted_at is null;

    if not found then raise exception 'settlement % not in org', v_settlement_id; end if;
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('count', v_count);
end $$;

revoke execute on function public.update_settlement_inquiry_rows(jsonb)
  from public, anon;
grant execute on function public.update_settlement_inquiry_rows(jsonb)
  to authenticated;

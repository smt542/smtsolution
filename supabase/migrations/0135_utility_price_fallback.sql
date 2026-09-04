-- 0135_utility_price_fallback.sql
-- Keep the building's singleton utility price as a fallback only for units that
-- do not have a customer number. A configured but unmatched customer number
-- must remain unpriced instead of silently using another account's price.

create or replace function list_utility_rows(
  p_building_id bigint,
  p_utility text,
  p_period date
) returns table(
  unit_id bigint,
  unit_no text,
  dong text,
  occupancy_id bigint,
  tenant_name text,
  occupancy_status occupancy_status,
  move_in_date date,
  customer_no text,
  meter_no text,
  previous_reading numeric,
  current_reading numeric,
  usage numeric,
  unit_price numeric,
  calc_charge integer,
  discount_amount integer,
  manual_charge integer,
  note text,
  processed_at timestamptz,
  discount_type text,
  resolved_unit_price numeric,
  needs_review boolean
) language sql stable security definer set search_path = public as $$
  select
    u.id,
    u.unit_no,
    u.dong,
    o.id,
    o.tenant_name,
    o.status,
    o.move_in_date,
    m.customer_no,
    m.meter_no,
    coalesce(cur.previous_reading, prev.current_reading) as previous_reading,
    cur.current_reading,
    cur.usage,
    cur.unit_price,
    cur.calc_charge,
    coalesce(cur.discount_amount, wd.amount) as discount_amount,
    cur.manual_charge,
    cur.note,
    cur.processed_at,
    wd.discount_type,
    coalesce(
      (select uup.unit_price
       from unit_meters um
       join building_customer_numbers bcn
         on bcn.building_id = p_building_id
        and bcn.kind = p_utility
        and bcn.customer_no = um.customer_no
        and bcn.deleted_at is null
       join utility_unit_prices uup on uup.building_customer_number_id = bcn.id
       where um.unit_id = u.id and um.utility = p_utility),
      (select usp.unit_price
       from utility_scoped_prices usp
       where usp.building_id = p_building_id
         and usp.utility = p_utility
         and usp.usage_type = u.usage_type
         and usp.floor = u.floor),
      (select usp.unit_price
       from utility_scoped_prices usp
       where usp.building_id = p_building_id
         and usp.utility = p_utility
         and usp.usage_type = u.usage_type
         and usp.floor is null),
      (select max(uup.unit_price)
       from building_customer_numbers bcn
       join utility_unit_prices uup on uup.building_customer_number_id = bcn.id
       where bcn.building_id = p_building_id
         and bcn.kind = p_utility
         and bcn.deleted_at is null
         and nullif(m.customer_no, '') is null
       having count(*) = 1)
    ) as resolved_unit_price,
    coalesce(cur.needs_review, false) as needs_review
  from units u
  join buildings b on b.id = u.building_id and b.org_id = current_user_org()
  left join lateral (
    select *
    from occupancies oc
    where oc.unit_id = u.id and oc.deleted_at is null
    order by oc.created_at desc, oc.id desc
    limit 1
  ) o on true
  left join unit_meters m on m.unit_id = u.id and m.utility = p_utility
  left join meter_readings cur
    on cur.unit_id = u.id and cur.utility = p_utility and cur.period = p_period
  left join meter_readings prev
    on prev.unit_id = u.id
   and prev.utility = p_utility
   and prev.period = (p_period - interval '1 month')::date
  left join water_discounts wd on wd.unit_id = u.id and p_utility = 'water'
  where u.building_id = p_building_id and u.deleted_at is null
  order by u.unit_no
$$;

create or replace function save_meter_readings(
  p_building_id bigint,
  p_utility text,
  p_period date,
  p_rows jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint := current_user_org();
  v_item jsonb;
  v_count int := 0;
  v_unit_id bigint;
  v_prev numeric;
  v_cur numeric;
  v_usage numeric;
  v_explicit_usage numeric;
  v_has_explicit_usage boolean;
  v_fixed_usage numeric;
  v_fixed_usage_from date;
  v_usage_type text;
  v_floor int;
  v_disc integer;
  v_price numeric;
  v_calc integer;
  v_needs_review boolean;
  v_total_calc bigint := 0;
begin
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('utilities') then
    raise exception 'forbidden: utilities required';
  end if;
  if p_utility not in ('water','elec','gas') then
    raise exception 'bad utility %', p_utility;
  end if;
  if not exists (select 1 from buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org';
  end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month';
  end if;
  if p_period > date_trunc('month', now() at time zone 'Asia/Seoul')::date then
    raise exception 'future period is not allowed';
  end if;
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'rows must be an array';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'row entries must be objects';
    end if;
    v_unit_id := nullif(v_item->>'unit_id', '')::bigint;
    if v_unit_id is null or not exists (
      select 1
      from units u
      join buildings b on b.id = u.building_id
      where u.id = v_unit_id
        and u.building_id = p_building_id
        and u.deleted_at is null
        and b.org_id = v_org
    ) then
      raise exception 'unit % not in building/org', v_unit_id;
    end if;

    v_cur := nullif(v_item->>'current_reading', '')::numeric;
    if v_item ? 'previous_reading' then
      v_prev := nullif(v_item->>'previous_reading', '')::numeric;
    else
      select current_reading into v_prev
      from meter_readings
      where unit_id = v_unit_id
        and utility = p_utility
        and period = (p_period - interval '1 month')::date;
    end if;

    select usage_type, floor into v_usage_type, v_floor
    from units
    where id = v_unit_id;

    select fixed_usage, fixed_usage_from into v_fixed_usage, v_fixed_usage_from
    from unit_meters
    where unit_id = v_unit_id and utility = p_utility;

    -- H5: fixed_usage is only honored for the intended commercial/no-meter case.
    --   water/elec: applies to commercial (상가) units only.
    --   gas: keeps its effective-start-month guard (0061); usage_type is not gated
    --        because gas fixed usage predates the commercial scoping decision.
    if v_fixed_usage is not null and not (
      (p_utility = 'gas'
        and (v_fixed_usage_from is null or p_period >= v_fixed_usage_from))
      or (p_utility in ('water','elec') and v_usage_type = 'commercial')
    ) then
      v_fixed_usage := null;
    end if;

    v_explicit_usage := nullif(v_item->>'usage', '')::numeric;
    v_has_explicit_usage := (v_item ? 'usage') and v_explicit_usage is not null;

    -- H6: when both readings are present, an explicit usage must reconcile.
    if v_has_explicit_usage and v_cur is not null and v_prev is not null
       and v_explicit_usage <> (v_cur - v_prev) then
      raise exception
        'usage % for unit % does not match current - previous (%)',
        v_explicit_usage, v_unit_id, (v_cur - v_prev);
    end if;

    v_usage := case
      when v_has_explicit_usage then v_explicit_usage
      when v_fixed_usage is not null then v_fixed_usage
      when v_cur is not null and v_prev is not null then v_cur - v_prev
    end;

    -- H4: a negative computed usage (rollover/replacement) is flagged for review;
    --   it is never silently charged ₩0. Fixed/explicit usage is trusted as entered.
    v_needs_review := (
      v_fixed_usage is null
      and not v_has_explicit_usage
      and v_usage is not null
      and v_usage < 0
    );

    select amount into v_disc
    from water_discounts
    where unit_id = v_unit_id and p_utility = 'water';

    select coalesce(
      (select uup.unit_price
       from unit_meters um
       join building_customer_numbers bcn
         on bcn.building_id = p_building_id
        and bcn.kind = p_utility
        and bcn.customer_no = um.customer_no
        and bcn.deleted_at is null
       join utility_unit_prices uup on uup.building_customer_number_id = bcn.id
       where um.unit_id = v_unit_id and um.utility = p_utility),
      (select usp.unit_price
       from utility_scoped_prices usp
       where usp.building_id = p_building_id
         and usp.utility = p_utility
         and usp.usage_type = v_usage_type
         and usp.floor = v_floor),
      (select usp.unit_price
       from utility_scoped_prices usp
       where usp.building_id = p_building_id
         and usp.utility = p_utility
         and usp.usage_type = v_usage_type
         and usp.floor is null),
      (select max(uup.unit_price)
       from building_customer_numbers bcn
       join utility_unit_prices uup on uup.building_customer_number_id = bcn.id
       where bcn.building_id = p_building_id
         and bcn.kind = p_utility
         and bcn.deleted_at is null
         and not exists (
           select 1
           from unit_meters um
           where um.unit_id = v_unit_id
             and um.utility = p_utility
             and nullif(um.customer_no, '') is not null
         )
       having count(*) = 1)
    ) into v_price;

    -- Flagged rows carry no auto charge so they can never be confirmed as a real ₩0.
    v_calc := case
      when v_needs_review then null
      when v_usage is not null and v_price is not null
        then greatest(0, round_charge(v_usage * v_price, 'round') - coalesce(v_disc, 0))
      else null
    end;

    insert into meter_readings(
      unit_id, utility, period, previous_reading, current_reading, usage,
      unit_price, calc_charge, discount_amount, manual_charge, note, needs_review, processed_at
    ) values (
      v_unit_id, p_utility, p_period, v_prev, v_cur, v_usage,
      v_price, v_calc, v_disc,
      nullif(v_item->>'manual_charge', '')::integer,
      nullif(v_item->>'note', ''),
      v_needs_review,
      now()
    )
    on conflict (unit_id, utility, period) do update set
      previous_reading = excluded.previous_reading,
      current_reading = excluded.current_reading,
      usage = excluded.usage,
      unit_price = excluded.unit_price,
      calc_charge = excluded.calc_charge,
      discount_amount = excluded.discount_amount,
      manual_charge = excluded.manual_charge,
      note = excluded.note,
      needs_review = excluded.needs_review,
      processed_at = excluded.processed_at;

    v_count := v_count + 1;
    v_total_calc := v_total_calc + coalesce(v_calc, 0);
  end loop;

  return jsonb_build_object(
    'saved', v_count,
    'period', p_period,
    'total_calc', v_total_calc
  );
end $$;

revoke execute on function list_utility_rows(bigint,text,date) from public, anon;
revoke execute on function save_meter_readings(bigint,text,date,jsonb) from public, anon;

grant execute on function list_utility_rows(bigint,text,date) to authenticated;
grant execute on function save_meter_readings(bigint,text,date,jsonb) to authenticated;

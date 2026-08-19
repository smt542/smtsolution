-- 0061_gas_fixed_usage_from.sql
-- Effective-start month for gas fixed usage.

alter table unit_meters
  add column if not exists fixed_usage_from date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'unit_meters'::regclass
      and conname = 'unit_meters_fixed_usage_from_month_check'
  ) then
    alter table unit_meters
      add constraint unit_meters_fixed_usage_from_month_check
      check (
        fixed_usage_from is null
        or fixed_usage_from = date_trunc('month', fixed_usage_from)::date
      );
  end if;
end $$;

comment on column unit_meters.fixed_usage_from is 'First month when gas fixed usage applies';

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
  v_fixed_usage numeric;
  v_fixed_usage_from date;
  v_usage_type text;
  v_floor int;
  v_disc integer;
  v_price numeric;
  v_calc integer;
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
    select current_reading into v_prev
    from meter_readings
    where unit_id = v_unit_id
      and utility = p_utility
      and period = (p_period - interval '1 month')::date;
    select fixed_usage, fixed_usage_from into v_fixed_usage, v_fixed_usage_from
    from unit_meters
    where unit_id = v_unit_id and utility = p_utility;
    v_usage := case
      when v_fixed_usage is not null
        and (p_utility <> 'gas' or v_fixed_usage_from is null or p_period >= v_fixed_usage_from)
        then v_fixed_usage
      when v_cur is not null and v_prev is not null then v_cur - v_prev
    end;

    select amount into v_disc
    from water_discounts
    where unit_id = v_unit_id and p_utility = 'water';

    select usage_type, floor into v_usage_type, v_floor
    from units
    where id = v_unit_id;

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
       having count(*) = 1)
    ) into v_price;

    v_calc := case
      when v_usage is not null and v_price is not null
        then greatest(0, round_charge(v_usage * v_price, 'round') - coalesce(v_disc, 0))
      else null
    end;

    insert into meter_readings(
      unit_id, utility, period, previous_reading, current_reading, usage,
      unit_price, calc_charge, discount_amount, manual_charge, note, processed_at
    ) values (
      v_unit_id, p_utility, p_period, v_prev, v_cur, v_usage,
      v_price, v_calc, v_disc,
      nullif(v_item->>'manual_charge', '')::integer,
      nullif(v_item->>'note', ''),
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

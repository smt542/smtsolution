-- 0015_p5c_utility_mixeduse.sql
-- P5c: mixed-use utility pricing by usage/floor and fixed usage support.

alter table units
  add column if not exists floor int,
  add column if not exists usage_type text not null default 'residential'
    check (usage_type in ('residential','commercial'));

alter table unit_meters
  add column if not exists fixed_usage numeric(12,2);

create table if not exists utility_scoped_prices (
  id          bigint primary key generated always as identity,
  building_id bigint not null references buildings(id) on delete cascade,
  utility     text not null check (utility in ('water','elec','gas')),
  usage_type  text not null check (usage_type in ('residential','commercial')),
  floor       int,
  unit_price  numeric(12,2) not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique nulls not distinct (building_id, utility, usage_type, floor)
);

alter table utility_scoped_prices enable row level security;

create policy usp_select on utility_scoped_prices for select
  using (building_id in (
    select id from buildings where org_id in (select my_org_ids())
  ));
create policy usp_write on utility_scoped_prices for all
  using (
    building_id in (select id from buildings where org_id in (select my_org_ids()))
    and current_user_has_module('utilities')
  )
  with check (
    building_id in (select id from buildings where org_id in (select my_org_ids()))
    and current_user_has_module('utilities')
  );

create trigger trg_utility_scoped_prices_updated
  before update on utility_scoped_prices
  for each row execute function set_updated_at();

update units
set floor = (unit_no)::int / 100
where floor is null and unit_no ~ '^[1-9][0-9]{2,3}$';

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
    select fixed_usage into v_fixed_usage
    from unit_meters
    where unit_id = v_unit_id and utility = p_utility;
    v_usage := case
      when v_fixed_usage is not null then v_fixed_usage
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

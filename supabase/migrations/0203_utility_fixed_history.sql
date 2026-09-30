-- 공과금 자물쇠를 달별 이력으로 저장해 잠근 달부터 이후 달에 이어지게 한다.
-- 직접 입력한 량은 지침 차이보다 우선하고, 고정값은 해당 달의 사용량 계산보다 우선한다.

create table if not exists unit_fixed_values (
  unit_id bigint not null references units(id) on delete cascade,
  utility text not null check (utility in ('water','elec','gas')),
  kind text not null check (kind in ('usage','manual')),
  from_period date not null check (from_period = date_trunc('month', from_period)::date),
  value numeric,                -- null = 이 달부터 고정 해제
  updated_at timestamptz not null default now(),
  primary key (unit_id, utility, kind, from_period)
);

alter table unit_fixed_values enable row level security;

create policy ufv_select on unit_fixed_values for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));

revoke all on unit_fixed_values from anon;
grant select on unit_fixed_values to authenticated;

insert into unit_fixed_values (unit_id, utility, kind, from_period, value)
select unit_id, utility, 'usage',
       coalesce(date_trunc('month', fixed_usage_from)::date, date '2000-01-01'),
       fixed_usage
from unit_meters
where fixed_usage is not null
on conflict do nothing;

insert into unit_fixed_values (unit_id, utility, kind, from_period, value)
select unit_id, utility, 'manual',
       coalesce(date_trunc('month', fixed_manual_charge_from)::date, date '2000-01-01'),
       fixed_manual_charge
from unit_meters
where fixed_manual_charge is not null
on conflict do nothing;

comment on column unit_meters.fixed_usage is '0203부터 사용 안 함 — unit_fixed_values 가 기준';
comment on column unit_meters.fixed_usage_from is '0203부터 사용 안 함 — unit_fixed_values 가 기준';
comment on column unit_meters.fixed_manual_charge is '0203부터 사용 안 함 — unit_fixed_values 가 기준';
comment on column unit_meters.fixed_manual_charge_from is '0203부터 사용 안 함 — unit_fixed_values 가 기준';

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

    v_fixed_usage := null;
    select f.value into v_fixed_usage
    from unit_fixed_values f
    where f.unit_id = v_unit_id
      and f.utility = p_utility
      and f.kind = 'usage'
      and f.from_period <= p_period
    order by f.from_period desc
    limit 1;

    -- H5: 달별 이력에서 가장 최근 시작월의 값을 사용한다. null 은 해당 달부터 해제다.
    v_explicit_usage := nullif(v_item->>'usage', '')::numeric;
    v_has_explicit_usage := (v_item ? 'usage') and v_explicit_usage is not null;

    -- H6: 직접 넣은 량이 지침 차이보다 우선한다(정본, 2026-09-30 사용자 결정).
    v_usage := case
      when v_fixed_usage is not null then v_fixed_usage
      when v_has_explicit_usage then v_explicit_usage
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

revoke execute on function save_meter_readings(bigint,text,date,jsonb) from public, anon;
grant execute on function save_meter_readings(bigint,text,date,jsonb) to authenticated;

create or replace function save_unit_fixed_values(
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
  v_kind text;
  v_value numeric;
  v_before numeric;
  v_effective numeric;
  v_next_value numeric;
  v_next_period date;
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

    v_kind := v_item->>'kind';
    if v_kind is null or v_kind not in ('usage','manual') then
      raise exception 'bad fixed value kind %', v_kind;
    end if;
    v_value := nullif(v_item->>'value', '')::numeric;
    if v_value < 0 then
      raise exception 'fixed value must not be negative';
    end if;
    if v_kind = 'manual' and v_value is not null then
      v_value := round(v_value);
    end if;

    v_before := null;
    select value into v_before
    from unit_fixed_values
    where unit_id = v_unit_id
      and utility = p_utility
      and kind = v_kind
      and from_period < p_period
    order by from_period desc
    limit 1;

    if v_value is not distinct from v_before then
      delete from unit_fixed_values
      where unit_id = v_unit_id
        and utility = p_utility
        and kind = v_kind
        and from_period = p_period;
    else
      insert into unit_fixed_values(unit_id, utility, kind, from_period, value, updated_at)
      values (v_unit_id, p_utility, v_kind, p_period, v_value, now())
      on conflict (unit_id, utility, kind, from_period) do update set
        value = excluded.value,
        updated_at = excluded.updated_at;
    end if;

    select value into v_effective
    from unit_fixed_values
    where unit_id = v_unit_id
      and utility = p_utility
      and kind = v_kind
      and from_period <= p_period
    order by from_period desc
    limit 1;

    v_next_period := null;
    v_next_value := null;
    select from_period, value into v_next_period, v_next_value
    from unit_fixed_values
    where unit_id = v_unit_id
      and utility = p_utility
      and kind = v_kind
      and from_period > p_period
    order by from_period
    limit 1;
    if v_next_period is not null and v_next_value is not distinct from v_effective then
      delete from unit_fixed_values
      where unit_id = v_unit_id
        and utility = p_utility
        and kind = v_kind
        and from_period = v_next_period;
    end if;

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('saved', v_count);
end $$;

revoke all on function save_unit_fixed_values(bigint, text, date, jsonb) from public, anon;
grant execute on function save_unit_fixed_values(bigint, text, date, jsonb) to authenticated;

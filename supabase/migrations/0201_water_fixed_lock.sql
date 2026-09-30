-- QA W06 후속(2026-09-30): 수도·가스 호실별 지침 자물쇠도 정본 `.uc-pin`('이 값을 다음 달에도 고정')으로 바꾼다.
--
-- save_meter_readings: 수도 고정 사용량도 주거 호실에 적용하고 적용 시작월 가드를 둔다(0199 에서 전기를 뺀 것과
-- 같은 결정, 사용자 요청 '수도·가스 자물쇠도 정본대로'). 이제 세 공과금 모두 같은 규칙이고, 가스는 0061 부터 이 규칙이었다.
-- H5 조건 외 본문은 0199 와 같다.

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

    -- H5: fixed_usage is honored from its effective-start month (fixed_usage_from; null = always)
    --   for water, elec and gas alike, any usage_type. elec joined gas in 0199, water in 0201 —
    --   the lock pin (정본 '이 값을 다음 달에도 고정') fixes residential units too.
    if v_fixed_usage is not null
       and not (v_fixed_usage_from is null or p_period >= v_fixed_usage_from) then
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

revoke execute on function save_meter_readings(bigint,text,date,jsonb) from public, anon;
grant execute on function save_meter_readings(bigint,text,date,jsonb) to authenticated;

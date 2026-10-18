-- 가스도 수도·전기처럼 고객번호×월 부과액(청구총액) 입력 → 호실 배분(2026-10-18 결정, 가스공과금 정책 3.4 ❓ 해소).
--
--   1) save_utility_customer_bills: 'gas' 허용.
--   2) utility_allocate_period: 'gas' 허용(같은 배분 규칙 utility_allocation_compute).
--   3) 배분 대상 호실 = 계량기 고객번호가 그 번호인 호실 + (등록 번호가 하나뿐이면) 계량기 고객번호가 빈 호실.
--      화면 고객번호 집계(groupRowsByRegisteredCustomer)·list_utility_rows 단가 해석과 같은 묶음(공과금 정책 3.3).
--      이전에는 번호가 정확히 같은 호실만 배분해, 등록 번호 1개 + 번호 빈 호실 건물에서 화면 미리보기와 저장 결과가 달랐다.

create or replace function public.utility_meter_in_customer(
  p_building_id bigint, p_utility text, p_unit_customer_no text, p_customer_no text
)
 returns boolean
 language sql
 stable
 set search_path to 'public'
as $function$
  select coalesce(nullif(btrim(p_unit_customer_no), '') = p_customer_no, false)
      or (
        nullif(btrim(coalesce(p_unit_customer_no, '')), '') is null
        and (select count(*) from building_customer_numbers bcn
              where bcn.building_id = p_building_id and bcn.kind = p_utility and bcn.deleted_at is null) = 1
      );
$function$;

-- SECURITY DEFINER 함수 내부 전용.
revoke all on function public.utility_meter_in_customer(bigint, text, text, text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.utility_allocate_period(p_building_id bigint, p_utility text, p_period date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_bill record;
  v_ids bigint[];
  v_usage numeric[];
  v_disc numeric[];
  v_manual numeric[];
  v_review int;
  v_calc jsonb;
  v_rate numeric;
  v_status text;
  v_allocated bigint;
  v_out jsonb := '[]'::jsonb;
  i int;
begin
  -- 0325: 가스도 배분한다.
  if p_utility not in ('elec', 'water', 'gas') then
    return v_out;
  end if;

  for v_bill in
    select ucb.amount, bcn.id as bcn_id, bcn.customer_no
    from utility_customer_bills ucb
    join building_customer_numbers bcn on bcn.id = ucb.building_customer_number_id
    where bcn.building_id = p_building_id
      and bcn.kind = p_utility
      and bcn.deleted_at is null
      and ucb.period = p_period
    order by bcn.sort_order nulls last, bcn.id
  loop
    select count(*)::int into v_review
    from units u
    left join unit_meters um on um.unit_id = u.id and um.utility = p_utility
    join meter_readings mr on mr.unit_id = u.id and mr.utility = p_utility and mr.period = p_period
    where u.building_id = p_building_id and u.deleted_at is null
      and utility_meter_in_customer(p_building_id, p_utility, um.customer_no, v_bill.customer_no)
      and mr.needs_review
      and mr.manual_charge is null;

    -- 배분 대상: 수동입력 행 + 량이 있는 행. 잔액 흡수 순서 = 호수, id.
    select
      coalesce(array_agg(mr.id order by u.unit_no, u.id), array[]::bigint[]),
      coalesce(array_agg(coalesce(mr.usage, mr.current_reading - coalesce(mr.previous_reading, 0)) order by u.unit_no, u.id), array[]::numeric[]),
      coalesce(array_agg(coalesce(mr.discount_amount, wd.amount, 0)::numeric order by u.unit_no, u.id), array[]::numeric[]),
      coalesce(array_agg(mr.manual_charge::numeric order by u.unit_no, u.id), array[]::numeric[])
    into v_ids, v_usage, v_disc, v_manual
    from units u
    left join unit_meters um on um.unit_id = u.id and um.utility = p_utility
    join meter_readings mr on mr.unit_id = u.id and mr.utility = p_utility and mr.period = p_period
    left join water_discounts wd on wd.unit_id = u.id
    where u.building_id = p_building_id and u.deleted_at is null
      and utility_meter_in_customer(p_building_id, p_utility, um.customer_no, v_bill.customer_no)
      and (mr.manual_charge is not null or (coalesce(mr.usage, mr.current_reading - coalesce(mr.previous_reading, 0)) is not null and not mr.needs_review));

    v_rate := null;
    if v_review > 0 then
      v_status := 'needs_review';
    elsif coalesce(array_length(v_ids, 1), 0) = 0 then
      v_status := 'no_rows';
    else
      v_calc := utility_allocation_compute(v_bill.amount, v_usage, v_disc, v_manual);
      v_status := v_calc->>'status';
      v_rate := nullif(v_calc->>'rate', '')::numeric;
      if v_status in ('ok', 'over_pinned') then
        for i in 1..array_length(v_ids, 1) loop
          if v_manual[i] is null then
            update meter_readings
              set calc_charge = (v_calc->'fees'->>(i - 1))::int,
                  discount_amount = nullif(v_disc[i], 0)::int,
                  unit_price = round(v_rate, 4)
              where id = v_ids[i];
          end if;
        end loop;
      end if;
    end if;

    -- 검산: Σ 호실 부과액(수동 우선)
    select coalesce(sum(coalesce(mr.manual_charge, mr.calc_charge, 0)), 0)::bigint into v_allocated
    from units u
    left join unit_meters um on um.unit_id = u.id and um.utility = p_utility
    join meter_readings mr on mr.unit_id = u.id and mr.utility = p_utility and mr.period = p_period
    where u.building_id = p_building_id and u.deleted_at is null
      and utility_meter_in_customer(p_building_id, p_utility, um.customer_no, v_bill.customer_no);

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'customer_number_id', v_bill.bcn_id,
      'customer_no', v_bill.customer_no,
      'amount', v_bill.amount,
      'allocated', v_allocated,
      'matched', v_allocated = v_bill.amount,
      'status', v_status,
      'rate', case when v_rate is null then null else round(v_rate, 1) end
    ));
  end loop;

  return v_out;
end $function$;

CREATE OR REPLACE FUNCTION public.save_utility_customer_bills(p_building_id bigint, p_utility text, p_period date, p_bills jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org bigint := current_user_org();
  v_item jsonb;
  v_id bigint;
  v_amount numeric;
  v_customer_no text;
  v_removed text[] := array[]::text[];
  v_rows jsonb;
  v_count int := 0;
begin
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('utilities') then
    raise exception 'forbidden: utilities required';
  end if;
  -- 0325: 가스도 고객번호 부과액을 받는다.
  if p_utility not in ('water', 'elec', 'gas') then
    raise exception 'customer bill allocation supports water/elec/gas only';
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
  -- 0275: 확정된 검침월은 총액(=호실 부과액 재배분)을 바꾸지 않는다(협력사 검침 저장과 같은 가드).
  if exists (
    select 1 from utility_confirmations uc
    where uc.building_id = p_building_id and uc.utility = p_utility
      and uc.period = p_period and uc.confirmed_at is not null
  ) then
    raise exception '이미 확정된 검침월입니다. 확정된 달의 청구총액은 수정할 수 없습니다. (%, %)', p_utility, to_char(p_period, 'YYYY-MM');
  end if;
  if jsonb_typeof(coalesce(p_bills, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'bills must be an array';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_bills, '[]'::jsonb)) loop
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'bill entries must be objects';
    end if;
    v_id := nullif(v_item->>'customer_number_id', '')::bigint;
    select customer_no into v_customer_no
    from building_customer_numbers
    where id = v_id and building_id = p_building_id and kind = p_utility and deleted_at is null;
    if v_id is null or v_customer_no is null then
      raise exception 'customer number % not in building/utility', v_id;
    end if;
    v_amount := nullif(v_item->>'amount', '')::numeric;

    if v_amount is null then
      delete from utility_customer_bills
        where building_customer_number_id = v_id and period = p_period;
      if found then v_removed := v_removed || v_customer_no; end if;
    else
      if v_amount < 0 or v_amount <> trunc(v_amount) then
        raise exception 'amount must be a non-negative integer';
      end if;
      insert into utility_customer_bills(building_customer_number_id, period, amount, updated_by)
        values (v_id, p_period, v_amount::int, auth.uid())
        on conflict (building_customer_number_id, period) do update
          set amount = excluded.amount, updated_at = now(), updated_by = excluded.updated_by;
    end if;
    v_count := v_count + 1;
  end loop;

  -- 총액을 지운 고객번호: 기존 계산(단가×량−할인)으로 되돌린다.
  if array_length(v_removed, 1) > 0 then
    -- 저장값을 그대로 다시 넣는다. previous_reading 키는 null 이어도 유지해 전월을 다시 찾지 않게 하고,
    -- needs_review 행은 usage 를 비워 지침 차이로 다시 판정되게 한다(JSON null → 미지정).
    select coalesce(jsonb_agg(jsonb_build_object(
      'unit_id', mr.unit_id,
      'previous_reading', mr.previous_reading,
      'current_reading', mr.current_reading,
      'usage', case when mr.needs_review then null else mr.usage end,
      'manual_charge', mr.manual_charge,
      'note', mr.note
    )), '[]'::jsonb)
    into v_rows
    from units u
    left join unit_meters um on um.unit_id = u.id and um.utility = p_utility
    join meter_readings mr on mr.unit_id = u.id and mr.utility = p_utility and mr.period = p_period
    where u.building_id = p_building_id and u.deleted_at is null
      and exists (
        select 1 from unnest(v_removed) r(customer_no)
        where utility_meter_in_customer(p_building_id, p_utility, um.customer_no, r.customer_no)
      );
    if jsonb_array_length(v_rows) > 0 then
      perform save_meter_readings(p_building_id, p_utility, p_period, v_rows);
    end if;
  end if;

  return jsonb_build_object(
    'saved', v_count,
    'allocation', utility_allocate_period(p_building_id, p_utility, p_period)
  );
end $function$;

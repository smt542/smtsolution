-- 0274: 공과금 고객번호×월 청구총액 → 호실 사용량 비례 배분 (개선3차 6·10·11, 1차 보류 P0-5)
--
-- 정본: previous_lhw/staff/utility-electric/부과액-계산-정책.md, utility-electric.dc.html applyRate()
--       policy/01_공통 정책/부과·정산 계산 규칙 2.1~2.3
--
-- 범위: 전기(elec)·수도(water). 가스는 정책 ❓로 보류 — gas 는 총액 저장·배분 대상이 아니다.
--
-- 옵트인(회귀 방지): 고객번호×월 청구총액(utility_customer_bills)이 없는 달은 기존
--   save_meter_readings 계산(설정 단가 × 량 − 할인, 10원 반올림)을 그대로 둔다.
--   총액이 있는 고객번호·월만 정본 배분으로 calc_charge·unit_price(파생 단가)를 덮어쓴다.
--
-- 배분 순서(정본 3장):
--   1) 수동입력(manual_charge) 호실 분리 — 분자·분모에서 제외, 해당 행은 건드리지 않는다.
--   2) 단가 = (총액 − 수동합 + 잔여호실 할인합) ÷ 잔여량  (gross-up)
--   3) 할인 캡 수렴: 할인 > 그 호실 요금이면 요금 한도까지만, 최대 24회 반복
--   4) 호실 부과액 = max(0, round(량×단가) − 적용할인)  (1원 단위)
--   5) 잔액 흡수: 비수동 호실을 호수(unit_no)·id 순으로 정렬해 몫을 균등 배분 후 앞쪽부터 1원,
--      음수 차액은 부과액 > 0 인 호실에서 앞쪽부터 1원씩 차감
--   검산: Σ coalesce(manual_charge, calc_charge) = 총액 → 반환값 matched
--
-- 배분 제외 행: 량이 없는 행(calc_charge 미변경), needs_review(음수 사용량 확인 필요) 행이
--   하나라도 있는 고객번호는 배분하지 않고 status='needs_review' 로 돌려준다(검산 불일치로 표시).

-- ---------------------------------------------------------------------------
-- 1. 고객번호×월 청구총액 테이블
-- ---------------------------------------------------------------------------
create table if not exists public.utility_customer_bills (
  id bigint generated always as identity primary key,
  building_customer_number_id bigint not null
    references public.building_customer_numbers(id) on delete cascade,
  period date not null check (period = date_trunc('month', period)::date),
  amount integer not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (building_customer_number_id, period)
);

comment on table public.utility_customer_bills is
  '공과금 고객번호×월 관공서 청구총액(부과액). 있으면 호실 부과액을 사용량 비례 배분한다(0274).';

alter table public.utility_customer_bills enable row level security;

drop policy if exists ucb_select on public.utility_customer_bills;
create policy ucb_select on public.utility_customer_bills
  for select using (
    building_customer_number_id in (
      select bcn.id
      from building_customer_numbers bcn
      join buildings b on b.id = bcn.building_id
      where b.org_id in (select my_org_ids())
    )
  );
-- 쓰기는 save_utility_customer_bills RPC(SECURITY DEFINER)로만 한다.

-- ---------------------------------------------------------------------------
-- 2. 순수 배분 계산 (정본 applyRate 1~5단계) — 테스트 가능한 IMMUTABLE 함수
--    입력 배열은 같은 순서(잔액 흡수 순서)로 정렬돼 있어야 한다.
--    p_manual[i] 가 null 이 아니면 수동입력 호실.
-- ---------------------------------------------------------------------------
create or replace function public.utility_allocation_compute(
  p_total numeric,
  p_usage numeric[],
  p_discount numeric[],
  p_manual numeric[]
) returns jsonb
language plpgsql
immutable
set search_path to 'public'
as $function$
declare
  n int := coalesce(array_length(p_usage, 1), 0);
  i int;
  k int;
  v_pinned numeric := 0;
  v_q numeric := 0;
  v_q_all numeric := 0;
  v_rest numeric;
  v_d numeric := 0;
  v_d2 numeric;
  v_rate numeric;
  v_status text := 'ok';
  v_gross numeric;
  v_fee int[] := array[]::int[];
  v_dc_eff int[] := array[]::int[];
  v_pool int[] := array[]::int[];
  v_pos int[];
  v_sum numeric := 0;
  v_diff bigint;
  v_base bigint;
  v_take int;
  v_guard int := 0;
begin
  if p_total is null or n = 0 then
    return jsonb_build_object('status', 'no_input', 'rate', null, 'fees', '[]'::jsonb);
  end if;

  for i in 1..n loop
    v_q_all := v_q_all + coalesce(p_usage[i], 0);
    if p_manual[i] is not null then
      v_pinned := v_pinned + p_manual[i];
    else
      v_q := v_q + coalesce(p_usage[i], 0);
      v_d := v_d + coalesce(p_discount[i], 0);
      v_pool := v_pool || i;
    end if;
  end loop;

  v_rest := p_total - v_pinned;

  -- 정본 7장: 잔여량 0(전 호실 수동입력 등) → 단가 계산 불가, 참고 단가만.
  if v_q <= 0 then
    return jsonb_build_object(
      'status', 'no_pool_usage',
      'rate', null,
      'reference_rate', case when v_q_all > 0 then round(p_total / v_q_all, 1) end,
      'fees', '[]'::jsonb
    );
  end if;

  -- 2단계 gross-up 단가 + 4단계 할인 캡 수렴(최대 24회)
  v_rate := (v_rest + v_d) / v_q;
  for k in 1..24 loop
    v_d2 := 0;
    foreach i in array v_pool loop
      v_d2 := v_d2 + least(coalesce(p_discount[i], 0), round(coalesce(p_usage[i], 0) * v_rate));
    end loop;
    exit when v_d2 = v_d;
    v_d := v_d2;
    v_rate := (v_rest + v_d) / v_q;
  end loop;

  if v_rate < 0 then
    -- 수동입력 합이 총액을 넘는다 — 비수동 호실은 0원, 검산 불일치로 드러난다.
    v_rate := 0;
    v_status := 'over_pinned';
  end if;

  -- 3단계 호실 부과액(1원 단위)
  for i in 1..n loop
    if p_manual[i] is not null then
      v_fee := v_fee || p_manual[i]::int;
      v_dc_eff := v_dc_eff || 0;
    else
      v_gross := round(coalesce(p_usage[i], 0) * v_rate);
      v_dc_eff := v_dc_eff || least(coalesce(p_discount[i], 0), v_gross)::int;
      v_fee := v_fee || greatest(0, v_gross - least(coalesce(p_discount[i], 0), v_gross))::int;
    end if;
    v_sum := v_sum + v_fee[i];
  end loop;

  -- 5단계 잔액 흡수(비수동 호실, 입력 순서 = 호수 순)
  v_diff := (p_total - v_sum)::bigint;
  if v_diff > 0 then
    v_base := v_diff / array_length(v_pool, 1);
    if v_base > 0 then
      foreach i in array v_pool loop
        v_fee[i] := v_fee[i] + v_base;
      end loop;
      v_diff := v_diff - v_base * array_length(v_pool, 1);
    end if;
    k := 1;
    while v_diff > 0 loop
      v_fee[v_pool[k]] := v_fee[v_pool[k]] + 1;
      v_diff := v_diff - 1;
      k := k + 1;
    end loop;
  elsif v_diff < 0 then
    while v_diff < 0 and v_guard < 2000 loop
      v_guard := v_guard + 1;
      v_pos := array[]::int[];
      foreach i in array v_pool loop
        if v_fee[i] > 0 then v_pos := v_pos || i; end if;
      end loop;
      exit when coalesce(array_length(v_pos, 1), 0) = 0;
      v_take := least(-v_diff, array_length(v_pos, 1));
      for k in 1..v_take loop
        v_fee[v_pos[k]] := v_fee[v_pos[k]] - 1;
        v_diff := v_diff + 1;
      end loop;
    end loop;
  end if;

  return jsonb_build_object(
    'status', v_status,
    'rate', v_rate,
    'fees', to_jsonb(v_fee),
    'discounts', to_jsonb(v_dc_eff)
  );
end $function$;

revoke all on function public.utility_allocation_compute(numeric, numeric[], numeric[], numeric[]) from public, anon;
grant execute on function public.utility_allocation_compute(numeric, numeric[], numeric[], numeric[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. 건물·공과금·월 배분 실행(내부용, 권한 확인은 호출자가 한다)
-- ---------------------------------------------------------------------------
create or replace function public.utility_allocate_period(
  p_building_id bigint,
  p_utility text,
  p_period date
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  -- 가스는 정책 ❓ 로 배분 보류(전기·수도만).
  if p_utility not in ('elec', 'water') then
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
    join unit_meters um on um.unit_id = u.id and um.utility = p_utility and um.customer_no = v_bill.customer_no
    join meter_readings mr on mr.unit_id = u.id and mr.utility = p_utility and mr.period = p_period
    where u.building_id = p_building_id and u.deleted_at is null
      and mr.needs_review
      and mr.manual_charge is null;

    -- 배분 대상: 수동입력 행 + 량이 있는 행. 잔액 흡수 순서 = 호수, id.
    select
      coalesce(array_agg(mr.id order by u.unit_no, u.id), array[]::bigint[]),
      coalesce(array_agg(mr.usage order by u.unit_no, u.id), array[]::numeric[]),
      coalesce(array_agg(coalesce(mr.discount_amount, 0)::numeric order by u.unit_no, u.id), array[]::numeric[]),
      coalesce(array_agg(mr.manual_charge::numeric order by u.unit_no, u.id), array[]::numeric[])
    into v_ids, v_usage, v_disc, v_manual
    from units u
    join unit_meters um on um.unit_id = u.id and um.utility = p_utility and um.customer_no = v_bill.customer_no
    join meter_readings mr on mr.unit_id = u.id and mr.utility = p_utility and mr.period = p_period
    where u.building_id = p_building_id and u.deleted_at is null
      and (mr.manual_charge is not null or (mr.usage is not null and not mr.needs_review));

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
                  unit_price = round(v_rate, 4)
              where id = v_ids[i];
          end if;
        end loop;
      end if;
    end if;

    -- 검산: Σ 호실 부과액(수동 우선)
    select coalesce(sum(coalesce(mr.manual_charge, mr.calc_charge, 0)), 0)::bigint into v_allocated
    from units u
    join unit_meters um on um.unit_id = u.id and um.utility = p_utility and um.customer_no = v_bill.customer_no
    join meter_readings mr on mr.unit_id = u.id and mr.utility = p_utility and mr.period = p_period
    where u.building_id = p_building_id and u.deleted_at is null;

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

revoke all on function public.utility_allocate_period(bigint, text, date) from public, anon, authenticated;
grant execute on function public.utility_allocate_period(bigint, text, date) to service_role;

-- ---------------------------------------------------------------------------
-- 4. 청구총액 조회 RPC
-- ---------------------------------------------------------------------------
create or replace function public.list_utility_customer_bills(
  p_building_id bigint,
  p_utility text,
  p_period date
) returns table(customer_number_id bigint, customer_no text, amount integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select bcn.id, bcn.customer_no, ucb.amount
  from building_customer_numbers bcn
  join buildings b on b.id = bcn.building_id and b.org_id = current_user_org()
  left join utility_customer_bills ucb
    on ucb.building_customer_number_id = bcn.id and ucb.period = p_period
  where bcn.building_id = p_building_id
    and bcn.kind = p_utility
    and bcn.deleted_at is null
  order by bcn.sort_order nulls last, bcn.id
$function$;

revoke all on function public.list_utility_customer_bills(bigint, text, date) from public, anon;
grant execute on function public.list_utility_customer_bills(bigint, text, date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. 청구총액 저장 RPC — [{customer_number_id, amount|null}], null/빈값은 총액 삭제(옵트아웃).
--    삭제된 고객번호의 호실은 기존 계산으로 되돌리기 위해 save_meter_readings 로 재계산한다.
-- ---------------------------------------------------------------------------
create or replace function public.save_utility_customer_bills(
  p_building_id bigint,
  p_utility text,
  p_period date,
  p_bills jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  if p_utility not in ('water', 'elec') then
    raise exception 'customer bill allocation supports water/elec only';
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
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'unit_id', mr.unit_id,
      'previous_reading', mr.previous_reading,
      'current_reading', mr.current_reading,
      'usage', case when mr.needs_review then null else mr.usage end,
      'manual_charge', mr.manual_charge,
      'note', mr.note
    ))), '[]'::jsonb)
    into v_rows
    from units u
    join unit_meters um on um.unit_id = u.id and um.utility = p_utility and um.customer_no = any(v_removed)
    join meter_readings mr on mr.unit_id = u.id and mr.utility = p_utility and mr.period = p_period
    where u.building_id = p_building_id and u.deleted_at is null;
    -- previous_reading 키가 없으면 save_meter_readings 가 전월을 다시 찾으므로 null 이어도 키를 유지한다.
    select coalesce(jsonb_agg(r || jsonb_build_object('previous_reading', coalesce(r->'previous_reading', 'null'::jsonb))), '[]'::jsonb)
      into v_rows from jsonb_array_elements(v_rows) r;
    if jsonb_array_length(v_rows) > 0 then
      perform save_meter_readings(p_building_id, p_utility, p_period, v_rows);
    end if;
  end if;

  return jsonb_build_object(
    'saved', v_count,
    'allocation', utility_allocate_period(p_building_id, p_utility, p_period)
  );
end $function$;

revoke all on function public.save_utility_customer_bills(bigint, text, date, jsonb) from public, anon;
grant execute on function public.save_utility_customer_bills(bigint, text, date, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. save_meter_readings — 0266 실정의에서 출발, 저장 후 배분 실행·검산 결과 반환만 추가
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_meter_readings(p_building_id bigint, p_utility text, p_period date, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_allocation jsonb;
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
      v_prev := null;
      -- 0266: 그 달 행이 아직 없을 때만 이사 지침(그 달 퇴실 이사정산 extra.util.cur)을 전월로 쓴다.
      if not exists (
        select 1 from meter_readings
        where unit_id = v_unit_id and utility = p_utility and period = p_period
      ) then
        v_prev := settlement_move_reading(v_unit_id, p_utility, p_period);
      end if;
      if v_prev is null then
        select current_reading into v_prev
        from meter_readings
        where unit_id = v_unit_id
          and utility = p_utility
          and period = (p_period - interval '1 month')::date;
      end if;
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

  -- 0274: 고객번호×월 청구총액이 있는 고객번호만 정본 배분으로 calc_charge·unit_price 를 덮어쓴다.
  --   총액이 없으면 아무 행도 바꾸지 않는다(기존 계산 유지). 가스는 빈 배열.
  v_allocation := utility_allocate_period(p_building_id, p_utility, p_period);
  if jsonb_array_length(v_allocation) > 0 then
    select coalesce(sum(coalesce(mr.calc_charge, 0)), 0)::bigint into v_total_calc
    from meter_readings mr
    where mr.utility = p_utility
      and mr.period = p_period
      and mr.unit_id in (
        select nullif(r->>'unit_id', '')::bigint
        from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
      );
  end if;

  return jsonb_build_object(
    'saved', v_count,
    'period', p_period,
    'total_calc', v_total_calc,
    'allocation', v_allocation
  );
end $function$;

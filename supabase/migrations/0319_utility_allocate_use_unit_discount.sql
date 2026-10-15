-- 고객번호 부과액 배분(utility_allocate_period)이 행에 저장된 할인 스냅샷(meter_readings.discount_amount)만 읽어,
-- 할인 설정 전에(또는 0318 이전 전기·가스로) 저장된 행은 화면에 보이는 할인이 단가 gross-up 에 빠졌다.
--   예) 전기 부과액 200,000 · 감면 8,000 · 량 50 → 단가 4,000(오류) / 4,160(정본: (200,000 + 8,000) ÷ 50)
-- 화면(list_utility_rows: coalesce(행 할인, 호실 할인))과 같은 값으로 배분한다:
--   할인 = coalesce(행 할인, 호실 할인(water_discounts), 0)
-- 배분한 행에는 사용한 할인을 discount_amount 로 함께 기록해 표시·검산이 같은 값을 쓰게 한다. 수도·전기 공통.
do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'utility_allocate_period';

  v_new := replace(
    v_def,
    $a$coalesce(array_agg(coalesce(mr.discount_amount, 0)::numeric order by u.unit_no, u.id), array[]::numeric[]),$a$,
    $b$coalesce(array_agg(coalesce(mr.discount_amount, wd.amount, 0)::numeric order by u.unit_no, u.id), array[]::numeric[]),$b$
  );
  v_new := replace(
    v_new,
    $a$    where u.building_id = p_building_id and u.deleted_at is null
      and (mr.manual_charge is not null or$a$,
    $b$    left join water_discounts wd on wd.unit_id = u.id
    where u.building_id = p_building_id and u.deleted_at is null
      and (mr.manual_charge is not null or$b$
  );
  v_new := replace(
    v_new,
    $a$              set calc_charge = (v_calc->'fees'->>(i - 1))::int,$a$,
    $b$              set calc_charge = (v_calc->'fees'->>(i - 1))::int,
                  discount_amount = nullif(v_disc[i], 0)::int,$b$
  );
  if v_new = v_def
    or position('wd.amount, 0' in v_new) = 0
    or position('left join water_discounts wd' in v_new) = 0
    or position('discount_amount = nullif(v_disc[i], 0)::int' in v_new) = 0 then
    raise exception 'utility_allocate_period patch target not found';
  end if;
  execute v_new;
end $$;

-- 행 할인이 비어 있는데 호실 할인이 있는 고객번호×월은 다시 배분한다(지침·량은 건드리지 않음).
do $$
declare
  r record;
begin
  for r in
    select distinct bcn.building_id, bcn.kind, ucb.period
    from utility_customer_bills ucb
    join building_customer_numbers bcn on bcn.id = ucb.building_customer_number_id and bcn.deleted_at is null
    join units u on u.building_id = bcn.building_id and u.deleted_at is null
    join unit_meters um on um.unit_id = u.id and um.utility = bcn.kind and um.customer_no = bcn.customer_no
    join meter_readings mr on mr.unit_id = u.id and mr.utility = bcn.kind and mr.period = ucb.period
    join water_discounts wd on wd.unit_id = u.id
    where bcn.kind in ('elec', 'water')
      and mr.discount_amount is null
      and mr.manual_charge is null
  loop
    perform utility_allocate_period(r.building_id, r.kind, r.period);
  end loop;
end $$;

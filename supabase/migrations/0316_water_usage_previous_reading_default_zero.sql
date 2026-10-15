-- 수도 호실별 지침: 전월 지침이 비어 있으면 계산 시 0으로 간주한다(량 = 금월 − 0).
-- 행의 previous_reading 은 null 그대로 두고(0을 채워 넣지 않음) 량·배분 계산에서만 0으로 본다.
--   1) save_meter_readings: 전월 해석(키 → 이사 지침 → 전달 금월) 후에도 없으면 량 = 금월.
--   2) utility_allocate_period: 량이 비어 있는 수도 행은 금월 − coalesce(전월, 0)을 량으로 배분한다.
--   3) list_utility_rows: 량·전.량이 비어 있는 수도 행은 같은 방식으로 계산해 보여준다.
-- 전기·가스는 종전 동작 유지.
do $$
declare
  v_def text;
  v_new text;
begin
  -- 1) save_meter_readings
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'save_meter_readings';

  -- 이전 초안(전월에 0을 채워 넣던 블록)이 적용돼 있으면 걷어낸다.
  v_new := replace(
    v_def,
    $a$    -- 0316: 수도는 전월 지침이 없으면 0으로 간주한다.
    if p_utility = 'water' and v_prev is null and v_cur is not null then
      v_prev := 0;
    end if;

$a$,
    ''
  );
  v_new := replace(
    v_new,
    $a$      when v_cur is not null and v_prev is not null then v_cur - v_prev
$a$,
    $b$      when v_cur is not null and v_prev is not null then v_cur - v_prev
      -- 0316: 수도는 전월이 비어 있으면 0으로 간주한다(행에는 null 유지).
      when v_cur is not null and p_utility = 'water' then v_cur
$b$
  );
  if v_new = v_def then
    raise exception 'save_meter_readings patch target not found';
  end if;
  execute v_new;

  -- 2) utility_allocate_period
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'utility_allocate_period';

  v_new := replace(
    v_def,
    $a$coalesce(array_agg(mr.usage order by u.unit_no, u.id), array[]::numeric[]),$a$,
    $b$coalesce(array_agg(coalesce(mr.usage, case when p_utility = 'water' then mr.current_reading - coalesce(mr.previous_reading, 0) end) order by u.unit_no, u.id), array[]::numeric[]),$b$
  );
  v_new := replace(
    v_new,
    $a$(mr.usage is not null and not mr.needs_review)$a$,
    $b$(coalesce(mr.usage, case when p_utility = 'water' then mr.current_reading - coalesce(mr.previous_reading, 0) end) is not null and not mr.needs_review)$b$
  );
  if v_new = v_def then
    raise exception 'utility_allocate_period patch target not found';
  end if;
  execute v_new;

  -- 3) list_utility_rows
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'list_utility_rows';

  v_new := replace(
    v_def,
    $a$    cur.usage,
    prev.usage as previous_usage,$a$,
    $b$    coalesce(cur.usage, case when p_utility = 'water' then cur.current_reading - coalesce(cur.previous_reading, 0) end) as usage,
    coalesce(prev.usage, case when p_utility = 'water' then prev.current_reading - coalesce(prev.previous_reading, 0) end) as previous_usage,$b$
  );
  if v_new = v_def then
    raise exception 'list_utility_rows patch target not found';
  end if;
  execute v_new;
end $$;

-- 이미 저장된 수도 행 중 전월이 비어 량이 없던 달은 청구총액 배분을 다시 돌린다(행의 지침·량은 건드리지 않음).
do $$
declare
  r record;
begin
  for r in
    select distinct u.building_id, mr.period
    from meter_readings mr
    join units u on u.id = mr.unit_id
    where mr.utility = 'water'
      and mr.usage is null
      and mr.previous_reading is null
      and mr.current_reading is not null
      and exists (
        select 1
        from utility_customer_bills ucb
        join building_customer_numbers bcn on bcn.id = ucb.building_customer_number_id
        where bcn.building_id = u.building_id and bcn.kind = 'water'
          and bcn.deleted_at is null and ucb.period = mr.period
      )
  loop
    perform utility_allocate_period(r.building_id, 'water', r.period);
  end loop;
end $$;

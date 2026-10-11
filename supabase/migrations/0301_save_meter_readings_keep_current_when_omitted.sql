-- 1-20/1-21: 고정 사용량 호실·공실은 저장 payload 에서 current_reading 키를 생략한다.
-- 기존에는 키가 없으면 current_reading 이 null 로 덮여 이미 저장된 지침이 지워졌다(다음 달 전월 지침 유실).
-- 키가 없으면 그 달 기존 행의 current_reading 을 유지한다. 키가 있으면(빈 문자열 포함) 종전대로 그 값을 쓴다.
do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'save_meter_readings';

  v_new := replace(
    v_def,
    $a$    v_cur := nullif(v_item->>'current_reading', '')::numeric;$a$,
    $b$    if v_item ? 'current_reading' then
      v_cur := nullif(v_item->>'current_reading', '')::numeric;
    else
      select mr.current_reading into v_cur
      from meter_readings mr
      where mr.unit_id = v_unit_id and mr.utility = p_utility and mr.period = p_period;
    end if;$b$
  );
  if v_new = v_def then
    raise exception 'save_meter_readings patch target not found';
  end if;
  execute v_new;
end $$;

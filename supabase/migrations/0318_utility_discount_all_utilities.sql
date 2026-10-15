-- 호실 정액 할인(water_discounts: 수급자·다자녀 등)을 수도뿐 아니라 전기·가스에도 같은 금액으로 적용한다.
--   1) save_meter_readings: 할인을 유틸리티와 무관하게 읽어 discount_amount 로 저장하고,
--      부과액 = max(0, 량 × 단가 − 할인) 및 고객번호 부과액 배분(gross-up, utility_allocate_period)에 반영한다.
--   2) list_utility_rows: 전기·가스 호실표에도 할인유형·할인금액을 보여준다.
-- 할인 원본 테이블·설정 화면은 그대로다(호실당 1건, 퇴실 시 리셋).
do $$
declare
  v_def text;
  v_new text;
begin
  -- 1) save_meter_readings
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'save_meter_readings';

  v_new := replace(
    v_def,
    $a$    where unit_id = v_unit_id and p_utility = 'water';$a$,
    $b$    where unit_id = v_unit_id;$b$
  );
  if v_new = v_def then
    raise exception 'save_meter_readings patch target not found';
  end if;
  execute v_new;

  -- 2) list_utility_rows
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'list_utility_rows';

  v_new := replace(
    v_def,
    $a$  left join water_discounts wd on wd.unit_id = u.id and p_utility = 'water'$a$,
    $b$  left join water_discounts wd on wd.unit_id = u.id$b$
  );
  if v_new = v_def then
    raise exception 'list_utility_rows patch target not found';
  end if;
  execute v_new;
end $$;

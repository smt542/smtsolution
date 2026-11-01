-- QA #7 (2026-11-01): 건물 부가정보 수도/전기/가스 "고지기간 출력" 신규 기본값을 N(false)으로.
-- 기존 행 값은 변경하지 않는다. 컬럼 default + save_building 의 coalesce(..., true) 2곳(insert/update)만 바꾼다.
-- migrate_building_util(데이터 이관)은 건드리지 않는다.
begin;

alter table public.building_customer_numbers alter column print_on_bill set default false;

do $$
declare
  v_oid oid;
  v_def text;
  v_new text;
begin
  select p.oid into v_oid
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname = 'save_building';
  v_def := pg_get_functiondef(v_oid);
  v_new := replace(v_def,
    $a$coalesce((v_item->>'print_on_bill')::boolean, true)$a$,
    $b$coalesce((v_item->>'print_on_bill')::boolean, false)$b$);
  if v_new = v_def then
    raise exception 'save_building: print_on_bill coalesce 패턴을 찾지 못함';
  end if;
  execute v_new;
end $$;

commit;

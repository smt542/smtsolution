-- QA #10 #20 (2026-11-01): 고지서 출력 여부 기본 N·이름 출력 유형 기본 '코드번호 출력',
-- 알림톡 수신 동의 값이 바뀔 때만 print_enabled 를 연동(동의 → N, 거부 → Y).
-- 기존 행 값은 보정하지 않는다. 사무실이 동의를 유지한 채 저장하는 print_enabled 는 건드리지 않는다.
begin;

alter table public.occupancies alter column print_enabled set default false;
alter table public.occupancies alter column bill_name_display set default 'code';

create or replace function public.sync_print_enabled_with_alimtalk()
returns trigger
language plpgsql
as $fn$
begin
  if new.alimtalk_opt_in is distinct from old.alimtalk_opt_in then
    new.print_enabled := not new.alimtalk_opt_in;
  end if;
  return new;
end
$fn$;

drop trigger if exists trg_occupancies_sync_print_alimtalk on public.occupancies;
create trigger trg_occupancies_sync_print_alimtalk
  before update of alimtalk_opt_in on public.occupancies
  for each row execute function public.sync_print_enabled_with_alimtalk();

do $$
declare
  v_def text;
  v_new text;
begin
  -- save_unit_occupancy: 값이 없을 때 기본값(insert/update 각 2곳)
  v_def := pg_get_functiondef('public.save_unit_occupancy(bigint,bigint,bigint,jsonb,jsonb,jsonb,jsonb,jsonb)'::regprocedure);
  v_new := replace(v_def,
    $a$coalesce((p_occupancy->>'print_enabled')::boolean,true)$a$,
    $b$coalesce((p_occupancy->>'print_enabled')::boolean,false)$b$);
  v_new := replace(v_new,
    $a$coalesce(nullif(p_occupancy->>'bill_name_display',''), 'name')$a$,
    $b$coalesce(nullif(p_occupancy->>'bill_name_display',''), 'code')$b$);
  if v_new = v_def then
    raise exception 'save_unit_occupancy: 기본값 패턴을 찾지 못함';
  end if;
  execute v_new;

  -- reset_occupancy_on_vacate: 공실 초기화 값 = 신규 입주자 기본값
  v_def := pg_get_functiondef('public.reset_occupancy_on_vacate(bigint,date)'::regprocedure);
  v_new := replace(v_def, $a$print_enabled = true,$a$, $b$print_enabled = false,$b$);
  v_new := replace(v_new, $a$bill_name_display = 'name',$a$, $b$bill_name_display = 'code',$b$);
  if v_new = v_def then
    raise exception 'reset_occupancy_on_vacate: 패턴을 찾지 못함';
  end if;
  execute v_new;
end $$;

commit;

-- 셋업 정산 기준 고정값 검증(수도 단가 반영·전기 단가 반영·공실 수납 수동). 마이그레이션 0202 적용 뒤 읽기 전용으로 실행한다.
begin;

do $$
begin
  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'setup_config'
      and (
        (column_name = 'water_unit_reflect' and column_default = 'true')
        or (column_name = 'electric_unit_reflect' and column_default = 'true')
        or (column_name = 'vacancy_payment_mode' and column_default like '''manual''%')
      )
  ) <> 3 then
    raise exception 'setup_config defaults must be true / true / manual';
  end if;

  if exists (
    select 1 from setup_config
    where water_unit_reflect is distinct from true
       or electric_unit_reflect is distinct from true
       or vacancy_payment_mode is distinct from 'manual'
  ) then
    raise exception 'every setup_config row must hold the fixed settlement rules';
  end if;

  if position('coalesce(sc.vacancy_payment_mode, ''manual'')' in pg_get_functiondef('public.get_settlement_context(bigint, bigint)'::regprocedure)) = 0
     or position('''vacancy_payment_mode'', ''auto''' in pg_get_functiondef('public.get_settlement_context(bigint, bigint)'::regprocedure)) > 0 then
    raise exception 'get_settlement_context must fall back to manual';
  end if;

  if position('v_mode := coalesce(v_mode, ''manual'')' in pg_get_functiondef('public.complete_moving_settlement(bigint)'::regprocedure)) = 0 then
    raise exception 'complete_moving_settlement must fall back to manual';
  end if;
end $$;

rollback;

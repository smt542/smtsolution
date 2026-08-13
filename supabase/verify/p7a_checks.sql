-- P7a 검증 (사용자 PC psql). 실패 시 raise.
do $$ begin
  if (select count(*) from information_schema.tables
      where table_schema='public' and table_name in ('moving_settlements','settlement_checklist_results')) <> 2
    then raise exception 'P7a tables missing'; end if;
  perform 1 from information_schema.columns
    where table_schema='public' and table_name='moving_settlements' and column_name='move_out_date';
  if not found then raise exception 'moving_settlements.move_out_date missing'; end if;
  perform 1 from information_schema.columns
    where table_schema='public' and table_name='moving_settlements' and column_name='repair_attribution';
  if not found then raise exception 'moving_settlements.repair_attribution missing'; end if;
end $$;
do $$ begin
  perform 1 from pg_policies
    where schemaname='public' and tablename='moving_settlements'
      and policyname='ms_write' and qual like '%current_user_has_module%';
  if not found then raise exception 'ms_write must gate by moving module'; end if;
  perform 1 from pg_policies
    where schemaname='public' and tablename='settlement_checklist_results'
      and policyname='scr_write' and qual like '%current_user_has_module%';
  if not found then raise exception 'scr_write must gate by moving module'; end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in (
        'get_settlement_context','save_moving_settlement','complete_moving_settlement',
        'mid_moveout_settlement','list_settlements'
      ) and p.prosecdef) <> 5
    then raise exception 'P7a security-definer RPC missing'; end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'get_settlement_context','save_moving_settlement','complete_moving_settlement',
      'mid_moveout_settlement','list_settlements'
    ) and has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then raise exception 'P7a RPC must not be executable by anon'; end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in (
        'get_settlement_context','save_moving_settlement','complete_moving_settlement',
        'mid_moveout_settlement','list_settlements'
      ) and has_function_privilege('authenticated', p.oid, 'EXECUTE')) <> 5
    then raise exception 'P7a RPC must be executable by authenticated'; end if;
end $$;
-- 수동: moving 미보유 구성원 moving_settlements SELECT 가능·INSERT 거부; moving 보유·마스터 save/complete/mid 성공;
--       get_settlement_context 최신 draft/saved·계좌 스냅샷·체크리스트·검침 3종 확인;
--       complete가 occupancy_history INSERT·occupancy vacant·settlement_note 리셋, mid가 billing_note/print_enabled 변경;
--       list_settlements 날짜범위 정렬 및 타 org unit/building/settlement 격리 확인.

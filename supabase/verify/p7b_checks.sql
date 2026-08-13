-- P7b 검증 (사용자 PC psql). 실패 시 raise.
do $$ begin
  perform 1
  from pg_indexes
  where schemaname = 'public'
    and tablename = 'moving_settlements'
    and indexname = 'moving_settlements_move_out_date_idx';
  if not found then raise exception 'P7b move-out date index missing'; end if;

  perform 1
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'list_settlement_inquiries'
    and p.prosecdef
    and p.provolatile = 's';
  if not found then raise exception 'P7b security-definer stable RPC missing'; end if;

  if has_function_privilege(
    'anon',
    'public.list_settlement_inquiries(text,bigint,date,date,text,text,integer,integer)',
    'EXECUTE'
  ) then raise exception 'P7b RPC must not be executable by anon'; end if;

  if not has_function_privilege(
    'authenticated',
    'public.list_settlement_inquiries(text,bigint,date,date,text,text,integer,integer)',
    'EXECUTE'
  ) then raise exception 'P7b RPC must be executable by authenticated'; end if;
end $$;

-- 수동: moving 권한 보유 사용자가 water/elec/gas/all 필터별 결과·총건수·페이지를 확인;
--       moving 미보유 사용자는 forbidden, 타 조직 building/unit/settlement는 결과에서 격리;
--       건물·퇴실일·검색어·상태 필터 및 0원 요금(null 아님)이 유형별 결과에 포함되는지 확인.

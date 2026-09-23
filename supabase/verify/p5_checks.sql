-- P5 부과 확정 검증. 실패 시 raise.

do $$
begin
  if (
    select count(*)
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('fee_item_charges', 'billing_confirmations', 'billing_history')
      and table_type = 'BASE TABLE'
  ) <> 3 then
    raise exception 'P5 tables missing';
  end if;

  if (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('fee_item_charges', 'billing_confirmations', 'billing_history')
      and c.relrowsecurity
  ) <> 3 then
    raise exception 'P5 tables must enable RLS';
  end if;
end $$;

do $$
declare
  v_policy text;
  v_parts text[];
  v_expected text[] := array[
    'fee_item_charges:fic_write:ALL',
    'billing_confirmations:bc_write:ALL'
  ];
begin
  foreach v_policy in array v_expected loop
    v_parts := string_to_array(v_policy, ':');
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = v_parts[1]
        and policyname = v_parts[2]
        and cmd = v_parts[3]
        and coalesce(qual, '') like '%current_user_has_module%'
        and coalesce(with_check, '') like '%current_user_has_module%'
    ) then
      raise exception 'billing write policy missing or ungated: %', v_policy;
    end if;
  end loop;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_history'
      and cmd <> 'SELECT'
  ) then
    raise exception 'billing_history must have SELECT-only policies';
  end if;
end $$;

do $$
declare
  v_round regprocedure := to_regprocedure('public.round_charge(numeric,text)');
  v_list regprocedure := to_regprocedure('public.list_billing(bigint,date)');
  v_history regprocedure := to_regprocedure('public.list_billing_history(bigint,date,integer)');
  v_save regprocedure := to_regprocedure('public.save_billing_charges(bigint,date,jsonb,jsonb)');
  v_confirm regprocedure := to_regprocedure('public.confirm_billing(bigint,date)');
  v_save_def text;
  v_confirm_def text;
begin
  if v_round is null or v_list is null or v_history is null or v_save is null or v_confirm is null then
    raise exception 'P5 RPC missing';
  end if;

  if not exists (
    select 1
    from pg_proc p
    where p.oid = v_list
      and 'mgmt_fee_amount' = any(p.proargnames)
  ) then
    raise exception 'list_billing must return mgmt_fee_amount';
  end if;

  if has_function_privilege('anon', v_round, 'EXECUTE')
     or has_function_privilege('anon', v_list, 'EXECUTE')
     or has_function_privilege('anon', v_history, 'EXECUTE')
     or has_function_privilege('anon', v_save, 'EXECUTE')
     or has_function_privilege('anon', v_confirm, 'EXECUTE') then
    raise exception 'P5 RPCs must not be executable by anon';
  end if;
  if not has_function_privilege('authenticated', v_round, 'EXECUTE')
     or not has_function_privilege('authenticated', v_list, 'EXECUTE')
     or not has_function_privilege('authenticated', v_history, 'EXECUTE')
     or not has_function_privilege('authenticated', v_save, 'EXECUTE')
     or not has_function_privilege('authenticated', v_confirm, 'EXECUTE') then
    raise exception 'P5 RPCs must be executable by authenticated';
  end if;

  v_save_def := regexp_replace(lower(pg_get_functiondef(v_save)), '[[:space:]]+', '', 'g');
  v_confirm_def := regexp_replace(lower(pg_get_functiondef(v_confirm)), '[[:space:]]+', '', 'g');

  if position('current_user_has_module(''billing'')' in v_save_def) = 0
     or position('current_user_has_module(''billing'')' in v_confirm_def) = 0 then
    raise exception 'P5 write RPCs must gate by billing module';
  end if;
  if position('futureperiodisnotallowed' in v_save_def) = 0
     or position('futureperiodisnotallowed' in v_confirm_def) = 0 then
    raise exception 'P5 write RPCs must reject future periods';
  end if;
  if position('jsonb_typeof(coalesce(p_charges,''[]''::jsonb))' in v_save_def) = 0
     or position('jsonb_typeof(coalesce(p_notes,''[]''::jsonb))' in v_save_def) = 0 then
    raise exception 'save_billing_charges must require array payloads';
  end if;
  if position('fi.org_id=v_org' in v_save_def) = 0
     or position('fi.type_id=b.type_id' in v_save_def) = 0 then
    raise exception 'save_billing_charges must scope fee items to caller org and building type';
  end if;
  if position('v_occupancy_id' in v_save_def) = 0 then
    raise exception 'save_billing_charges must derive the current occupancy server-side';
  end if;
  if position('casewhenfi.carry_overthenprev.amountelse0end' in v_confirm_def) = 0
     or position('coalesce(fic.charged,true)' in v_confirm_def) = 0 then
    raise exception 'confirm_billing must confirm the same carry-over defaults shown by list_billing';
  end if;
end $$;

-- 데이터 기반 수동 점검:
--  1) billing 미보유 구성원: 직접 INSERT와 쓰기 RPC 거부 / SELECT 가능.
--  2) 저장하지 않은 전월 이월값도 confirm_billing 합계·history items에 반영.
--  3) 재확정 시 confirmations UPDATE + history append.
--  4) 중간입주(daily_proration) 세대 일할 반영 total 확인.
--  5) 타 org building/unit/fee_item 입력과 미래월 입력 거부.
--  6) 공실 세대 confirm 제외.

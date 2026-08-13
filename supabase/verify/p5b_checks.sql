-- P5b 공과금 단가·자동요금·부과확정 검증. 실패 시 raise.

do $$
begin
  if (
    select count(*)
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('utility_unit_prices', 'utility_confirmations')
      and table_type = 'BASE TABLE'
  ) <> 2 then
    raise exception 'P5b tables missing';
  end if;

  if (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('utility_unit_prices', 'utility_confirmations')
      and c.relrowsecurity
  ) <> 2 then
    raise exception 'P5b tables must enable RLS';
  end if;
end $$;

do $$
declare
  v_policy text;
  v_parts text[];
  v_expected text[] := array[
    'utility_unit_prices:uup_write:ALL',
    'utility_confirmations:uc_write:ALL'
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
      raise exception 'utilities write policy missing or ungated: %', v_policy;
    end if;
  end loop;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'utility_unit_prices'
      and policyname = 'uup_select' and cmd = 'SELECT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'utility_confirmations'
      and policyname = 'uc_select' and cmd = 'SELECT'
  ) then
    raise exception 'P5b SELECT policies missing';
  end if;
end $$;

do $$
declare
  v_prices regprocedure := to_regprocedure('public.list_utility_prices(bigint,text)');
  v_save_prices regprocedure := to_regprocedure('public.save_utility_unit_prices(bigint,text,jsonb)');
  v_rows regprocedure := to_regprocedure('public.list_utility_rows(bigint,text,date)');
  v_save_rows regprocedure := to_regprocedure('public.save_meter_readings(bigint,text,date,jsonb)');
  v_confirm regprocedure := to_regprocedure('public.confirm_utilities(bigint,text,date)');
  v_confirmation regprocedure := to_regprocedure('public.list_utility_confirmation(bigint,text,date)');
  v_proc regprocedure;
  v_save_rows_def text;
  v_confirm_def text;
  v_confirmation_def text;
begin
  if v_prices is null or v_save_prices is null or v_rows is null
     or v_save_rows is null or v_confirm is null or v_confirmation is null then
    raise exception 'P5b RPC missing';
  end if;

  foreach v_proc in array array[
    v_prices, v_save_prices, v_rows, v_save_rows, v_confirm, v_confirmation
  ] loop
    if has_function_privilege('anon', v_proc, 'EXECUTE')
       or exists (
         select 1
         from pg_proc p,
              aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
         where p.oid = v_proc
           and a.grantee = 0
           and a.privilege_type = 'EXECUTE'
       ) then
      raise exception 'P5b RPC must not be executable by anon/public: %', v_proc;
    end if;
    if not has_function_privilege('authenticated', v_proc, 'EXECUTE') then
      raise exception 'P5b RPC must be executable by authenticated: %', v_proc;
    end if;
  end loop;

  v_save_rows_def := regexp_replace(lower(pg_get_functiondef(v_save_rows)), '[[:space:]]+', '', 'g');
  v_confirm_def := regexp_replace(lower(pg_get_functiondef(v_confirm)), '[[:space:]]+', '', 'g');
  v_confirmation_def := regexp_replace(lower(pg_get_functiondef(v_confirmation)), '[[:space:]]+', '', 'g');

  if position('round_charge(v_usage*v_price,''round'')' in v_save_rows_def) = 0
     or position('greatest(0' in v_save_rows_def) = 0
     or position('unit_price=excluded.unit_price' in v_save_rows_def) = 0
     or position('calc_charge=excluded.calc_charge' in v_save_rows_def) = 0 then
    raise exception 'save_meter_readings must snapshot price and calculate non-negative charge';
  end if;

  if position('current_user_has_module(''utilities'')' in v_confirm_def) = 0
     or position('futureperiodisnotallowed' in v_confirm_def) = 0
     or position('coalesce(mr.manual_charge,mr.calc_charge,0)' in v_confirm_def) = 0
     or position('''utility_confirm''' in v_confirm_def) = 0 then
    raise exception 'confirm_utilities validation/total/audit mismatch';
  end if;

  if position('mr.updated_at>uc.confirmed_at' in v_confirmation_def) = 0
     or position('uup.updated_at>uc.confirmed_at' in v_confirmation_def) = 0 then
    raise exception 'list_utility_confirmation must detect reading and price changes';
  end if;
end $$;

-- 데이터 기반 수동 점검(사용자 PC):
--  1) utilities 미보유 구성원: 신규 두 테이블 SELECT 가능 / 직접 쓰기와 쓰기 RPC 거부.
--  2) unit_meters.customer_no 일치 단가가 1순위로 해석됨.
--  3) 유형별 설정 단가 1건이면 미매칭 세대도 그 단가, 2건 이상이면 null.
--  4) save_meter_readings 요금=max(0, round(usage*price)-discount), usage/price null이면 calc null.
--  5) confirm_utilities 합계는 manual_charge 우선이며 공실 제외.
--  6) 재확정은 같은 confirmation 행을 갱신하고 audit_log를 추가.
--  7) 확정 뒤 검침 수정과 단가 수정이 각각 is_dirty=true.
--  8) 타 org building/customer number는 조회 0행 또는 쓰기 거부.

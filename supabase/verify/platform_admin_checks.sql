-- platform-admin 스키마 검증. 실패 시 raise.

do $$
declare
  v_admin regprocedure := to_regprocedure('public.current_user_is_platform_admin()');
begin
  if to_regtype('public.point_tx_type') is null then
    raise exception 'point_tx_type missing';
  end if;
  if to_regclass('public.point_transactions') is null then
    raise exception 'point_transactions missing';
  end if;
  if v_admin is null then
    raise exception 'current_user_is_platform_admin missing';
  end if;
  if has_function_privilege('anon', v_admin, 'EXECUTE') then
    raise exception 'current_user_is_platform_admin must not be executable by anon';
  end if;
  if not has_function_privilege('authenticated', v_admin, 'EXECUTE') then
    raise exception 'current_user_is_platform_admin must be executable by authenticated';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'point_transactions'
      and c.relrowsecurity
  ) then
    raise exception 'point_transactions RLS must be enabled';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'point_transactions'
      and policyname = 'pt_platform'
      and cmd = 'ALL'
      and coalesce(qual, '') like '%current_user_is_platform_admin%'
      and coalesce(with_check, '') like '%current_user_is_platform_admin%'
  ) then
    raise exception 'point_transactions platform-admin policy missing';
  end if;
end $$;

do $$
declare
  v_expected text[] := array[
    'organizations:org_platform_select:SELECT',
    'organizations:org_platform_update:UPDATE',
    'org_members:member_platform_select:SELECT',
    'profiles:profile_platform_select:SELECT'
  ];
  v_policy text;
  v_parts text[];
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
        and coalesce(qual, '') like '%current_user_is_platform_admin%'
    ) then
      raise exception 'platform-admin policy missing: %', v_policy;
    end if;
  end loop;
end $$;

-- ===== Popbill 월 청구(0097): LMS 단가·성공건/성공페이지 스냅샷 =====
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'platform_settings' and column_name = 'rate_krw_lms'
  ) then
    raise exception 'platform_settings.rate_krw_lms is missing';
  end if;

  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'platform_billing_invoices'
        and column_name in ('lms_count', 'fax_page_count')) <> 2 then
    raise exception 'platform_billing_invoices lms_count/fax_page_count columns are incomplete';
  end if;
  -- 기존 청구서 호환: fax_count 열은 유지되어야 한다.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'platform_billing_invoices' and column_name = 'fax_count'
  ) then
    raise exception 'platform_billing_invoices fax_count compatibility column was dropped';
  end if;

  -- 사용량 헬퍼는 내부 전용(authenticated 실행 불가)
  if to_regprocedure('public.platform_org_usage(date)') is null then
    raise exception 'platform_org_usage is missing';
  end if;
  if has_function_privilege('authenticated', 'public.platform_org_usage(date)', 'EXECUTE') then
    raise exception 'authenticated must not execute platform_org_usage directly';
  end if;

  -- 단가 setter에 LMS 인자 추가
  if to_regprocedure('public.platform_update_settings(integer, integer, integer, integer, integer, text, text, text, text, text, text, integer, numeric, text)') is null then
    raise exception 'platform_update_settings lms overload is missing';
  end if;

  -- 월 사용량은 terminal success 수신자와 terminal 팩스 job만 집계한다(queued/pending 접수 제외).
  if pg_get_functiondef('public.platform_org_usage(date)'::regprocedure)
     not like '%rec.status = ''success''%' then
    raise exception 'platform_org_usage counts non-terminal message recipients (must count only success)';
  end if;
  if pg_get_functiondef('public.platform_org_usage(date)'::regprocedure)
     not like '%job.status in (''sent'', ''partial'')%' then
    raise exception 'platform_org_usage counts non-terminal fax jobs (must count only sent/partial)';
  end if;

  -- 신규 팩스 사용량은 각 job 자신의 접수 시각(submitted_at)으로 월을 귀속해야 한다.
  -- bill_issues.issued_at 기준이면 재발행이 과거 성공 job을 다른 달로 옮기거나 확정 청구서를 이중 계상할 수 있다.
  if pg_get_functiondef('public.platform_org_usage(date)'::regprocedure)
     not like '%coalesce(job.submitted_at%' then
    raise exception 'platform_org_usage must attribute new fax pages by job.submitted_at, not bill_issues.issued_at';
  end if;

  raise notice 'Popbill platform billing checks passed';
end $$;

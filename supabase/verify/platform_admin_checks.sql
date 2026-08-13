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

-- 0224 적용 확인. 실패하면 raise로 멈춘다(통과 = 오류 없음).
-- 실행: node --env-file=C:/Users/leebj/orca/projects/home_erp/.env.local C:/Users/leebj/orca/projects/home_erp/scripts/db-query.mjs <이 파일>
do $$
declare
  v_count int;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'provider_dispatch_jobs'
      and column_name = 'provider_env' and is_nullable = 'NO' and column_default like '''test''%'
  ) then
    raise exception '0224: provider_env column missing or wrong';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'provider_dispatch_jobs_provider_env_check') then
    raise exception '0224: provider_env check constraint missing';
  end if;
  -- 적용 직후 전용: 운영 전환 전이므로 live 작업이 없어야 한다.
  select count(*) into v_count from public.provider_dispatch_jobs where provider_env <> 'test';
  if v_count <> 0 then raise exception '0224: % rows are not test right after apply', v_count; end if;

  if to_regprocedure('public.create_fax_dispatch_job(bigint,text)') is null then
    raise exception '0224: create_fax_dispatch_job(bigint,text) missing';
  end if;
  if to_regprocedure('public.create_fax_dispatch_job(bigint)') is not null then
    raise exception '0224: old create_fax_dispatch_job(bigint) still exists';
  end if;
  if to_regprocedure('public.claim_provider_dispatch_jobs(integer,text)') is null then
    raise exception '0224: claim_provider_dispatch_jobs(integer,text) missing';
  end if;
  if to_regprocedure('public.claim_provider_dispatch_jobs(integer)') is not null then
    raise exception '0224: old claim_provider_dispatch_jobs(integer) still exists';
  end if;

  if not has_function_privilege('service_role', 'public.claim_provider_dispatch_jobs(integer,text)', 'execute') then
    raise exception '0224: service_role cannot execute claim_provider_dispatch_jobs';
  end if;
  if has_function_privilege('authenticated', 'public.claim_provider_dispatch_jobs(integer,text)', 'execute') then
    raise exception '0224: authenticated can execute claim_provider_dispatch_jobs';
  end if;
  if has_function_privilege('anon', 'public.create_fax_dispatch_job(bigint,text)', 'execute') then
    raise exception '0224: anon can execute create_fax_dispatch_job';
  end if;
  if position('provider_env' in pg_get_functiondef('public.create_provider_dispatch_jobs(bigint,jsonb)'::regprocedure)) = 0 then
    raise exception '0224: create_provider_dispatch_jobs does not write provider_env';
  end if;

  -- 배포 공백 호환: 새 인자는 기본값이 있어야 옛 인자 호출이 같은 함수로 연결된다.
  if (select pronargdefaults from pg_proc where oid = 'public.claim_provider_dispatch_jobs(integer,text)'::regprocedure) <> 2 then
    raise exception '0224: claim_provider_dispatch_jobs must default both args';
  end if;
  if (select pronargdefaults from pg_proc where oid = 'public.create_fax_dispatch_job(bigint,text)'::regprocedure) <> 1 then
    raise exception '0224: create_fax_dispatch_job must default p_provider_env';
  end if;
  -- 오버로드 금지: 이름별 함수가 정확히 1개.
  select count(*) into v_count
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('claim_provider_dispatch_jobs', 'create_fax_dispatch_job', 'create_provider_dispatch_jobs');
  if v_count <> 3 then
    raise exception '0224: expected exactly one overload each for 3 functions, found % rows', v_count;
  end if;
end $$;

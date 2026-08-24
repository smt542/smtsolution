-- P4-point 배포 후 읽기 전용 스키마 검증.
-- 운영 데이터는 만들거나 수정하지 않는다.

do $$
declare
  v_count integer;
  v_config text;
begin
  if to_regclass('public.message_point_rates') is null then
    raise exception 'message_point_rates table is missing';
  end if;
  if to_regclass('public.message_point_reservations') is null then
    raise exception 'message_point_reservations table is missing';
  end if;

  select count(*) into v_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'message_logs'
    and column_name in ('estimated_points', 'charged_points', 'point_status');
  if v_count <> 3 then
    raise exception 'message_logs point columns are incomplete';
  end if;

  select count(*) into v_count
  from public.message_point_rates
  where effective_to is null and channel in ('sms', 'alimtalk');
  if v_count <> 2 then
    raise exception 'exactly two active message point rates are required';
  end if;

  select count(*) into v_count
  from pg_indexes
  where schemaname = 'public'
    and indexname in (
      'message_point_rates_one_active',
      'point_usage_one_per_message_log'
    );
  if v_count <> 2 then
    raise exception 'required point billing unique indexes are missing';
  end if;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'point_transactions'
    and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE');
  if v_count <> 0 then
    raise exception 'point_transactions still has a direct write policy';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.point_transactions'::regclass
      and tgname = 'trg_point_transactions_append_only'
      and not tgisinternal
  ) then
    raise exception 'point_transactions append-only trigger is missing';
  end if;

  select array_to_string(coalesce(proconfig, '{}'::text[]), ',')
    into v_config
  from pg_proc
  where oid = 'public.reserve_message_points(bigint,uuid,uuid,text,text,text,text,jsonb,bigint,jsonb,integer)'::regprocedure;
  if v_config not like '%search_path=%' then
    raise exception 'reserve_message_points search_path is not fixed';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.reserve_message_points(bigint,uuid,uuid,text,text,text,text,jsonb,bigint,jsonb,integer)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must not execute reserve_message_points';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.reserve_message_points(bigint,uuid,uuid,text,text,text,text,jsonb,bigint,jsonb,integer)',
    'EXECUTE'
  ) then
    raise exception 'service_role cannot execute reserve_message_points';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.settle_message_points(bigint,text,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must not execute settle_message_points';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.message_logs'::regclass
      and conname = 'message_logs_result_check'
      and pg_get_constraintdef(oid) like '%queued%'
      and pg_get_constraintdef(oid) like '%partial%'
  ) then
    raise exception 'message_logs result constraint was not expanded';
  end if;

  -- ===== Popbill 발송 작업 기반(0095) =====
  if to_regclass('public.provider_dispatch_jobs') is null then
    raise exception 'provider_dispatch_jobs table is missing';
  end if;
  if to_regclass('public.provider_dispatch_recipients') is null then
    raise exception 'provider_dispatch_recipients table is missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_dispatch_jobs'::regclass
      and contype = 'u'
      and conname = 'provider_dispatch_jobs_request_num_key'
  ) then
    raise exception 'provider_dispatch_jobs request_num uniqueness is missing';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_dispatch_jobs'::regclass
      and contype = 'u'
      and conname = 'provider_dispatch_jobs_receipt_num_key'
  ) then
    raise exception 'provider_dispatch_jobs receipt_num uniqueness is missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_dispatch_recipients'::regclass
      and conname = 'provider_dispatch_recipients_ref_unique'
  ) then
    raise exception 'provider_dispatch_recipients ref uniqueness is missing';
  end if;
  -- provider_ref_key 20자 제한(결정적 interOPRefKey)
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_dispatch_recipients'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%provider_ref_key%20%'
  ) then
    raise exception 'provider_dispatch_recipients provider_ref_key length limit is missing';
  end if;

  -- 허용 상태 체크 제약(접수만으로 sent가 되지 않도록 submitting/pending/reconcile_required 포함)
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_dispatch_jobs'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%submitting%'
      and pg_get_constraintdef(oid) like '%reconcile_required%'
  ) then
    raise exception 'provider_dispatch_jobs status check is missing';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.provider_dispatch_jobs'::regclass) then
    raise exception 'provider_dispatch_jobs RLS is disabled';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.provider_dispatch_recipients'::regclass) then
    raise exception 'provider_dispatch_recipients RLS is disabled';
  end if;

  if has_table_privilege('authenticated', 'public.provider_dispatch_jobs', 'INSERT')
     or has_table_privilege('authenticated', 'public.provider_dispatch_jobs', 'UPDATE')
     or has_table_privilege('anon', 'public.provider_dispatch_jobs', 'INSERT') then
    raise exception 'provider_dispatch_jobs must not be directly writable by anon/authenticated';
  end if;
  if has_table_privilege('authenticated', 'public.provider_dispatch_recipients', 'INSERT')
     or has_table_privilege('anon', 'public.provider_dispatch_recipients', 'INSERT') then
    raise exception 'provider_dispatch_recipients must not be directly writable by anon/authenticated';
  end if;

  if has_function_privilege('authenticated', 'public.claim_provider_dispatch_jobs(integer)', 'EXECUTE') then
    raise exception 'authenticated must not execute claim_provider_dispatch_jobs';
  end if;
  if not has_function_privilege('service_role', 'public.claim_provider_dispatch_jobs(integer)', 'EXECUTE') then
    raise exception 'service_role cannot execute claim_provider_dispatch_jobs';
  end if;

  raise notice 'P4-point schema checks passed';
end
$$;

select
  channel,
  points,
  effective_from
from public.message_point_rates
where effective_to is null
order by channel;

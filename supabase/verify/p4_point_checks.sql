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

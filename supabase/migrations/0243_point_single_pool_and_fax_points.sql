-- 팝빌 포인트 정책 정렬 (policy/05_통합 관리자/통합관리자_포인트 관리.md, 2026-08-14 확정)
--  1) 포인트 = 본사 단일 풀(전 테넌트 공통). 잔액·예약 하드스톱을 조직별이 아니라 풀 전체로 판정한다.
--     사용 원장은 계속 발송 조직(org_id)으로 남겨 업체별 소진 집계를 유지한다.
--     동시 발송·충전 정정이 풀 잔액을 함께 읽고 쓰므로 조직 행 잠금에 더해 풀 advisory lock을 건다.
--  2) 팩스도 공통 차감: 포인트 단가에 fax(원/장)를 추가하고, 팩스 결과 확정 시 성공 페이지 × 단가를 차감한다.
--     풀 가용 잔액이 1장 단가보다 적으면 팩스 작업을 만들지 않는다(하드스톱).
-- 월말 청구(rate_krw_*, 후불)는 업체 청구용 별도 단가라 이 마이그레이션과 무관하다.

-- ===== 풀 잔액·잠금 헬퍼(정의자 함수 내부 전용) =====
create or replace function public.point_pool_balance()
returns table(ledger_balance bigint, reserved_points bigint, available_points bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with ledger as (
    select coalesce(sum(point_transaction.points), 0)::bigint as balance
    from public.point_transactions point_transaction
  ), reserved as (
    select coalesce(sum(reservation.reserved_points), 0)::bigint as points
    from public.message_point_reservations reservation
    where reservation.status in ('reserved', 'provider_pending', 'reconcile_required')
  )
  select ledger.balance, reserved.points, ledger.balance - reserved.points from ledger, reserved;
$$;
revoke all on function public.point_pool_balance() from public, anon, authenticated;

create or replace function public.lock_point_pool()
returns void
language sql
security definer
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtext('public.point_pool'));
$$;
revoke all on function public.lock_point_pool() from public, anon, authenticated;

-- ===== 기존 함수의 잔액 계산을 풀 기준으로 교체 =====
-- 정의 전체를 다시 쓰지 않고 잔액 블록만 정확히 치환한다. 치환 대상이 정확히 1회 없으면 실패시킨다.
do $patch$
declare
  v_def text;
  v_fn regprocedure;
  v_pair text[];
  v_patches jsonb := jsonb_build_object(
    'public.quote_message_points(text,jsonb,bigint,text)', jsonb_build_array(
      jsonb_build_array(
        E'  from public.point_transactions point_transaction where point_transaction.org_id = v_org_id;',
        E'  from public.point_transactions point_transaction;'),
      jsonb_build_array(
        E'  where reservation.org_id = v_org_id\n    and reservation.status in',
        E'  where reservation.status in')),
    'public.reserve_message_points(bigint,uuid,uuid,text,text,text,text,jsonb,bigint,jsonb,integer)', jsonb_build_array(
      jsonb_build_array(
        E'  select coalesce(sum(point_transaction.points), 0)::bigint into v_ledger_balance\n  from public.point_transactions point_transaction where point_transaction.org_id = p_org_id;',
        E'  perform public.lock_point_pool();\n  select coalesce(sum(point_transaction.points), 0)::bigint into v_ledger_balance\n  from public.point_transactions point_transaction;'),
      jsonb_build_array(
        E'  where reservation.org_id = p_org_id\n    and reservation.status in',
        E'  where reservation.status in')),
    'public.reserve_scheduled_message(bigint)', jsonb_build_array(
      jsonb_build_array(
        E'  select coalesce(sum(points), 0)::bigint into v_ledger\n    from public.point_transactions where org_id = v_row.org_id;',
        E'  perform public.lock_point_pool();\n  select coalesce(sum(points), 0)::bigint into v_ledger\n    from public.point_transactions;'),
      jsonb_build_array(
        E'    where org_id = v_row.org_id and status in (''reserved'', ''provider_pending'', ''reconcile_required'');',
        E'    where status in (''reserved'', ''provider_pending'', ''reconcile_required'');')),
    'public.platform_record_point_adjustment(bigint,text,integer,integer,text)', jsonb_build_array(
      jsonb_build_array(
        E'  select coalesce(sum(point_transaction.points), 0)::bigint into v_ledger_balance\n  from public.point_transactions point_transaction where point_transaction.org_id = p_org_id;',
        E'  perform public.lock_point_pool();\n  select coalesce(sum(point_transaction.points), 0)::bigint into v_ledger_balance\n  from public.point_transactions point_transaction;'),
      jsonb_build_array(
        E'  where reservation.org_id = p_org_id\n    and reservation.status in',
        E'  where reservation.status in')),
    'public.platform_delete_point_charge(bigint)', jsonb_build_array(
      jsonb_build_array(
        E'  select coalesce(sum(point_transaction.points), 0)::bigint\n  into v_ledger_balance\n  from public.point_transactions point_transaction\n  where point_transaction.org_id = v_org_id;',
        E'  perform public.lock_point_pool();\n  select coalesce(sum(point_transaction.points), 0)::bigint\n  into v_ledger_balance\n  from public.point_transactions point_transaction;'),
      jsonb_build_array(
        E'  where reservation.org_id = v_org_id\n    and reservation.status in',
        E'  where reservation.status in')),
    'public.platform_update_point_charge(bigint,integer)', jsonb_build_array(
      jsonb_build_array(
        E'  select coalesce(sum(point_transaction.points), 0)::bigint\n  into v_ledger_balance\n  from public.point_transactions point_transaction\n  where point_transaction.org_id = v_org_id;',
        E'  perform public.lock_point_pool();\n  select coalesce(sum(point_transaction.points), 0)::bigint\n  into v_ledger_balance\n  from public.point_transactions point_transaction;'),
      jsonb_build_array(
        E'  where reservation.org_id = v_org_id\n    and reservation.status in',
        E'  where reservation.status in'))
  );
  v_key text;
  v_item jsonb;
begin
  for v_key in select jsonb_object_keys(v_patches) loop
    v_fn := v_key::regprocedure;
    v_def := pg_get_functiondef(v_fn);
    for v_item in select jsonb_array_elements(v_patches -> v_key) loop
      v_pair := array[v_item ->> 0, v_item ->> 1];
      if (length(v_def) - length(replace(v_def, v_pair[1], ''))) / length(v_pair[1]) <> 1 then
        raise exception 'patch target not found exactly once in %: %', v_key, left(v_pair[1], 80);
      end if;
      v_def := replace(v_def, v_pair[1], v_pair[2]);
    end loop;
    execute v_def;
  end loop;
end
$patch$;

-- ===== 팩스 포인트 단가 =====
alter table public.message_point_rates drop constraint if exists message_point_rates_channel_check;
alter table public.message_point_rates add constraint message_point_rates_channel_check
  check (channel in ('sms', 'lms', 'alimtalk', 'fax'));

-- 단가 변경 RPC에 fax(원/장)를 추가한다. null이면 해당 채널 단가를 바꾸지 않는다.
drop function if exists public.platform_set_message_point_rates(integer, integer, integer);
create or replace function public.platform_set_message_point_rates(
  p_sms_points integer,
  p_alimtalk_points integer,
  p_lms_points integer default null,
  p_fax_points integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_before jsonb;
  v_after jsonb;
  v_channel text;
  v_points integer;
  v_current integer;
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if p_sms_points is null or p_sms_points <= 0
    or p_alimtalk_points is null or p_alimtalk_points <= 0 then
    raise exception 'invalid rates: positive integers required' using errcode = '22023';
  end if;
  if p_lms_points is not null and p_lms_points <= 0 then
    raise exception 'invalid lms rate: positive integer required' using errcode = '22023';
  end if;
  if p_fax_points is not null and p_fax_points <= 0 then
    raise exception 'invalid fax rate: positive integer required' using errcode = '22023';
  end if;

  lock table public.message_point_rates in share row exclusive mode;

  select coalesce(jsonb_object_agg(rate.channel, rate.points), '{}'::jsonb) into v_before
  from public.message_point_rates rate where rate.effective_to is null;

  for v_channel, v_points in
    select * from (values
      ('sms', p_sms_points), ('alimtalk', p_alimtalk_points), ('lms', p_lms_points), ('fax', p_fax_points)
    ) as rates(channel, points)
    where rates.points is not null
  loop
    select rate.points into v_current from public.message_point_rates rate
      where rate.channel = v_channel and rate.effective_to is null;
    if not found or v_current is distinct from v_points then
      update public.message_point_rates set effective_to = v_now
        where channel = v_channel and effective_to is null;
      insert into public.message_point_rates(channel, points, effective_from, created_by)
        values (v_channel, v_points, v_now, (select auth.uid()));
    end if;
  end loop;

  select coalesce(jsonb_object_agg(rate.channel, rate.points), '{}'::jsonb) into v_after
  from public.message_point_rates rate where rate.effective_to is null;

  if v_before is distinct from v_after then
    insert into public.audit_log(org_id, actor_id, action, table_name, row_pk, before, after)
    values (null, (select auth.uid()), 'MESSAGE_POINT_RATE_UPDATE', 'message_point_rates', 'global', v_before, v_after);
  end if;

  return jsonb_build_object('ok', true, 'rates', v_after);
end
$$;
revoke all on function public.platform_set_message_point_rates(integer, integer, integer, integer) from public, anon;
grant execute on function public.platform_set_message_point_rates(integer, integer, integer, integer) to authenticated, service_role;

-- 팝빌 팩스 원가(50원/장)로 시작한다. 이미 있으면 유지.
insert into public.message_point_rates(channel, points, effective_from)
select 'fax', 50, clock_timestamp()
where not exists (select 1 from public.message_point_rates where channel = 'fax' and effective_to is null);

-- ===== 팩스 하드스톱·차감 =====
do $patch$
declare
  v_def text;
  v_target text;
begin
  -- 작업 생성: 풀 가용 잔액이 1장 단가보다 적으면 만들지 않는다.
  v_def := pg_get_functiondef('public.create_fax_dispatch_job(bigint,text)'::regprocedure);
  v_target := E'  select count(*) into v_attempt from public.provider_dispatch_jobs where bill_issue_id = p_bill_issue_id;';
  if (length(v_def) - length(replace(v_def, v_target, ''))) / length(v_target) <> 1 then
    raise exception 'patch target not found in create_fax_dispatch_job';
  end if;
  v_def := replace(v_def, v_target,
    E'  -- 팝빌 포인트 하드스톱(본사 단일 풀): 1장 단가만큼도 남지 않으면 접수하지 않는다.\n'
    || E'  if (select pool.available_points from public.point_pool_balance() pool)\n'
    || E'     < coalesce((select rate.points from public.message_point_rates rate where rate.channel = ''fax'' and rate.effective_to is null), 1) then\n'
    || E'    return jsonb_build_object(''ok'', false, ''code'', ''INSUFFICIENT_POINTS'');\n'
    || E'  end if;\n\n'
    || v_target);
  execute v_def;

  -- 결과 확정: 성공 페이지 × 팩스 단가를 발송 조직 원장에 사용으로 기록한다(pending→terminal 1회만 실행).
  v_def := pg_get_functiondef('public.apply_fax_dispatch_result(bigint,text,integer,integer,integer,integer,integer,timestamptz)'::regprocedure);
  v_target := E'    update public.bill_issues set send_status = p_status where id = v_job.bill_issue_id;\n';
  if (length(v_def) - length(replace(v_def, v_target, ''))) / length(v_target) <> 1 then
    raise exception 'patch target not found in apply_fax_dispatch_result';
  end if;
  v_def := replace(v_def, v_target, v_target
    || E'    if coalesce(p_success_pages, 0) > 0 then\n'
    || E'      insert into public.point_transactions(org_id, type, points, memo)\n'
    || E'      select v_job.org_id, ''usage'', -(p_success_pages * rate.points),\n'
    || E'             ''팩스 발송 · '' || p_success_pages || ''장 · job '' || v_job.id\n'
    || E'      from public.message_point_rates rate\n'
    || E'      where rate.channel = ''fax'' and rate.effective_to is null;\n'
    || E'    end if;\n');
  execute v_def;
end
$patch$;

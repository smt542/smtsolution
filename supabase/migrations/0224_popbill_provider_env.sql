-- 팝빌 접수 작업에 접수 환경(test/live)을 기록한다.
-- 로컬(테스트 키)과 배포본(운영 키)이 같은 DB를 쓰므로, 결과 재조회는 자기 환경의 작업만 가져온다.
-- 기존 작업은 전부 test다(운영 환경은 2026-10-02까지 열린 적 없음 — 운영 조회 -99010016).

alter table public.provider_dispatch_jobs
  add column if not exists provider_env text not null default 'test';

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'provider_dispatch_jobs_provider_env_check'
  ) then
    alter table public.provider_dispatch_jobs
      add constraint provider_dispatch_jobs_provider_env_check check (provider_env in ('test', 'live'));
  end if;
end $$;

comment on column public.provider_dispatch_jobs.provider_env is
  '접수 환경(test=팝빌 테스트베드, live=운영). 결과 재조회는 같은 환경 작업만 조회한다.';

-- 메시지 작업 생성: p_jobs[].provider_env(없으면 test)를 기록한다. 시그니처는 그대로다.
-- p_jobs: [{ product, request_num, schedule_id, provider_env, recipients: [{ recipient_key, provider_ref_key }] }]
create or replace function public.create_provider_dispatch_jobs(
  p_reservation_id bigint,
  p_jobs jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.message_point_reservations%rowtype;
  v_job jsonb;
  v_job_id bigint;
  v_status text;
  v_receipt text;
  v_result jsonb := '[]'::jsonb;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;
  select * into v_reservation from public.message_point_reservations where id = p_reservation_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND'); end if;
  if p_jobs is null or jsonb_typeof(p_jobs) <> 'array' then
    raise exception 'invalid jobs payload' using errcode = '22023';
  end if;

  for v_job in select value from jsonb_array_elements(p_jobs) loop
    -- 재시도/replay 안전: 같은 request_num이면 재삽입하지 않고 기존 작업을 재사용한다.
    insert into public.provider_dispatch_jobs(
      org_id, provider, kind, product, reservation_id, message_log_id,
      schedule_id, request_num, status, provider_env
    ) values (
      v_reservation.org_id, 'popbill', 'message', v_job->>'product',
      p_reservation_id, v_reservation.message_log_id,
      nullif(v_job->>'schedule_id', '')::bigint, v_job->>'request_num', 'submitting',
      coalesce(nullif(v_job->>'provider_env', ''), 'test')
    )
    on conflict (request_num) do nothing
    returning id into v_job_id;

    if v_job_id is null then
      select id into v_job_id from public.provider_dispatch_jobs
      where request_num = v_job->>'request_num';
    end if;

    insert into public.provider_dispatch_recipients(job_id, recipient_key, provider_ref_key, product)
    select v_job_id, rec.value->>'recipient_key', rec.value->>'provider_ref_key', v_job->>'product'
    from jsonb_array_elements(v_job->'recipients') as rec(value)
    on conflict (job_id, recipient_key) do nothing;

    select status, receipt_num into v_status, v_receipt
    from public.provider_dispatch_jobs where id = v_job_id;

    v_result := v_result || jsonb_build_object(
      'request_num', v_job->>'request_num', 'job_id', v_job_id,
      'status', v_status, 'receipt_num', v_receipt
    );
  end loop;

  return jsonb_build_object('ok', true, 'jobs', v_result);
end
$$;
revoke all on function public.create_provider_dispatch_jobs(bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_provider_dispatch_jobs(bigint, jsonb) to service_role;

-- 팩스 작업 생성: p_provider_env 인자 추가(기본 test → 옛 클라이언트 호환). 옛 시그니처는 지운다(오버로드 금지).
drop function if exists public.create_fax_dispatch_job(bigint);
create or replace function public.create_fax_dispatch_job(
  p_bill_issue_id bigint,
  p_provider_env text default 'test'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org bigint;
  v_attempt integer;
  v_request text;
  v_job_id bigint;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;

  select b.org_id into v_org
  from public.bill_issues bi
  join public.units u on u.id = bi.unit_id
  join public.buildings b on b.id = u.building_id
  where bi.id = p_bill_issue_id and bi.issue_type = 'fax';
  if v_org is null then
    return jsonb_build_object('ok', false, 'code', 'BILL_ISSUE_NOT_FOUND');
  end if;

  -- 재시도는 terminal 실패 작업에만 허용한다. 진행 중(submitting/pending/reconcile_required)이면 중복 전송을 막는다.
  if exists (
    select 1 from public.provider_dispatch_jobs
    where bill_issue_id = p_bill_issue_id and status in ('submitting', 'pending', 'reconcile_required')
  ) then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_IN_FLIGHT');
  end if;

  select count(*) into v_attempt from public.provider_dispatch_jobs where bill_issue_id = p_bill_issue_id;
  v_request := 'f' || p_bill_issue_id || 'a' || v_attempt;

  insert into public.provider_dispatch_jobs(
    org_id, provider, kind, product, bill_issue_id, request_num, status, provider_env
  ) values (
    v_org, 'popbill', 'fax', 'fax', p_bill_issue_id, v_request, 'submitting',
    coalesce(nullif(p_provider_env, ''), 'test')
  ) returning id into v_job_id;

  insert into public.provider_dispatch_recipients(job_id, recipient_key, provider_ref_key, product)
    values (v_job_id, v_request, v_request, 'fax');

  return jsonb_build_object('ok', true, 'job_id', v_job_id, 'request_num', v_request, 'provider_ref_key', v_request);
end
$$;
revoke all on function public.create_fax_dispatch_job(bigint, text) from public, anon, authenticated;
grant execute on function public.create_fax_dispatch_job(bigint, text) to service_role;

-- 결과 재조회 claim: p_provider_env가 있으면 그 환경 작업만, null이면 기존 동작(전체).
drop function if exists public.claim_provider_dispatch_jobs(integer);
create or replace function public.claim_provider_dispatch_jobs(
  p_limit integer default 50,
  p_provider_env text default null
)
returns setof public.provider_dispatch_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;

  return query
  with due as (
    select job.id
    from public.provider_dispatch_jobs job
    where (
        (
          job.status in ('pending', 'reconcile_required')
          and job.next_poll_at is not null
          and job.next_poll_at <= now()
        )
        or (
          job.kind = 'message'
          and job.status = 'submitting'
          and job.submit_owner is not null
          and job.lease_until is not null
          and job.lease_until <= now()
        )
      )
      and (job.lease_until is null or job.lease_until <= now())
      and (p_provider_env is null or job.provider_env = p_provider_env)
    order by coalesce(job.next_poll_at, job.lease_until, job.updated_at)
    for update skip locked
    limit greatest(1, coalesce(p_limit, 50))
  ), claimed as (
    update public.provider_dispatch_jobs job
    set status = case
          when job.status = 'submitting' then 'reconcile_required'
          else job.status
        end,
        next_poll_at = case
          when job.status = 'submitting' then now()
          else job.next_poll_at
        end,
        lease_until = now() + interval '5 minutes',
        poll_attempts = job.poll_attempts + 1,
        last_error_code = case
          when job.status = 'submitting' then 'SUBMISSION_LEASE_EXPIRED'
          else job.last_error_code
        end,
        last_error_message = case
          when job.status = 'submitting' then 'Submission lease expired before a receipt was persisted'
          else job.last_error_message
        end
    from due
    where job.id = due.id
    returning job.*
  ), reservation_updates as (
    update public.message_point_reservations reservation
      set status = 'reconcile_required'
    where reservation.status = 'reserved'
      and exists (
        select 1 from claimed
        where claimed.reservation_id = reservation.id
          and claimed.status = 'reconcile_required'
      )
    returning reservation.id
  ), log_updates as (
    update public.message_logs log
      set point_status = 'reconcile_required'
    where log.point_status = 'reserved'
      and exists (
        select 1 from claimed
        where claimed.message_log_id = log.id
          and claimed.status = 'reconcile_required'
      )
    returning log.id
  )
  select claimed.* from claimed;
end
$$;
revoke all on function public.claim_provider_dispatch_jobs(integer, text)
  from public, anon, authenticated;
grant execute on function public.claim_provider_dispatch_jobs(integer, text) to service_role;

notify pgrst, 'reload schema';

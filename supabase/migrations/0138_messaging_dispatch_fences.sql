-- Fence provider submissions with an explicit owner and lease. A lease expiry is
-- ambiguous: the provider may have accepted the request before the receipt was
-- persisted, so expired submissions are reconciled by RequestNum and never resent.

alter table public.provider_dispatch_jobs
  add column if not exists submit_owner uuid,
  add column if not exists claimed_at timestamptz;

comment on column public.provider_dispatch_jobs.submit_owner is
  'Owner token for the single process allowed to cross the provider submission boundary';
comment on column public.provider_dispatch_jobs.claimed_at is
  'Time the provider submission owner was acquired; retained for reconciliation age';

create index if not exists provider_dispatch_jobs_submission_lease_idx
  on public.provider_dispatch_jobs(status, lease_until)
  where kind = 'message' and status in ('submitting', 'reconcile_required');

create or replace function public.provider_dispatch_job_status_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if old.status = 'submitting'
     and new.status in ('pending', 'failed', 'reconcile_required') then
    return new;
  end if;
  if old.status = 'pending'
     and new.status in ('sent', 'partial', 'failed', 'reconcile_required') then
    return new;
  end if;
  -- A RequestNum lookup can prove that an ambiguous submission is pending.
  if old.status = 'reconcile_required'
     and new.status in ('pending', 'sent', 'partial', 'failed') then
    return new;
  end if;
  raise exception 'invalid provider dispatch status transition: % -> %', old.status, new.status
    using errcode = '22023';
end
$$;
revoke all on function public.provider_dispatch_job_status_guard() from public;

-- Rows created by pre-fence application versions are already ambiguous. Quarantine
-- message jobs instead of giving a new process permission to submit them again.
update public.provider_dispatch_jobs
set status = 'reconcile_required',
    claimed_at = coalesce(claimed_at, submitted_at, updated_at, created_at),
    next_poll_at = coalesce(next_poll_at, now()),
    lease_until = null,
    last_error_code = coalesce(last_error_code, 'SUBMISSION_OWNER_UNKNOWN'),
    last_error_message = coalesce(last_error_message, 'Submission predates the ownership fence')
where kind = 'message' and status = 'submitting';

-- Older unknown-submit outcomes were already marked reconcile_required but were
-- not pollable because they had neither a receipt nor next_poll_at.
update public.provider_dispatch_jobs
set claimed_at = coalesce(claimed_at, submitted_at, updated_at, created_at),
    next_poll_at = coalesce(next_poll_at, now()),
    lease_until = null
where kind = 'message'
  and status = 'reconcile_required'
  and receipt_num is null
  and next_poll_at is null;

update public.message_point_reservations reservation
set status = 'reconcile_required'
where reservation.status = 'reserved'
  and exists (
    select 1
    from public.provider_dispatch_jobs job
    where job.reservation_id = reservation.id
      and job.status = 'reconcile_required'
  );

update public.message_logs log
set point_status = 'reconcile_required'
where log.point_status = 'reserved'
  and exists (
    select 1
    from public.provider_dispatch_jobs job
    where job.message_log_id = log.id
      and job.status = 'reconcile_required'
  );

create or replace function public.claim_provider_dispatch_submission(
  p_reservation_id bigint,
  p_request_num text,
  p_owner uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.provider_dispatch_jobs%rowtype;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;
  if p_owner is null then
    raise exception 'submission owner is required' using errcode = '22023';
  end if;

  select * into v_job
  from public.provider_dispatch_jobs job
  where job.reservation_id = p_reservation_id
    and job.request_num = p_request_num
    and job.kind = 'message'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'JOB_NOT_FOUND');
  end if;

  if v_job.receipt_num is not null then
    return jsonb_build_object(
      'ok', true, 'action', 'terminal', 'job_id', v_job.id,
      'status', v_job.status, 'receipt_num', v_job.receipt_num,
      'claimed_at', v_job.claimed_at
    );
  end if;

  if v_job.status in ('sent', 'partial', 'failed') then
    return jsonb_build_object(
      'ok', true, 'action', 'terminal', 'job_id', v_job.id,
      'status', v_job.status, 'claimed_at', v_job.claimed_at
    );
  end if;

  if v_job.status in ('pending', 'reconcile_required') then
    if v_job.lease_until is not null and v_job.lease_until > now() then
      return jsonb_build_object(
        'ok', true, 'action', 'wait', 'job_id', v_job.id,
        'status', v_job.status, 'claimed_at', v_job.claimed_at
      );
    end if;
    update public.provider_dispatch_jobs
      set lease_until = now() + interval '5 minutes',
          poll_attempts = poll_attempts + 1,
          next_poll_at = coalesce(next_poll_at, now())
      where id = v_job.id
      returning * into v_job;
    return jsonb_build_object(
      'ok', true, 'action', 'reconcile', 'job_id', v_job.id,
      'status', v_job.status, 'claimed_at', v_job.claimed_at
    );
  end if;

  if v_job.submit_owner is null and v_job.claimed_at is null then
    update public.provider_dispatch_jobs
      set submit_owner = p_owner,
          claimed_at = now(),
          lease_until = now() + interval '5 minutes'
      where id = v_job.id and status = 'submitting'
      returning * into v_job;
    return jsonb_build_object(
      'ok', true, 'action', 'submit', 'job_id', v_job.id,
      'status', v_job.status, 'claimed_at', v_job.claimed_at
    );
  end if;

  if v_job.lease_until is not null and v_job.lease_until > now() then
    return jsonb_build_object(
      'ok', true, 'action', 'wait', 'job_id', v_job.id,
      'status', v_job.status, 'claimed_at', v_job.claimed_at
    );
  end if;

  update public.provider_dispatch_jobs
    set status = 'reconcile_required',
        lease_until = now() + interval '5 minutes',
        next_poll_at = now(),
        poll_attempts = poll_attempts + 1,
        last_error_code = 'SUBMISSION_LEASE_EXPIRED',
        last_error_message = 'Submission lease expired before a receipt was persisted'
    where id = v_job.id and status = 'submitting'
    returning * into v_job;

  update public.message_point_reservations
    set status = 'reconcile_required'
    where id = p_reservation_id and status = 'reserved';
  update public.message_logs
    set point_status = 'reconcile_required'
    where id = v_job.message_log_id and point_status = 'reserved';

  return jsonb_build_object(
    'ok', true, 'action', 'reconcile', 'job_id', v_job.id,
    'status', v_job.status, 'claimed_at', v_job.claimed_at
  );
end
$$;
revoke all on function public.claim_provider_dispatch_submission(bigint, text, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_provider_dispatch_submission(bigint, text, uuid)
  to service_role;

-- Outcome writes are ownership-fenced too. A delayed owner may persist the receipt
-- after another worker moved the row to reconciliation, but no unrelated worker can.
create or replace function public.mark_message_reservation_provider_pending(
  p_reservation_id bigint,
  p_outcomes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.message_point_reservations%rowtype;
  v_outcome jsonb;
  v_changed integer;
  v_accepted integer := 0;
  v_unknown integer := 0;
  v_failed integer := 0;
  v_new_status text;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;
  select * into v_reservation
  from public.message_point_reservations
  where id = p_reservation_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND');
  end if;
  if v_reservation.status in ('settled', 'released') then
    return jsonb_build_object('ok', true, 'replayed', true, 'status', v_reservation.status);
  end if;
  if p_outcomes is null or jsonb_typeof(p_outcomes) <> 'array' then
    raise exception 'invalid outcomes payload' using errcode = '22023';
  end if;

  for v_outcome in select value from jsonb_array_elements(p_outcomes) loop
    v_changed := 0;
    if v_outcome->>'outcome' = 'accepted' then
      update public.provider_dispatch_jobs
        set receipt_num = v_outcome->>'receipt_num',
            status = 'pending',
            submitted_at = now(),
            next_poll_at = now() + interval '1 minute',
            lease_until = null,
            last_error_code = null,
            last_error_message = null
        where reservation_id = p_reservation_id
          and request_num = v_outcome->>'request_num'
          and status in ('submitting', 'reconcile_required')
          and submit_owner = nullif(v_outcome->>'submit_owner', '')::uuid;
      get diagnostics v_changed = row_count;
      v_accepted := v_accepted + v_changed;
    elsif v_outcome->>'outcome' = 'unknown' then
      update public.provider_dispatch_jobs
        set status = 'reconcile_required',
            next_poll_at = now(),
            lease_until = null,
            last_error_code = v_outcome->>'error_code',
            last_error_message = left(coalesce(v_outcome->>'error_message', ''), 500)
        where reservation_id = p_reservation_id
          and request_num = v_outcome->>'request_num'
          and status in ('submitting', 'reconcile_required')
          and submit_owner = nullif(v_outcome->>'submit_owner', '')::uuid;
      get diagnostics v_changed = row_count;
      v_unknown := v_unknown + v_changed;
    else
      update public.provider_dispatch_jobs
        set status = 'failed',
            completed_at = now(),
            lease_until = null,
            last_error_code = v_outcome->>'error_code',
            last_error_message = left(coalesce(v_outcome->>'error_message', ''), 500)
        where reservation_id = p_reservation_id
          and request_num = v_outcome->>'request_num'
          and status in ('submitting', 'reconcile_required')
          and submit_owner = nullif(v_outcome->>'submit_owner', '')::uuid;
      get diagnostics v_changed = row_count;
      if v_changed > 0 then
        update public.provider_dispatch_recipients
          set status = 'failed', completed_at = now(), result_code = v_outcome->>'error_code'
          where job_id in (
            select id from public.provider_dispatch_jobs
            where reservation_id = p_reservation_id
              and request_num = v_outcome->>'request_num'
          ) and status = 'pending';
      end if;
      v_failed := v_failed + v_changed;
    end if;
  end loop;

  if exists (
    select 1 from public.provider_dispatch_jobs
    where reservation_id = p_reservation_id and status in ('pending', 'sent', 'partial')
  ) then
    v_new_status := 'provider_pending';
  elsif exists (
    select 1 from public.provider_dispatch_jobs
    where reservation_id = p_reservation_id and status = 'reconcile_required'
  ) then
    v_new_status := 'reconcile_required';
  elsif exists (
    select 1 from public.provider_dispatch_jobs
    where reservation_id = p_reservation_id and status = 'submitting'
  ) then
    v_new_status := 'reserved';
  else
    v_new_status := 'released';
  end if;

  if v_new_status = 'released' then
    update public.message_point_reservations
      set status = 'released', charged_points = 0, settled_at = now()
      where id = p_reservation_id;
    update public.message_logs
      set result = 'failed', charged_points = 0, point_status = 'released'
      where id = v_reservation.message_log_id;
  else
    update public.message_point_reservations set status = v_new_status where id = p_reservation_id;
    update public.message_logs set point_status = v_new_status where id = v_reservation.message_log_id;
  end if;

  return jsonb_build_object(
    'ok', true, 'status', v_new_status,
    'accepted', v_accepted, 'unknown', v_unknown, 'failed', v_failed
  );
end
$$;
revoke all on function public.mark_message_reservation_provider_pending(bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.mark_message_reservation_provider_pending(bigint, jsonb)
  to service_role;

-- RequestNum reconciliation is allowed to apply results while the row remains
-- reconcile_required. Pending lookups stay on that path until all recipients settle.
create or replace function public.apply_provider_dispatch_results(
  p_job_id bigint,
  p_results jsonb,
  p_next_poll_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.provider_dispatch_jobs%rowtype;
  v_total integer;
  v_pending integer;
  v_success integer;
  v_fail integer;
  v_new_status text;
  v_settled jsonb := null;
  v_all_terminal boolean;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;

  select * into v_job from public.provider_dispatch_jobs where id = p_job_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'JOB_NOT_FOUND'); end if;
  if v_job.status not in ('pending', 'reconcile_required') then
    return jsonb_build_object('ok', true, 'replayed', true, 'job_status', v_job.status);
  end if;

  if p_results is not null and jsonb_typeof(p_results) = 'array' then
    update public.provider_dispatch_recipients rec
      set status = result.value->>'status',
          result_code = result.value->>'code',
          completed_at = now()
    from jsonb_array_elements(p_results) as result(value)
    where rec.job_id = p_job_id
      and rec.provider_ref_key = result.value->>'provider_ref_key'
      and rec.status = 'pending'
      and result.value->>'status' in ('success', 'failed');
  end if;

  select count(*),
    count(*) filter (where status = 'pending'),
    count(*) filter (where status = 'success'),
    count(*) filter (where status = 'failed')
  into v_total, v_pending, v_success, v_fail
  from public.provider_dispatch_recipients where job_id = p_job_id;

  if v_pending = 0 then
    v_new_status := case when v_fail = 0 then 'sent' when v_success = 0 then 'failed' else 'partial' end;
    update public.provider_dispatch_jobs
      set status = v_new_status, completed_at = now(), next_poll_at = null, lease_until = null
      where id = p_job_id;
  elsif p_next_poll_at is null then
    v_new_status := 'reconcile_required';
    update public.provider_dispatch_jobs
      set status = 'reconcile_required', next_poll_at = null, lease_until = null
      where id = p_job_id;
  elsif v_job.status = 'reconcile_required' then
    v_new_status := 'reconcile_required';
    update public.provider_dispatch_jobs
      set next_poll_at = p_next_poll_at, lease_until = null
      where id = p_job_id;
  else
    v_new_status := 'pending';
    update public.provider_dispatch_jobs
      set next_poll_at = p_next_poll_at, lease_until = null
      where id = p_job_id;
  end if;

  if v_new_status in ('sent', 'partial', 'failed') and v_job.reservation_id is not null then
    select not exists (
      select 1 from public.provider_dispatch_jobs
      where reservation_id = v_job.reservation_id and status not in ('sent', 'partial', 'failed')
    ) into v_all_terminal;
    if v_all_terminal then
      v_settled := public.settle_message_points_from_jobs(v_job.reservation_id);
    end if;
  end if;

  return jsonb_build_object('ok', true, 'job_status', v_new_status, 'settled', v_settled);
end
$$;
revoke all on function public.apply_provider_dispatch_results(bigint, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_provider_dispatch_results(bigint, jsonb, timestamptz)
  to service_role;

create or replace function public.claim_provider_dispatch_jobs(p_limit integer default 50)
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
revoke all on function public.claim_provider_dispatch_jobs(integer)
  from public, anon, authenticated;
grant execute on function public.claim_provider_dispatch_jobs(integer) to service_role;

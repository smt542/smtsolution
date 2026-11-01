-- QA #64: 알림톡 대체문자(SMS/LMS) 발송 시 차액만 추가 차감한다.
--  - 알림톡 접수 시 예약/정산은 기존대로 알림톡 단가(8P). 결과 조회에서 "카카오 실패 + 대체문자 성공"으로
--    확인된 수신자만 (대체문자 단가 - 알림톡 단가)를 추가로 차감한다(단문 12-8=4P, 장문 32-8=24P).
--  - 단가는 예약 rate_snapshot(없으면 message_point_rates 현행)에서 읽는다. 하드코딩 없음.
--  - 멱등: message_alt_charges 의 PK(recipient_id)로 수신자당 한 번만 차감한다.
--  - 원장(point_transactions, type=adjustment, memo)에 사유를 남기고, 예약 정산(charged_points)에 차액을 합산한다.
--  - 발송 이력용: provider_dispatch_recipients.alt_product, list_message_logs.alt_count.

alter table public.provider_dispatch_recipients
  add column if not exists alt_product text
  check (alt_product is null or alt_product in ('sms', 'lms'));

create table if not exists public.message_alt_charges (
  recipient_id bigint primary key
    references public.provider_dispatch_recipients(id) on delete cascade,
  org_id bigint not null,
  message_log_id bigint,
  reservation_id bigint,
  alt_product text not null check (alt_product in ('sms', 'lms')),
  points integer not null check (points > 0),
  transaction_id bigint,
  created_at timestamptz not null default now()
);
create index if not exists message_alt_charges_reservation_idx
  on public.message_alt_charges (reservation_id);
alter table public.message_alt_charges enable row level security;
revoke all on public.message_alt_charges from anon, authenticated;

create or replace function public.apply_provider_dispatch_results(
  p_job_id bigint, p_results jsonb, p_next_poll_at timestamp with time zone
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_job public.provider_dispatch_jobs%rowtype;
  v_total integer;
  v_pending integer;
  v_success integer;
  v_fail integer;
  v_new_status text;
  v_settled jsonb := null;
  v_all_terminal boolean;
  v_snapshot jsonb;
  v_requested_by uuid;
  v_base_points integer;
  v_alt record;
  v_alt_points integer;
  v_diff integer;
  v_tx_id bigint;
  v_inserted bigint;
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
          alt_product = case
            when result.value->>'status' = 'success' and result.value->>'alt_product' in ('sms', 'lms')
              then result.value->>'alt_product'
            else null
          end,
          completed_at = now()
    from jsonb_array_elements(p_results) as result(value)
    where rec.job_id = p_job_id
      and rec.provider_ref_key = result.value->>'provider_ref_key'
      and rec.status = 'pending'
      and result.value->>'status' in ('success', 'failed');

    -- 대체문자로 나간 수신자: 대체문자 단가 - 알림톡 단가 차액을 추가 차감(수신자당 1회).
    if v_job.product = 'alimtalk' then
      if v_job.reservation_id is not null then
        select rate_snapshot, requested_by into v_snapshot, v_requested_by
        from public.message_point_reservations where id = v_job.reservation_id;
      end if;
      v_base_points := coalesce(
        (v_snapshot->'alimtalk'->>'points')::integer,
        (select points from public.message_point_rates
          where channel = 'alimtalk' and effective_from <= now()
            and (effective_to is null or effective_to > now())
          order by effective_from desc limit 1)
      );
      for v_alt in
        select rec.id, rec.recipient_key, rec.alt_product
        from public.provider_dispatch_recipients rec
        where rec.job_id = p_job_id and rec.status = 'success' and rec.alt_product is not null
          and not exists (select 1 from public.message_alt_charges c where c.recipient_id = rec.id)
      loop
        v_alt_points := coalesce(
          (v_snapshot->v_alt.alt_product->>'points')::integer,
          (select points from public.message_point_rates
            where channel = v_alt.alt_product and effective_from <= now()
              and (effective_to is null or effective_to > now())
            order by effective_from desc limit 1)
        );
        v_diff := coalesce(v_alt_points, 0) - coalesce(v_base_points, 0);
        if v_diff <= 0 then continue; end if;

        insert into public.message_alt_charges(
          recipient_id, org_id, message_log_id, reservation_id, alt_product, points
        ) values (
          v_alt.id, v_job.org_id, v_job.message_log_id, v_job.reservation_id, v_alt.alt_product, v_diff
        ) on conflict (recipient_id) do nothing
        returning recipient_id into v_inserted;
        if v_inserted is null then continue; end if;

        -- usage 행은 message_log 당 1개(point_usage_one_per_message_log)라 차액은 adjustment 행으로 남긴다.
        insert into public.point_transactions(
          org_id, type, points, amount_krw, memo, created_by, message_log_id, reservation_id
        ) values (
          v_job.org_id, 'adjustment'::public.point_tx_type, -v_diff, null,
          '알림톡 대체문자 발송 차액 · ' || upper(v_alt.alt_product) || ' ' || v_alt_points
            || 'P - 알림톡 ' || v_base_points || 'P · 수신 #' || v_alt.id,
          v_requested_by, v_job.message_log_id, v_job.reservation_id
        ) returning id into v_tx_id;
        update public.message_alt_charges set transaction_id = v_tx_id where recipient_id = v_alt.id;

        -- 예약 없이 정산되는 건은 로그의 사용 포인트에 바로 합산한다(예약 건은 settle 이 합산).
        if v_job.reservation_id is null and v_job.message_log_id is not null then
          update public.message_logs
            set charged_points = charged_points + v_diff
            where id = v_job.message_log_id;
        end if;
      end loop;
    end if;
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
      set next_poll_at = case  -- 0327: 접수 2분 안에는 10초 뒤 재확인
        when v_job.submitted_at > now() - interval '2 minutes'
          then least(p_next_poll_at, now() + interval '10 seconds')
        else p_next_poll_at
      end, lease_until = null
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
$function$;

-- 정산: 대체문자 차액(message_alt_charges)을 예약/로그의 charged_points 에 합산한다.
-- usage 원장 행(알림톡 단가 기준)은 그대로, 차액은 apply_provider_dispatch_results 가 별도 행으로 이미 남겼다.
create or replace function public.settle_message_points_from_jobs(p_reservation_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_reservation public.message_point_reservations%rowtype;
  v_org_id bigint;
  v_total integer;
  v_success integer;
  v_charged integer;
  v_alt_charged integer;
  v_sms integer;
  v_lms integer;
  v_alimtalk integer;
  v_pending_jobs integer;
  v_log_result text;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;

  select * into v_reservation from public.message_point_reservations
  where id = p_reservation_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND'); end if;
  v_org_id := v_reservation.org_id;

  if v_reservation.status in ('settled', 'released') then
    return jsonb_build_object('ok', true, 'replayed', true,
      'status', v_reservation.status, 'charged_points', v_reservation.charged_points);
  end if;

  perform 1 from public.organizations where id = v_org_id for update;

  -- 관련 job이 모두 terminal일 때만 정산한다.
  select count(*) into v_pending_jobs
  from public.provider_dispatch_jobs job
  where job.reservation_id = p_reservation_id and job.status not in ('sent', 'partial', 'failed');
  if v_pending_jobs > 0 then
    return jsonb_build_object('ok', true, 'settled', false, 'pending_jobs', v_pending_jobs);
  end if;

  with recips as (
    select rec.recipient_key, rec.status, rec.product
    from public.provider_dispatch_recipients rec
    join public.provider_dispatch_jobs job on job.id = rec.job_id
    where job.reservation_id = p_reservation_id
  ),
  costed as (
    select recips.status, recips.product,
      coalesce((cost.value->>'points')::integer, 0) as points
    from recips
    left join lateral (
      select value from jsonb_array_elements(v_reservation.recipient_costs) as value
      where value->>'recipient_key' = recips.recipient_key limit 1
    ) cost on true
  )
  select count(*),
    count(*) filter (where status = 'success'),
    coalesce(sum(points) filter (where status = 'success'), 0),
    count(*) filter (where status = 'success' and product = 'sms'),
    count(*) filter (where status = 'success' and product = 'lms'),
    count(*) filter (where status = 'success' and product = 'alimtalk')
  into v_total, v_success, v_charged, v_sms, v_lms, v_alimtalk
  from costed;

  if v_success = 0 then
    update public.message_point_reservations
      set status = 'released', charged_points = 0, settled_at = now()
      where id = p_reservation_id;
    update public.message_logs
      set result = 'failed', charged_points = 0, point_status = 'released'
      where id = v_reservation.message_log_id;
    -- 연결된 예약 스케줄(예약발송)·직접 message_log(즉시발송) 고지서를 실패로 최종화한다.
    update public.message_schedules
      set status = 'failed'
      where message_log_id = v_reservation.message_log_id and status = 'sending';
    update public.bill_issues
      set send_status = 'failed'
      where message_schedule_id in (
        select id from public.message_schedules where message_log_id = v_reservation.message_log_id
      )
      or message_log_id = v_reservation.message_log_id;
    return jsonb_build_object('ok', true, 'status', 'released', 'result', 'failed', 'charged_points', 0);
  end if;

  select coalesce(sum(points), 0) into v_alt_charged
  from public.message_alt_charges where reservation_id = p_reservation_id;

  insert into public.point_transactions(
    org_id, type, points, amount_krw, memo, created_by, message_log_id, reservation_id
  ) values (
    v_org_id, 'usage'::public.point_tx_type, -v_charged, null,
    '메시지 발송 · SMS ' || v_sms || ' · LMS ' || v_lms || ' · 알림톡 ' || v_alimtalk,
    v_reservation.requested_by, v_reservation.message_log_id, p_reservation_id
  );

  v_log_result := case when v_success = v_total then 'sent' else 'partial' end;

  update public.message_point_reservations
    set status = 'settled', charged_points = v_charged + v_alt_charged, settled_at = now()
    where id = p_reservation_id;
  update public.message_logs
    set result = v_log_result, charged_points = v_charged + v_alt_charged, point_status = 'settled'
    where id = v_reservation.message_log_id;

  -- 연결된 예약 스케줄(예약발송)·직접 message_log(즉시발송) 고지서를 sent/partial로 최종화한다.
  -- 접수 시 queued였던 고지서는 provider terminal 결과가 확정된 뒤에만 최종 상태로 바뀐다(partial 보존).
  update public.message_schedules
    set status = case when v_log_result = 'sent' then 'sent' else 'partial' end
    where message_log_id = v_reservation.message_log_id and status = 'sending';
  update public.bill_issues
    set send_status = v_log_result
    where message_schedule_id in (
      select id from public.message_schedules where message_log_id = v_reservation.message_log_id
    )
    or message_log_id = v_reservation.message_log_id;

  return jsonb_build_object('ok', true, 'status', 'settled', 'result', v_log_result,
    'charged_points', v_charged + v_alt_charged, 'alt_charged_points', v_alt_charged,
    'released_points', v_reservation.reserved_points - v_charged);
end
$function$;

-- 발송 이력: 대체문자로 나간 수신자 수(alt_count)를 함께 돌려준다(반환 컬럼 추가 → drop 후 재생성).
drop function if exists public.list_message_logs(integer);
create function public.list_message_logs(p_limit integer default 50)
returns table(id bigint, org_id bigint, channel text, body text, context text, recipient_count integer,
  recipients jsonb, result text, sent_by uuid, sent_at timestamptz, created_at timestamptz,
  template_id bigint, estimated_points integer, charged_points integer, point_status text,
  notice_id bigint, is_scheduled boolean, alt_count integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not current_user_has_module('messaging') then
    raise exception 'forbidden: messaging required';
  end if;

  return query
    select
      ml.id,
      ml.org_id,
      ml.channel,
      ml.body,
      ml.context,
      ml.recipient_count,
      coalesce((
        select jsonb_agg(
          case
            when recipient.value ? 'phone' then recipient.value || jsonb_build_object(
              'phone',
              recipient.value->>'phone'
            )
            else recipient.value
          end
          order by recipient.ordinality
        )
        from jsonb_array_elements(coalesce(ml.recipients, '[]'::jsonb))
          with ordinality as recipient(value, ordinality)
      ), '[]'::jsonb),
      ml.result,
      ml.sent_by,
      ml.sent_at,
      ml.created_at,
      ml.template_id,
      ml.estimated_points,
      ml.charged_points,
      ml.point_status,
      ml.notice_id,
      exists (
        select 1
        from public.message_schedules ms
        where ms.message_log_id = ml.id
      ) as is_scheduled,
      (
        select count(*)::integer
        from public.provider_dispatch_recipients pr
        join public.provider_dispatch_jobs pj on pj.id = pr.job_id
        where pj.message_log_id = ml.id and pr.alt_product is not null
      ) as alt_count
    from public.message_logs ml
    where ml.org_id in (select my_org_ids())
    order by ml.sent_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 100));
end
$function$;
revoke all on function public.list_message_logs(integer) from public, anon;
grant execute on function public.list_message_logs(integer) to authenticated, service_role;

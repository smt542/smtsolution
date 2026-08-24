-- Track E 후속: message_schedules 소비 worker (claim/reserve/complete)
-- 의존: 0032(message_schedules, bill_issues.message_schedule_id), 0037(포인트 견적/예약/정산)

-- 1) 스키마: sending 상태 + claim/로그 링크 컬럼
alter table message_schedules drop constraint if exists message_schedules_status_check;
alter table message_schedules add constraint message_schedules_status_check
  check (status in ('scheduled','sending','cancelled','sent','failed'));
alter table message_schedules
  add column if not exists claimed_at timestamptz,
  add column if not exists message_log_id bigint references message_logs(id) on delete set null;
create index if not exists message_schedules_due_idx
  on message_schedules (scheduled_at)
  where status in ('scheduled','sending');

-- 2) 만기행 원자적 claim (service_role)
create or replace function claim_due_message_schedules(
  p_org_id bigint default null,
  p_limit int default 50,
  p_stale_after interval default '15 minutes'
) returns table(
  id bigint, org_id bigint, channel text, body text, context text,
  recipients jsonb, template_id bigint
) language plpgsql security definer set search_path = public as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;
  return query
  with due as (
    select ms.id
    from message_schedules ms
    where (p_org_id is null or ms.org_id = p_org_id)
      and (
        (ms.status = 'scheduled' and ms.scheduled_at <= now())
        or (ms.status = 'sending' and ms.claimed_at < now() - p_stale_after)
      )
    order by ms.scheduled_at
    for update skip locked
    limit greatest(1, p_limit)
  )
  update message_schedules ms
    set status = 'sending', claimed_at = now()
    from due
    where ms.id = due.id
    returning ms.id, ms.org_id, ms.channel, ms.body, ms.context, ms.recipients, ms.template_id;
end $$;
revoke all on function claim_due_message_schedules(bigint, int, interval) from public, anon, authenticated;
grant execute on function claim_due_message_schedules(bigint, int, interval) to service_role;

-- 3) 예약행 견적·예약 (service_role) — 결정적 idempotency, 정산완료 replay 안전
create or replace function reserve_scheduled_message(p_schedule_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row message_schedules%rowtype;
  v_quote jsonb;
  v_idem uuid;
  v_hash text;
  v_existing message_point_reservations%rowtype;
  v_log_result text;
  v_ledger bigint; v_reserved bigint; v_available bigint;
  v_log_id bigint; v_reservation_id bigint; v_log_recipients jsonb;
  v_tpl_code text := null; v_buttons jsonb := '[]'::jsonb;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;

  select * into v_row from message_schedules where id = p_schedule_id;
  if not found or v_row.status <> 'sending' then
    return jsonb_build_object('ok', false, 'code', 'SCHEDULE_NOT_CLAIMED');
  end if;

  v_idem := md5('scheduled-message:' || p_schedule_id::text)::uuid;

  v_quote := resolve_message_point_quote(v_row.org_id, v_row.channel, v_row.recipients, v_row.template_id);
  if not coalesce((v_quote->>'ok')::boolean, false) then
    return v_quote;  -- {ok:false, code}
  end if;

  -- 알림톡 템플릿 코드·버튼 (알림톡 수신자 존재 시)
  if v_row.template_id is not null and exists (
    select 1 from jsonb_array_elements(v_quote->'resolved_recipients') r(v)
    where r.v->>'channel' = 'alimtalk'
  ) then
    select mt.alimtalk_template_code, coalesce(mt.buttons, '[]'::jsonb)
      into v_tpl_code, v_buttons
    from message_templates mt where mt.id = v_row.template_id;
  end if;

  -- 기존 예약(결정적 키) → replay
  select * into v_existing from message_point_reservations
    where org_id = v_row.org_id and idempotency_key = v_idem;
  if found then
    if v_existing.status in ('settled', 'released') then
      select result into v_log_result from message_logs where id = v_existing.message_log_id;
      return jsonb_build_object(
        'ok', true, 'replayed', true, 'reservation_status', v_existing.status,
        'message_log_id', v_existing.message_log_id, 'log_result', coalesce(v_log_result, 'failed')
      );
    end if;
    return jsonb_build_object(
      'ok', true, 'replayed', true, 'reservation_status', 'reserved',
      'reservation_id', v_existing.id, 'message_log_id', v_existing.message_log_id,
      'resolved_recipients', v_quote->'resolved_recipients',
      'recipient_costs', v_quote->'recipient_costs',
      'alimtalk_template_code', v_tpl_code, 'buttons', v_buttons
    );
  end if;

  -- 잔액 하드스톱
  select coalesce(sum(points), 0)::bigint into v_ledger
    from point_transactions where org_id = v_row.org_id;
  select coalesce(sum(reserved_points), 0)::bigint into v_reserved
    from message_point_reservations
    where org_id = v_row.org_id and status in ('reserved', 'reconcile_required');
  v_available := v_ledger - v_reserved;
  if v_available < (v_quote->>'estimated_points')::bigint then
    return jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_POINTS',
      'required_points', (v_quote->>'estimated_points')::bigint, 'available_points', v_available);
  end if;

  v_hash := left(md5(v_row.channel || '|' || v_row.body || '|' || v_row.recipients::text), 128);

  select coalesce(jsonb_agg(r.v || jsonb_build_object('result', 'queued') order by r.ord), '[]'::jsonb)
    into v_log_recipients
  from jsonb_array_elements(v_quote->'resolved_recipients') with ordinality as r(v, ord);

  insert into message_logs(
    org_id, channel, body, context, recipient_count, recipients, result,
    sent_by, template_id, estimated_points, charged_points, point_status
  ) values (
    v_row.org_id, v_row.channel, v_row.body, coalesce(v_row.context, 'manual'),
    (v_quote->'counts'->>'total')::integer, v_log_recipients, 'queued',
    v_row.created_by, v_row.template_id, (v_quote->>'estimated_points')::integer, 0, 'reserved'
  ) returning id into v_log_id;

  insert into message_point_reservations(
    org_id, message_log_id, idempotency_key, payload_hash, status,
    reserved_points, charged_points, rate_snapshot, recipient_costs, requested_by, expires_at
  ) values (
    v_row.org_id, v_log_id, v_idem, v_hash, 'reserved',
    (v_quote->>'estimated_points')::integer, 0, v_quote->'rate_snapshot',
    v_quote->'recipient_costs', v_row.created_by, now() + interval '15 minutes'
  ) returning id into v_reservation_id;

  return jsonb_build_object(
    'ok', true, 'replayed', false, 'reservation_status', 'reserved',
    'reservation_id', v_reservation_id, 'message_log_id', v_log_id,
    'resolved_recipients', v_quote->'resolved_recipients',
    'recipient_costs', v_quote->'recipient_costs',
    'alimtalk_template_code', v_tpl_code, 'buttons', v_buttons
  );
end $$;
revoke all on function reserve_scheduled_message(bigint) from public, anon, authenticated;
grant execute on function reserve_scheduled_message(bigint) to service_role;

-- 4) 마감 (service_role) — schedule + 링크 bill_issues 동기화
create or replace function complete_message_schedule(
  p_schedule_id bigint, p_message_log_id bigint, p_final text
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;
  if p_final not in ('sent', 'failed') then
    raise exception 'invalid final status: sent|failed' using errcode = '22023';
  end if;
  update message_schedules
    set status = p_final, message_log_id = coalesce(p_message_log_id, message_log_id)
    where id = p_schedule_id;
  update bill_issues
    set send_status = p_final, message_log_id = coalesce(p_message_log_id, message_log_id)
    where message_schedule_id = p_schedule_id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function complete_message_schedule(bigint, bigint, text) from public, anon, authenticated;
grant execute on function complete_message_schedule(bigint, bigint, text) to service_role;

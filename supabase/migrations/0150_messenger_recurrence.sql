-- 빠른발송: 매월 반복 예약

alter table message_schedules
  add column if not exists recurrence_mode text
    check (recurrence_mode is null or recurrence_mode in ('monthly')),
  add column if not exists recurrence_anchor_day int
    check (recurrence_anchor_day is null or (recurrence_anchor_day between 1 and 31)),
  add column if not exists recurrence_parent_id bigint
    references message_schedules(id) on delete set null;

create or replace function enqueue_next_message_occurrence(p_schedule_id bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v message_schedules%rowtype;
  v_tz text := 'Asia/Seoul';
  v_root bigint; v_anchor int; v_month date; v_last int; v_day int;
  v_next timestamptz; v_existing bigint; v_new_id bigint;
begin
  select * into v from message_schedules where id = p_schedule_id;
  if not found or v.recurrence_mode is distinct from 'monthly' then return null; end if;

  v_root := coalesce(v.recurrence_parent_id, v.id);
  v_anchor := coalesce(v.recurrence_anchor_day, extract(day from (v.scheduled_at at time zone v_tz))::int);
  v_month := (date_trunc('month', (v.scheduled_at at time zone v_tz)) + interval '1 month')::date;
  v_last := extract(day from (v_month + interval '1 month' - interval '1 day'))::int;
  v_day := least(v_anchor, v_last);
  v_next := ((v_month + (v_day - 1)) + (v.scheduled_at at time zone v_tz)::time) at time zone v_tz;

  select id into v_existing from message_schedules
    where coalesce(recurrence_parent_id, id) = v_root and scheduled_at = v_next and status <> 'cancelled'
    limit 1;
  if v_existing is not null then return v_existing; end if;

  insert into message_schedules(
    org_id, channel, body, context, recipient_count, recipients,
    template_id, scheduled_at, status,
    recurrence_mode, recurrence_anchor_day, recurrence_parent_id, created_by
  ) values (
    v.org_id, v.channel, v.body, v.context, v.recipient_count, v.recipients,
    v.template_id, v_next, 'scheduled',
    v.recurrence_mode, v_anchor, v_root, v.created_by
  ) returning id into v_new_id;
  return v_new_id;
end $$;
grant execute on function enqueue_next_message_occurrence(bigint) to service_role;

-- 기존 6-arg 시그니처 드롭: 아래 8-arg(기본값 2개)와 공존 시 6-arg 호출이 모호(function is not unique)해진다.
-- 본문은 아래 재정의가 그대로 보존한다(0032 검증 동일 + 반복 컬럼만 추가).
drop function if exists schedule_messages(text, text, text, jsonb, bigint, timestamptz);

create or replace function schedule_messages(
  p_channel text,
  p_body text,
  p_context text,
  p_recipients jsonb,
  p_template_id bigint,
  p_scheduled_at timestamptz,
  p_recurrence_mode text default null,
  p_recurrence_anchor_day int default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_schedule_id bigint;
  v_count int;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('messaging') then
    raise exception 'forbidden: messaging required';
  end if;
  if p_channel not in ('sms','alimtalk','auto') then
    raise exception 'invalid channel: sms|alimtalk|auto required';
  end if;
  if p_body is null or btrim(p_body) = '' then
    raise exception 'invalid body: nonempty text required';
  end if;
  if p_channel in ('alimtalk','auto') and p_template_id is null then
    raise exception 'invalid template: template required for alimtalk/auto';
  end if;
  if p_recipients is null or jsonb_typeof(p_recipients) <> 'array'
    or jsonb_array_length(p_recipients) = 0 then
    raise exception 'invalid recipients: nonempty JSON array required';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_recipients) r(recipient)
    where nullif(regexp_replace(r.recipient->>'phone', '[^0-9]', '', 'g'), '') is null
  ) then
    raise exception 'invalid recipients: every recipient phone must contain digits';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_recipients) r(recipient)
    where r.recipient->>'channel' = 'alimtalk'
      and not exists (
        select 1
        from occupancies o
        join units u on u.id = o.unit_id
        join buildings b on b.id = u.building_id and b.org_id = v_org
        where o.id = nullif(r.recipient->'ref'->>'occupancyId', '')::bigint
          and o.deleted_at is null
          and coalesce(o.alimtalk_opt_in, false)
      )
  ) then
    raise exception 'invalid recipients: alimtalk consent required';
  end if;
  if p_scheduled_at is null or p_scheduled_at <= now() then
    raise exception 'invalid schedule: future time required';
  end if;
  if p_recurrence_mode is not null and p_recurrence_mode <> 'monthly' then
    raise exception 'invalid recurrence: null|monthly required';
  end if;

  v_count := jsonb_array_length(p_recipients);
  insert into message_schedules(
    org_id, channel, body, context, recipient_count, recipients,
    template_id, scheduled_at, recurrence_mode, recurrence_anchor_day, created_by
  ) values (
    v_org, p_channel, p_body, coalesce(p_context, 'manual'), v_count, p_recipients,
    p_template_id, p_scheduled_at, p_recurrence_mode,
    case
      when p_recurrence_mode is null then null
      else coalesce(
        p_recurrence_anchor_day,
        extract(day from (p_scheduled_at at time zone 'Asia/Seoul'))::int
      )
    end,
    auth.uid()
  ) returning id into v_schedule_id;

  return jsonb_build_object(
    'schedule_id', v_schedule_id,
    'count', v_count,
    'scheduled_at', p_scheduled_at
  );
end $$;
revoke execute on function schedule_messages(text,text,text,jsonb,bigint,timestamptz,text,int) from public, anon;
grant execute on function schedule_messages(text,text,text,jsonb,bigint,timestamptz,text,int) to authenticated;

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
  if p_final = 'sent' then
    perform enqueue_next_message_occurrence(p_schedule_id);
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function complete_message_schedule(bigint, bigint, text) from public, anon, authenticated;
grant execute on function complete_message_schedule(bigint, bigint, text) to service_role;

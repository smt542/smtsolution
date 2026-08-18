-- P4-point 2/2: 메시지 포인트 견적·예약·정산
-- 의존: 0010(message_logs), 0030(message_templates/send_messages),
--       0032(message_schedules), 0036(message_point_rates/원장 RPC)

-- ===== 예약·원장·로그 스키마 =====
create table public.message_point_reservations (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations(id) on delete restrict,
  message_log_id bigint not null unique references public.message_logs(id) on delete restrict,
  idempotency_key uuid not null,
  payload_hash text not null check (length(payload_hash) between 1 and 128),
  status text not null check (
    status in ('reserved', 'settled', 'released', 'reconcile_required')
  ),
  reserved_points integer not null check (reserved_points >= 0),
  charged_points integer not null default 0 check (charged_points >= 0),
  rate_snapshot jsonb not null check (jsonb_typeof(rate_snapshot) = 'object'),
  recipient_costs jsonb not null check (jsonb_typeof(recipient_costs) = 'array'),
  provider_request_id text,
  requested_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, idempotency_key),
  check (charged_points <= reserved_points)
);

create index message_point_reservations_org_status_idx
  on public.message_point_reservations(org_id, status, created_at desc);
create index message_point_reservations_expiry_idx
  on public.message_point_reservations(expires_at)
  where status = 'reserved';

create trigger trg_message_point_reservations_updated
  before update on public.message_point_reservations
  for each row execute function public.set_updated_at();

alter table public.message_point_reservations enable row level security;
create policy message_point_reservations_platform_select
  on public.message_point_reservations
  for select to authenticated
  using (public.current_user_is_platform_admin());
revoke insert, update, delete, truncate on public.message_point_reservations
  from anon, authenticated;

alter table public.point_transactions
  add column message_log_id bigint references public.message_logs(id) on delete restrict,
  add column reservation_id bigint references public.message_point_reservations(id) on delete restrict;

create unique index point_usage_one_per_message_log
  on public.point_transactions(message_log_id)
  where type = 'usage'::public.point_tx_type and message_log_id is not null;

alter table public.message_logs
  add column estimated_points integer not null default 0 check (estimated_points >= 0),
  add column charged_points integer not null default 0 check (charged_points >= 0),
  add column point_status text not null default 'none'
    check (point_status in (
      'none', 'quoted', 'reserved', 'settled', 'released', 'reconcile_required'
    ));

alter table public.message_logs drop constraint if exists message_logs_result_check;
alter table public.message_logs add constraint message_logs_result_check
  check (result in ('stub', 'queued', 'sent', 'partial', 'failed'));

-- ===== 내부 라우팅·견적 함수 =====
create or replace function public.resolve_message_point_quote(
  p_org_id bigint,
  p_mode text,
  p_recipients jsonb,
  p_template_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_original_count integer;
  v_resolved_recipients jsonb;
  v_recipient_costs jsonb;
  v_resolved_count integer;
  v_sms_count integer;
  v_alimtalk_count integer;
  v_estimated_points bigint;
  v_sms_rate_id bigint;
  v_sms_points integer;
  v_alimtalk_rate_id bigint;
  v_alimtalk_points integer;
begin
  if p_mode not in ('sms', 'alimtalk', 'auto') then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_MODE',
      'message', '발송 모드는 SMS, 알림톡, 자동 중 하나여야 합니다.'
    );
  end if;
  if p_recipients is null or jsonb_typeof(p_recipients) <> 'array'
    or jsonb_array_length(p_recipients) = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_RECIPIENTS',
      'message', '수신처가 한 명 이상 필요합니다.'
    );
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_recipients) recipient(value)
    where jsonb_typeof(recipient.value) <> 'object'
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_RECIPIENTS',
      'message', '수신처 형식이 올바르지 않습니다.'
    );
  end if;
  if p_mode in ('alimtalk', 'auto') and p_template_id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'TEMPLATE_REQUIRED',
      'message', '알림톡 또는 자동 모드는 템플릿이 필요합니다.'
    );
  end if;
  if p_template_id is not null and not exists (
    select 1
    from public.message_templates template
    where template.id = p_template_id
      and template.org_id = p_org_id
      and template.deleted_at is null
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'TEMPLATE_NOT_FOUND',
      'message', '사용 가능한 템플릿을 찾지 못했습니다.'
    );
  end if;

  -- 숫자가 아닌 참조 ID나 다른 조직의 참조를 명시적으로 거부한다.
  if exists (
    select 1
    from jsonb_array_elements(p_recipients) recipient(value)
    where nullif(recipient.value->'ref'->>'occupancyId', '') is not null
      and recipient.value->'ref'->>'occupancyId' !~ '^[0-9]+$'
  ) or exists (
    select 1
    from jsonb_array_elements(p_recipients) recipient(value)
    where nullif(recipient.value->'ref'->>'occupancyId', '') is not null
      and not exists (
        select 1
        from public.occupancies occupancy
        join public.units unit on unit.id = occupancy.unit_id
        join public.buildings building
          on building.id = unit.building_id and building.org_id = p_org_id
        where occupancy.id = case
          when recipient.value->'ref'->>'occupancyId' ~ '^[0-9]+$'
            then (recipient.value->'ref'->>'occupancyId')::bigint
          else null
        end
          and occupancy.deleted_at is null
          and unit.deleted_at is null
      )
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'RECIPIENT_OUTSIDE_ORG',
      'message', '다른 조직이거나 존재하지 않는 세대 수신처가 포함되어 있습니다.'
    );
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_recipients) recipient(value)
    where recipient.value->>'kind' = 'owner'
      and (
        nullif(recipient.value->'ref'->>'buildingId', '') is null
        or recipient.value->'ref'->>'buildingId' !~ '^[0-9]+$'
        or not exists (
          select 1
          from public.buildings building
          where building.id = case
            when recipient.value->'ref'->>'buildingId' ~ '^[0-9]+$'
              then (recipient.value->'ref'->>'buildingId')::bigint
            else null
          end
            and building.org_id = p_org_id
            and building.deleted_at is null
        )
      )
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'RECIPIENT_OUTSIDE_ORG',
      'message', '다른 조직이거나 존재하지 않는 건물주 수신처가 포함되어 있습니다.'
    );
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_recipients) recipient(value)
    where recipient.value->>'kind' = 'staff'
      and (
        nullif(recipient.value->'ref'->>'userId', '') is null
        or not exists (
          select 1
          from public.org_members member
          join public.profiles profile on profile.user_id = member.user_id
          where member.org_id = p_org_id
            and member.user_id::text = recipient.value->'ref'->>'userId'
            and profile.is_active
        )
      )
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'RECIPIENT_OUTSIDE_ORG',
      'message', '다른 조직이거나 비활성인 직원 수신처가 포함되어 있습니다.'
    );
  end if;

  select rate.id, rate.points
    into v_sms_rate_id, v_sms_points
  from public.message_point_rates rate
  where rate.channel = 'sms' and rate.effective_to is null;

  select rate.id, rate.points
    into v_alimtalk_rate_id, v_alimtalk_points
  from public.message_point_rates rate
  where rate.channel = 'alimtalk' and rate.effective_to is null;

  if v_sms_rate_id is null or v_alimtalk_rate_id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'RATE_NOT_CONFIGURED',
      'message', '활성 메시지 단가가 설정되지 않았습니다.'
    );
  end if;

  v_original_count := jsonb_array_length(p_recipients);

  with raw as (
    select
      recipient.value,
      recipient.ordinality,
      regexp_replace(coalesce(recipient.value->>'phone', ''), '[^0-9]', '', 'g')
        as normalized_phone
    from jsonb_array_elements(p_recipients)
      with ordinality as recipient(value, ordinality)
  ),
  deduplicated as (
    select raw.*
    from (
      select
        raw.*,
        row_number() over (
          partition by raw.normalized_phone order by raw.ordinality
        ) as duplicate_rank
      from raw
      where raw.normalized_phone <> ''
    ) raw
    where raw.duplicate_rank = 1
  ),
  routed as (
    select
      deduplicated.value,
      deduplicated.ordinality,
      deduplicated.normalized_phone,
      case
        when p_mode = 'sms' then 'sms'
        when deduplicated.value->>'kind' in ('owner', 'staff', 'vendor', 'etc')
          then 'sms'
        when coalesce((
          select occupancy.alimtalk_opt_in
          from public.occupancies occupancy
          join public.units unit on unit.id = occupancy.unit_id
          join public.buildings building
            on building.id = unit.building_id and building.org_id = p_org_id
          where occupancy.id = case
            when deduplicated.value->'ref'->>'occupancyId' ~ '^[0-9]+$'
              then (deduplicated.value->'ref'->>'occupancyId')::bigint
            else null
          end
            and occupancy.deleted_at is null
        ), false) then 'alimtalk'
        when p_mode = 'alimtalk' then null
        else 'sms'
      end as resolved_channel
    from deduplicated
  ),
  priced as (
    select
      routed.*,
      case when routed.resolved_channel = 'sms'
        then v_sms_rate_id else v_alimtalk_rate_id end as rate_id,
      case when routed.resolved_channel = 'sms'
        then v_sms_points else v_alimtalk_points end as recipient_points,
      encode(
        extensions.digest(routed.normalized_phone, 'sha256'),
        'hex'
      ) as recipient_key
    from routed
    where routed.resolved_channel is not null
  )
  select
    coalesce(
      jsonb_agg(
        priced.value || jsonb_build_object('channel', priced.resolved_channel)
        order by priced.ordinality
      ),
      '[]'::jsonb
    ),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'recipient_key', priced.recipient_key,
          'phone_hash', priced.recipient_key,
          'ref', coalesce(priced.value->'ref', '{}'::jsonb),
          'channel', priced.resolved_channel,
          'rate_id', priced.rate_id,
          'points', priced.recipient_points
        ) order by priced.ordinality
      ),
      '[]'::jsonb
    ),
    count(*)::integer,
    count(*) filter (where priced.resolved_channel = 'sms')::integer,
    count(*) filter (where priced.resolved_channel = 'alimtalk')::integer,
    coalesce(sum(priced.recipient_points), 0)::bigint
  into
    v_resolved_recipients,
    v_recipient_costs,
    v_resolved_count,
    v_sms_count,
    v_alimtalk_count,
    v_estimated_points
  from priced;

  if v_resolved_count = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'NO_ELIGIBLE_RECIPIENTS',
      'message', '발송 가능한 수신처가 없습니다.',
      'excluded_count', v_original_count
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'resolved_recipients', v_resolved_recipients,
    'recipient_costs', v_recipient_costs,
    'excluded_count', v_original_count - v_resolved_count,
    'counts', jsonb_build_object(
      'total', v_resolved_count,
      'sms', v_sms_count,
      'alimtalk', v_alimtalk_count
    ),
    'rate_ids', jsonb_build_object(
      'sms', v_sms_rate_id,
      'alimtalk', v_alimtalk_rate_id
    ),
    'rate_snapshot', jsonb_build_object(
      'sms', jsonb_build_object('id', v_sms_rate_id, 'points', v_sms_points),
      'alimtalk', jsonb_build_object(
        'id', v_alimtalk_rate_id,
        'points', v_alimtalk_points
      )
    ),
    'estimated_points', v_estimated_points
  );
end
$$;

revoke all on function public.resolve_message_point_quote(bigint, text, jsonb, bigint)
  from public, anon, authenticated;

-- ===== 사용자 견적·stub 발송 =====
create or replace function public.quote_message_points(
  p_mode text,
  p_recipients jsonb,
  p_template_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org_id bigint;
  v_quote jsonb;
  v_ledger_balance bigint;
  v_reserved_points bigint;
  v_available_points bigint;
begin
  v_org_id := public.current_user_org();
  if v_org_id is null then
    raise exception 'no org for caller' using errcode = '42501';
  end if;
  if not public.current_user_has_module('messaging') then
    raise exception 'forbidden: messaging required' using errcode = '42501';
  end if;

  v_quote := public.resolve_message_point_quote(
    v_org_id, p_mode, p_recipients, p_template_id
  );
  if not coalesce((v_quote->>'ok')::boolean, false) then
    return v_quote || jsonb_build_object('billing_mode', 'stub');
  end if;

  select coalesce(sum(point_transaction.points), 0)::bigint
    into v_ledger_balance
  from public.point_transactions point_transaction
  where point_transaction.org_id = v_org_id;

  select coalesce(sum(reservation.reserved_points), 0)::bigint
    into v_reserved_points
  from public.message_point_reservations reservation
  where reservation.org_id = v_org_id
    and reservation.status in ('reserved', 'reconcile_required');

  v_available_points := v_ledger_balance - v_reserved_points;

  return v_quote || jsonb_build_object(
    'billing_mode', 'stub',
    'ledger_balance', v_ledger_balance,
    'reserved_points', v_reserved_points,
    'available_points', v_available_points,
    'sufficient', v_available_points >= (v_quote->>'estimated_points')::bigint
  );
end
$$;

revoke all on function public.quote_message_points(text, jsonb, bigint)
  from public, anon;
grant execute on function public.quote_message_points(text, jsonb, bigint)
  to authenticated;

create or replace function public.send_messages(
  p_channel text,
  p_body text,
  p_context text,
  p_recipients jsonb,
  p_template_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id bigint;
  v_quote jsonb;
  v_log_recipients jsonb;
  v_log_id bigint;
  v_count integer;
begin
  v_org_id := public.current_user_org();
  if v_org_id is null then
    raise exception 'no org for caller' using errcode = '42501';
  end if;
  if not public.current_user_has_module('messaging') then
    raise exception 'forbidden: messaging required' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_body, '')), '') is null then
    raise exception 'invalid body: nonempty text required' using errcode = '22023';
  end if;

  v_quote := public.resolve_message_point_quote(
    v_org_id, p_channel, p_recipients, p_template_id
  );
  if not coalesce((v_quote->>'ok')::boolean, false) then
    raise exception '%', coalesce(v_quote->>'message', 'message quote failed')
      using errcode = 'P0001', detail = v_quote->>'code';
  end if;

  select coalesce(
    jsonb_agg(
      recipient.value || jsonb_build_object('result', 'stub')
      order by recipient.ordinality
    ),
    '[]'::jsonb
  )
  into v_log_recipients
  from jsonb_array_elements(v_quote->'resolved_recipients')
    with ordinality as recipient(value, ordinality);

  v_count := (v_quote->'counts'->>'total')::integer;

  insert into public.message_logs(
    org_id,
    channel,
    body,
    context,
    recipient_count,
    recipients,
    result,
    sent_by,
    template_id,
    estimated_points,
    charged_points,
    point_status
  ) values (
    v_org_id,
    p_channel,
    p_body,
    coalesce(p_context, 'manual'),
    v_count,
    v_log_recipients,
    'stub',
    (select auth.uid()),
    p_template_id,
    (v_quote->>'estimated_points')::integer,
    0,
    'quoted'
  ) returning id into v_log_id;

  return jsonb_build_object(
    'log_id', v_log_id,
    'count', v_count,
    'recipients', v_log_recipients,
    'estimated_points', (v_quote->>'estimated_points')::integer,
    'billing_mode', 'stub'
  );
end
$$;

revoke all on function public.send_messages(text, text, text, jsonb, bigint)
  from public, anon;
grant execute on function public.send_messages(text, text, text, jsonb, bigint)
  to authenticated;

-- ===== provider 서버 전용 예약 =====
create or replace function public.reserve_message_points(
  p_org_id bigint,
  p_requested_by uuid,
  p_idempotency_key uuid,
  p_payload_hash text,
  p_mode text,
  p_body text,
  p_context text,
  p_recipients jsonb,
  p_template_id bigint,
  p_confirmed_rate_ids jsonb,
  p_confirmed_points integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote jsonb;
  v_existing public.message_point_reservations%rowtype;
  v_ledger_balance bigint;
  v_reserved_points bigint;
  v_available_points bigint;
  v_log_id bigint;
  v_reservation_id bigint;
  v_log_recipients jsonb;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;
  if p_idempotency_key is null
    or nullif(btrim(coalesce(p_payload_hash, '')), '') is null
    or length(p_payload_hash) > 128 then
    raise exception 'invalid idempotency data' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_body, '')), '') is null then
    raise exception 'invalid body: nonempty text required' using errcode = '22023';
  end if;

  perform 1
  from public.organizations organization
  where organization.id = p_org_id and organization.status = 'active'
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'ORG_NOT_ACTIVE');
  end if;

  if not exists (
    select 1
    from public.org_members member
    join public.profiles profile on profile.user_id = member.user_id
    where member.org_id = p_org_id
      and member.user_id = p_requested_by
      and profile.is_active
      and (
        member.role in ('org_owner', 'platform_admin')
        or member.feature_permissions ? 'messaging'
      )
  ) then
    return jsonb_build_object('ok', false, 'code', 'REQUESTER_FORBIDDEN');
  end if;

  select reservation.*
    into v_existing
  from public.message_point_reservations reservation
  where reservation.org_id = p_org_id
    and reservation.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.payload_hash <> p_payload_hash then
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'reservation_id', v_existing.id,
      'message_log_id', v_existing.message_log_id,
      'status', v_existing.status,
      'reserved_points', v_existing.reserved_points,
      'charged_points', v_existing.charged_points
    );
  end if;

  v_quote := public.resolve_message_point_quote(
    p_org_id, p_mode, p_recipients, p_template_id
  );
  if not coalesce((v_quote->>'ok')::boolean, false) then
    return v_quote;
  end if;

  if p_confirmed_points is distinct from (v_quote->>'estimated_points')::integer
    or coalesce(p_confirmed_rate_ids, '{}'::jsonb)
      is distinct from v_quote->'rate_ids' then
    return jsonb_build_object(
      'ok', false,
      'code', 'QUOTE_CHANGED',
      'quote', v_quote
    );
  end if;

  select coalesce(sum(point_transaction.points), 0)::bigint
    into v_ledger_balance
  from public.point_transactions point_transaction
  where point_transaction.org_id = p_org_id;

  select coalesce(sum(reservation.reserved_points), 0)::bigint
    into v_reserved_points
  from public.message_point_reservations reservation
  where reservation.org_id = p_org_id
    and reservation.status in ('reserved', 'reconcile_required');

  v_available_points := v_ledger_balance - v_reserved_points;
  if v_available_points < (v_quote->>'estimated_points')::bigint then
    return jsonb_build_object(
      'ok', false,
      'code', 'INSUFFICIENT_POINTS',
      'ledger_balance', v_ledger_balance,
      'reserved_points', v_reserved_points,
      'available_points', v_available_points,
      'required_points', (v_quote->>'estimated_points')::bigint
    );
  end if;

  select coalesce(
    jsonb_agg(
      recipient.value || jsonb_build_object('result', 'queued')
      order by recipient.ordinality
    ),
    '[]'::jsonb
  )
  into v_log_recipients
  from jsonb_array_elements(v_quote->'resolved_recipients')
    with ordinality as recipient(value, ordinality);

  insert into public.message_logs(
    org_id,
    channel,
    body,
    context,
    recipient_count,
    recipients,
    result,
    sent_by,
    template_id,
    estimated_points,
    charged_points,
    point_status
  ) values (
    p_org_id,
    p_mode,
    p_body,
    coalesce(p_context, 'manual'),
    (v_quote->'counts'->>'total')::integer,
    v_log_recipients,
    'queued',
    p_requested_by,
    p_template_id,
    (v_quote->>'estimated_points')::integer,
    0,
    'reserved'
  ) returning id into v_log_id;

  insert into public.message_point_reservations(
    org_id,
    message_log_id,
    idempotency_key,
    payload_hash,
    status,
    reserved_points,
    charged_points,
    rate_snapshot,
    recipient_costs,
    requested_by,
    expires_at
  ) values (
    p_org_id,
    v_log_id,
    p_idempotency_key,
    p_payload_hash,
    'reserved',
    (v_quote->>'estimated_points')::integer,
    0,
    v_quote->'rate_snapshot',
    v_quote->'recipient_costs',
    p_requested_by,
    now() + interval '15 minutes'
  ) returning id into v_reservation_id;

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'reservation_id', v_reservation_id,
    'message_log_id', v_log_id,
    'status', 'reserved',
    'reserved_points', (v_quote->>'estimated_points')::integer
  );
end
$$;

revoke all on function public.reserve_message_points(
  bigint, uuid, uuid, text, text, text, text, jsonb, bigint, jsonb, integer
) from public, anon, authenticated;
grant execute on function public.reserve_message_points(
  bigint, uuid, uuid, text, text, text, text, jsonb, bigint, jsonb, integer
) to service_role;

-- ===== provider 서버 전용 정산 =====
create or replace function public.settle_message_points(
  p_reservation_id bigint,
  p_provider_request_id text,
  p_results jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id bigint;
  v_reservation public.message_point_reservations%rowtype;
  v_expected_count integer;
  v_result_count integer;
  v_success_count integer;
  v_charged_points integer;
  v_sms_success integer;
  v_alimtalk_success integer;
  v_log_result text;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;

  select reservation.org_id into v_org_id
  from public.message_point_reservations reservation
  where reservation.id = p_reservation_id;
  if v_org_id is null then
    return jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND');
  end if;

  perform 1
  from public.organizations organization
  where organization.id = v_org_id
  for update;

  select reservation.* into v_reservation
  from public.message_point_reservations reservation
  where reservation.id = p_reservation_id
  for update;

  if v_reservation.status in ('settled', 'released') then
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'reservation_id', v_reservation.id,
      'message_log_id', v_reservation.message_log_id,
      'status', v_reservation.status,
      'charged_points', v_reservation.charged_points
    );
  end if;

  if p_results is null or jsonb_typeof(p_results) <> 'array' then
    update public.message_point_reservations
      set status = 'reconcile_required',
          provider_request_id = nullif(btrim(coalesce(p_provider_request_id, '')), '')
      where id = p_reservation_id;
    update public.message_logs
      set point_status = 'reconcile_required'
      where id = v_reservation.message_log_id;
    return jsonb_build_object(
      'ok', true,
      'status', 'reconcile_required',
      'charged_points', 0
    );
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_results) result(value)
    where jsonb_typeof(result.value) <> 'object'
      or nullif(result.value->>'recipient_key', '') is null
  ) then
    raise exception 'invalid provider results' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_results) result(value)
    where not exists (
      select 1
      from jsonb_array_elements(v_reservation.recipient_costs) cost(value)
      where cost.value->>'recipient_key' = result.value->>'recipient_key'
    )
  ) then
    raise exception 'provider result contains unknown recipient key'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_results) result(value)
    group by result.value->>'recipient_key'
    having count(*) > 1
  ) then
    raise exception 'provider result contains duplicate recipient key'
      using errcode = '22023';
  end if;

  v_expected_count := jsonb_array_length(v_reservation.recipient_costs);
  v_result_count := jsonb_array_length(p_results);

  if v_result_count <> v_expected_count or exists (
    select 1
    from jsonb_array_elements(p_results) result(value)
    where result.value->>'status' not in ('success', 'failed')
  ) then
    update public.message_point_reservations
      set status = 'reconcile_required',
          provider_request_id = nullif(btrim(coalesce(p_provider_request_id, '')), '')
      where id = p_reservation_id;
    update public.message_logs
      set point_status = 'reconcile_required'
      where id = v_reservation.message_log_id;
    return jsonb_build_object(
      'ok', true,
      'status', 'reconcile_required',
      'charged_points', 0
    );
  end if;

  select
    count(*) filter (where result.value->>'status' = 'success')::integer,
    coalesce(sum((cost.value->>'points')::integer)
      filter (where result.value->>'status' = 'success'), 0)::integer,
    count(*) filter (
      where result.value->>'status' = 'success'
        and cost.value->>'channel' = 'sms'
    )::integer,
    count(*) filter (
      where result.value->>'status' = 'success'
        and cost.value->>'channel' = 'alimtalk'
    )::integer
  into v_success_count, v_charged_points, v_sms_success, v_alimtalk_success
  from jsonb_array_elements(v_reservation.recipient_costs) cost(value)
  join jsonb_array_elements(p_results) result(value)
    on result.value->>'recipient_key' = cost.value->>'recipient_key';

  if v_success_count = 0 then
    update public.message_point_reservations
      set status = 'released',
          charged_points = 0,
          provider_request_id = nullif(btrim(coalesce(p_provider_request_id, '')), ''),
          settled_at = now()
      where id = p_reservation_id;
    update public.message_logs
      set result = 'failed', charged_points = 0, point_status = 'released'
      where id = v_reservation.message_log_id;
    return jsonb_build_object(
      'ok', true,
      'replayed', false,
      'status', 'released',
      'charged_points', 0
    );
  end if;

  insert into public.point_transactions(
    org_id,
    type,
    points,
    amount_krw,
    memo,
    created_by,
    message_log_id,
    reservation_id
  ) values (
    v_org_id,
    'usage'::public.point_tx_type,
    -v_charged_points,
    null,
    '메시지 발송 · SMS ' || v_sms_success || ' · 알림톡 ' || v_alimtalk_success,
    v_reservation.requested_by,
    v_reservation.message_log_id,
    v_reservation.id
  );

  v_log_result := case
    when v_success_count = v_expected_count then 'sent'
    else 'partial'
  end;

  update public.message_point_reservations
    set status = 'settled',
        charged_points = v_charged_points,
        provider_request_id = nullif(btrim(coalesce(p_provider_request_id, '')), ''),
        settled_at = now()
    where id = p_reservation_id;

  update public.message_logs
    set result = v_log_result,
        charged_points = v_charged_points,
        point_status = 'settled'
    where id = v_reservation.message_log_id;

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'status', 'settled',
    'result', v_log_result,
    'charged_points', v_charged_points,
    'released_points', v_reservation.reserved_points - v_charged_points
  );
end
$$;

revoke all on function public.settle_message_points(bigint, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.settle_message_points(bigint, text, jsonb)
  to service_role;

-- ===== 플랫폼 잔액·운영 RPC =====
create or replace function public.platform_list_point_balances()
returns table (
  org_id bigint,
  ledger_balance bigint,
  reserved_points bigint,
  available_points bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;

  return query
  with ledger as (
    select
      point_transaction.org_id,
      coalesce(sum(point_transaction.points), 0)::bigint as balance
    from public.point_transactions point_transaction
    group by point_transaction.org_id
  ),
  active_reservations as (
    select
      reservation.org_id,
      coalesce(sum(reservation.reserved_points), 0)::bigint as reserved
    from public.message_point_reservations reservation
    where reservation.status in ('reserved', 'reconcile_required')
    group by reservation.org_id
  )
  select
    organization.id,
    coalesce(ledger.balance, 0)::bigint,
    coalesce(active_reservations.reserved, 0)::bigint,
    (
      coalesce(ledger.balance, 0) - coalesce(active_reservations.reserved, 0)
    )::bigint
  from public.organizations organization
  left join ledger on ledger.org_id = organization.id
  left join active_reservations on active_reservations.org_id = organization.id
  order by organization.id;
end
$$;

create or replace function public.platform_record_point_adjustment(
  p_org_id bigint,
  p_kind text,
  p_points integer,
  p_amount_krw integer default null,
  p_memo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction_id bigint;
  v_ledger_balance bigint;
  v_reserved_points bigint;
  v_after_balance bigint;
  v_label text;
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if p_kind not in ('correction', 'deduction', 'refund') then
    raise exception 'invalid adjustment kind' using errcode = '22023';
  end if;
  if p_points is null or p_points = 0 then
    raise exception 'invalid points: nonzero integer required' using errcode = '22023';
  end if;
  if p_kind in ('deduction', 'refund') and p_points >= 0 then
    raise exception 'invalid points: deduction/refund must be negative' using errcode = '22023';
  end if;
  if p_amount_krw is not null and p_amount_krw < 0 then
    raise exception 'invalid amount: zero or positive integer required' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_memo, '')), '') is null
    or length(btrim(p_memo)) > 200 then
    raise exception 'invalid memo: 1-200 characters required' using errcode = '22023';
  end if;

  perform 1
  from public.organizations organization
  where organization.id = p_org_id
  for update;
  if not found then
    raise exception 'organization not found' using errcode = 'P0002';
  end if;

  select coalesce(sum(point_transaction.points), 0)::bigint
    into v_ledger_balance
  from public.point_transactions point_transaction
  where point_transaction.org_id = p_org_id;

  select coalesce(sum(reservation.reserved_points), 0)::bigint
    into v_reserved_points
  from public.message_point_reservations reservation
  where reservation.org_id = p_org_id
    and reservation.status in ('reserved', 'reconcile_required');

  v_after_balance := v_ledger_balance + p_points;
  if p_points < 0 and v_after_balance < v_reserved_points then
    return jsonb_build_object(
      'ok', false,
      'code', case
        when v_reserved_points > 0 then 'POINTS_RESERVED'
        else 'INSUFFICIENT_POINTS'
      end,
      'ledger_balance', v_ledger_balance,
      'reserved_points', v_reserved_points
    );
  end if;

  v_label := case p_kind
    when 'correction' then '정정'
    when 'deduction' then '차감'
    when 'refund' then '환불'
  end;

  insert into public.point_transactions(
    org_id, type, points, amount_krw, memo, created_by
  ) values (
    p_org_id,
    'adjustment'::public.point_tx_type,
    p_points,
    case when p_kind = 'refund' then p_amount_krw else null end,
    '[' || v_label || '] ' || btrim(p_memo),
    (select auth.uid())
  ) returning id into v_transaction_id;

  return jsonb_build_object('ok', true, 'transaction_id', v_transaction_id);
end
$$;

create or replace function public.platform_list_point_reservations(
  p_status text default null
)
returns table (
  id bigint,
  org_id bigint,
  organization_name text,
  message_log_id bigint,
  status text,
  reserved_points integer,
  charged_points integer,
  age_seconds bigint,
  is_releasable boolean,
  expires_at timestamptz,
  created_at timestamptz,
  requested_by uuid,
  requested_by_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in (
    'reserved', 'settled', 'released', 'reconcile_required'
  ) then
    raise exception 'invalid reservation status' using errcode = '22023';
  end if;

  return query
  select
    reservation.id,
    reservation.org_id,
    organization.name,
    reservation.message_log_id,
    reservation.status,
    reservation.reserved_points,
    reservation.charged_points,
    greatest(
      0,
      extract(epoch from (now() - reservation.created_at))::bigint
    ),
    reservation.status = 'reconcile_required'
      or (reservation.status = 'reserved' and reservation.expires_at <= now()),
    reservation.expires_at,
    reservation.created_at,
    reservation.requested_by,
    profile.full_name
  from public.message_point_reservations reservation
  join public.organizations organization on organization.id = reservation.org_id
  left join public.profiles profile on profile.user_id = reservation.requested_by
  where p_status is null or reservation.status = p_status
  order by reservation.created_at desc, reservation.id desc;
end
$$;

revoke all on function public.platform_list_point_reservations(text)
  from public, anon;
grant execute on function public.platform_list_point_reservations(text)
  to authenticated;

create or replace function public.platform_release_stale_reservation(
  p_id bigint,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id bigint;
  v_reservation public.message_point_reservations%rowtype;
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null
    or length(btrim(p_reason)) > 500 then
    raise exception 'invalid reason: 1-500 characters required' using errcode = '22023';
  end if;

  select reservation.org_id into v_org_id
  from public.message_point_reservations reservation
  where reservation.id = p_id;
  if v_org_id is null then
    return jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND');
  end if;

  perform 1
  from public.organizations organization
  where organization.id = v_org_id
  for update;

  select reservation.* into v_reservation
  from public.message_point_reservations reservation
  where reservation.id = p_id
  for update;

  if v_reservation.status not in ('reserved', 'reconcile_required') then
    return jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_ACTIVE');
  end if;
  if v_reservation.status = 'reserved' and v_reservation.expires_at > now() then
    return jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_STALE');
  end if;
  if exists (
    select 1
    from public.point_transactions point_transaction
    where point_transaction.reservation_id = p_id
      and point_transaction.type = 'usage'::public.point_tx_type
  ) then
    return jsonb_build_object('ok', false, 'code', 'USAGE_ALREADY_RECORDED');
  end if;

  update public.message_point_reservations
    set status = 'released', settled_at = now()
    where id = p_id;
  update public.message_logs
    set result = 'failed', point_status = 'released', charged_points = 0
    where id = v_reservation.message_log_id;

  insert into public.audit_log(
    org_id, actor_id, action, table_name, row_pk, before, after
  ) values (
    v_org_id,
    (select auth.uid()),
    'MESSAGE_POINT_RESERVATION_RELEASE',
    'message_point_reservations',
    p_id::text,
    jsonb_build_object('status', v_reservation.status),
    jsonb_build_object('status', 'released', 'reason', btrim(p_reason))
  );

  return jsonb_build_object(
    'ok', true,
    'reservation_id', p_id,
    'status', 'released'
  );
end
$$;

revoke all on function public.platform_release_stale_reservation(bigint, text)
  from public, anon;
grant execute on function public.platform_release_stale_reservation(bigint, text)
  to authenticated;

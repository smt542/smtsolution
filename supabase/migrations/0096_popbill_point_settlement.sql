-- Popbill 전환 2/3: LMS 견적 + provider_pending 예약 + 결과 기반 정산
-- 의존: 0036(message_point_rates), 0037(예약/견적/정산), 0094(예약 발송 worker),
--       0095(provider_dispatch_jobs/recipients)
--
-- 핵심 변경
--  1) 문자 제품을 Popbill 바이트 규칙으로 sms/lms로 나누고, 세 제품(sms/lms/alimtalk) 단가를 지원한다.
--  2) 접수(receipt) 시 예약을 provider_pending으로 두어 가용 포인트에서 계속 제외한다.
--  3) 최종 결과(provider_dispatch_recipients)를 원천으로 성공분만 멱등 정산한다.
--  4) provider 접수/미확인 예약은 관리자 수동 만료 해제 후보에서 제외한다.

-- ===== Popbill 바이트 판정(TS lib/messaging/product.ts와 규칙 일치) =====
create or replace function public.popbill_byte_length(p_text text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum(case when ascii(ch) <= 127 then 1 else 2 end), 0)::integer
  from regexp_split_to_table(coalesce(p_text, ''), '') as ch
  where ch <> '';
$$;
revoke all on function public.popbill_byte_length(text) from public;
grant execute on function public.popbill_byte_length(text) to authenticated, service_role;

-- sms(<=90) / lms(91~2000) / too_long(>2000). 제목이 있으면 lms로 승격.
create or replace function public.classify_message_product(p_body text, p_subject text default null)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when public.popbill_byte_length(coalesce(p_body, '')) > 2000 then 'too_long'
    when public.popbill_byte_length(coalesce(p_body, '')) > 90
      or nullif(btrim(coalesce(p_subject, '')), '') is not null then 'lms'
    else 'sms'
  end;
$$;
revoke all on function public.classify_message_product(text, text) from public;
grant execute on function public.classify_message_product(text, text) to authenticated, service_role;

-- ===== 단가 채널에 lms 추가 =====
alter table public.message_point_rates drop constraint if exists message_point_rates_channel_check;
alter table public.message_point_rates add constraint message_point_rates_channel_check
  check (channel in ('sms', 'lms', 'alimtalk'));
-- 기존 조직에 임의 LMS 단가를 seed하지 않는다. 관리자 설정 전 LMS 견적은 RATE_NOT_CONFIGURED로 실패한다.

-- 단가 변경 RPC에 LMS를 추가한다. p_lms_points가 null이면 LMS 단가는 변경하지 않는다(설정 전 미보유 허용).
drop function if exists public.platform_set_message_point_rates(integer, integer);
create or replace function public.platform_set_message_point_rates(
  p_sms_points integer,
  p_alimtalk_points integer,
  p_lms_points integer default null
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
  v_sms_current integer;
  v_lms_current integer;
  v_alimtalk_current integer;
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

  lock table public.message_point_rates in share row exclusive mode;

  select coalesce(jsonb_object_agg(rate.channel, rate.points), '{}'::jsonb) into v_before
  from public.message_point_rates rate where rate.effective_to is null;

  select rate.points into v_sms_current from public.message_point_rates rate
    where rate.channel = 'sms' and rate.effective_to is null;
  select rate.points into v_lms_current from public.message_point_rates rate
    where rate.channel = 'lms' and rate.effective_to is null;
  select rate.points into v_alimtalk_current from public.message_point_rates rate
    where rate.channel = 'alimtalk' and rate.effective_to is null;

  if v_sms_current is distinct from p_sms_points then
    update public.message_point_rates set effective_to = v_now where channel = 'sms' and effective_to is null;
    insert into public.message_point_rates(channel, points, effective_from, created_by)
      values ('sms', p_sms_points, v_now, (select auth.uid()));
  end if;
  if v_alimtalk_current is distinct from p_alimtalk_points then
    update public.message_point_rates set effective_to = v_now where channel = 'alimtalk' and effective_to is null;
    insert into public.message_point_rates(channel, points, effective_from, created_by)
      values ('alimtalk', p_alimtalk_points, v_now, (select auth.uid()));
  end if;
  if p_lms_points is not null and v_lms_current is distinct from p_lms_points then
    update public.message_point_rates set effective_to = v_now where channel = 'lms' and effective_to is null;
    insert into public.message_point_rates(channel, points, effective_from, created_by)
      values ('lms', p_lms_points, v_now, (select auth.uid()));
  end if;

  select coalesce(jsonb_object_agg(rate.channel, rate.points), '{}'::jsonb) into v_after
  from public.message_point_rates rate where rate.effective_to is null;

  if v_before is distinct from v_after then
    insert into public.audit_log(org_id, actor_id, action, table_name, row_pk, before, after)
    values (null, (select auth.uid()), 'MESSAGE_POINT_RATE_UPDATE', 'message_point_rates', 'global', v_before, v_after);
  end if;

  return jsonb_build_object('ok', true, 'rates', v_after);
end
$$;
revoke all on function public.platform_set_message_point_rates(integer, integer, integer) from public, anon;
grant execute on function public.platform_set_message_point_rates(integer, integer, integer) to authenticated;

-- ===== 예약 상태에 provider_pending 추가 =====
alter table public.message_point_reservations drop constraint if exists message_point_reservations_status_check;
alter table public.message_point_reservations add constraint message_point_reservations_status_check
  check (status in ('reserved', 'provider_pending', 'settled', 'released', 'reconcile_required'));

alter table public.message_logs drop constraint if exists message_logs_point_status_check;
alter table public.message_logs add constraint message_logs_point_status_check
  check (point_status in (
    'none', 'quoted', 'reserved', 'provider_pending', 'settled', 'released', 'reconcile_required'
  ));

-- 예약 발송 스케줄 상태에 partial 추가(성공/실패 혼합 명시). 최종화는 재조회 정산이 담당한다.
alter table public.message_schedules drop constraint if exists message_schedules_status_check;
alter table public.message_schedules add constraint message_schedules_status_check
  check (status in ('scheduled', 'sending', 'cancelled', 'sent', 'partial', 'failed'));

-- ===== 견적 재구성: 제품(sms/lms/alimtalk) 차원 + 최종 본문 바이트 판정 =====
drop function if exists public.resolve_message_point_quote(bigint, text, jsonb, bigint);
create or replace function public.resolve_message_point_quote(
  p_org_id bigint,
  p_mode text,
  p_recipients jsonb,
  p_template_id bigint default null,
  p_body text default null
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
  v_lms_count integer;
  v_alimtalk_count integer;
  v_estimated_points bigint;
  v_text_product text;
  v_sms_rate_id bigint;   v_sms_points integer;
  v_lms_rate_id bigint;   v_lms_points integer;
  v_alimtalk_rate_id bigint; v_alimtalk_points integer;
begin
  if p_mode not in ('sms', 'alimtalk', 'auto') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MODE',
      'message', '발송 모드는 SMS, 알림톡, 자동 중 하나여야 합니다.');
  end if;
  if p_recipients is null or jsonb_typeof(p_recipients) <> 'array'
    or jsonb_array_length(p_recipients) = 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_RECIPIENTS',
      'message', '수신처가 한 명 이상 필요합니다.');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_recipients) recipient(value)
    where jsonb_typeof(recipient.value) <> 'object'
  ) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_RECIPIENTS',
      'message', '수신처 형식이 올바르지 않습니다.');
  end if;
  if p_mode in ('alimtalk', 'auto') and p_template_id is null then
    return jsonb_build_object('ok', false, 'code', 'TEMPLATE_REQUIRED',
      'message', '알림톡 또는 자동 모드는 템플릿이 필요합니다.');
  end if;
  if p_template_id is not null and not exists (
    select 1 from public.message_templates template
    where template.id = p_template_id and template.org_id = p_org_id
      and template.deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'TEMPLATE_NOT_FOUND',
      'message', '사용 가능한 템플릿을 찾지 못했습니다.');
  end if;

  -- 세대/건물주/직원 참조가 조직 소속인지 검증(0037과 동일 규칙)
  if exists (
    select 1 from jsonb_array_elements(p_recipients) recipient(value)
    where nullif(recipient.value->'ref'->>'occupancyId', '') is not null
      and recipient.value->'ref'->>'occupancyId' !~ '^[0-9]+$'
  ) or exists (
    select 1 from jsonb_array_elements(p_recipients) recipient(value)
    where nullif(recipient.value->'ref'->>'occupancyId', '') is not null
      and not exists (
        select 1 from public.occupancies occupancy
        join public.units unit on unit.id = occupancy.unit_id
        join public.buildings building on building.id = unit.building_id and building.org_id = p_org_id
        where occupancy.id = case
          when recipient.value->'ref'->>'occupancyId' ~ '^[0-9]+$'
            then (recipient.value->'ref'->>'occupancyId')::bigint else null end
          and occupancy.deleted_at is null and unit.deleted_at is null
      )
  ) then
    return jsonb_build_object('ok', false, 'code', 'RECIPIENT_OUTSIDE_ORG',
      'message', '다른 조직이거나 존재하지 않는 세대 수신처가 포함되어 있습니다.');
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_recipients) recipient(value)
    where recipient.value->>'kind' = 'owner'
      and (
        nullif(recipient.value->'ref'->>'buildingId', '') is null
        or recipient.value->'ref'->>'buildingId' !~ '^[0-9]+$'
        or not exists (
          select 1 from public.buildings building
          where building.id = case
            when recipient.value->'ref'->>'buildingId' ~ '^[0-9]+$'
              then (recipient.value->'ref'->>'buildingId')::bigint else null end
            and building.org_id = p_org_id and building.deleted_at is null
        )
      )
  ) then
    return jsonb_build_object('ok', false, 'code', 'RECIPIENT_OUTSIDE_ORG',
      'message', '다른 조직이거나 존재하지 않는 건물주 수신처가 포함되어 있습니다.');
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_recipients) recipient(value)
    where recipient.value->>'kind' = 'staff'
      and (
        nullif(recipient.value->'ref'->>'userId', '') is null
        or not exists (
          select 1 from public.org_members member
          join public.profiles profile on profile.user_id = member.user_id
          where member.org_id = p_org_id
            and member.user_id::text = recipient.value->'ref'->>'userId'
            and profile.is_active
        )
      )
  ) then
    return jsonb_build_object('ok', false, 'code', 'RECIPIENT_OUTSIDE_ORG',
      'message', '다른 조직이거나 비활성인 직원 수신처가 포함되어 있습니다.');
  end if;

  -- 최종 본문으로 문자 제품(sms/lms) 판정. 2000바이트 초과는 접수 전 거절.
  v_text_product := public.classify_message_product(p_body);
  if v_text_product = 'too_long' then
    return jsonb_build_object('ok', false, 'code', 'MESSAGE_TOO_LONG',
      'message', '본문이 2,000바이트를 초과했습니다. 내용을 줄여 주세요.');
  end if;

  select rate.id, rate.points into v_sms_rate_id, v_sms_points
  from public.message_point_rates rate where rate.channel = 'sms' and rate.effective_to is null;
  select rate.id, rate.points into v_lms_rate_id, v_lms_points
  from public.message_point_rates rate where rate.channel = 'lms' and rate.effective_to is null;
  select rate.id, rate.points into v_alimtalk_rate_id, v_alimtalk_points
  from public.message_point_rates rate where rate.channel = 'alimtalk' and rate.effective_to is null;

  v_original_count := jsonb_array_length(p_recipients);

  with raw as (
    select recipient.value, recipient.ordinality,
      regexp_replace(coalesce(recipient.value->>'phone', ''), '[^0-9]', '', 'g') as normalized_phone
    from jsonb_array_elements(p_recipients) with ordinality as recipient(value, ordinality)
  ),
  deduplicated as (
    select raw.* from (
      select raw.*,
        row_number() over (partition by raw.normalized_phone order by raw.ordinality) as duplicate_rank
      from raw where raw.normalized_phone <> ''
    ) raw where raw.duplicate_rank = 1
  ),
  routed as (
    select deduplicated.value, deduplicated.ordinality, deduplicated.normalized_phone,
      case
        when p_mode = 'sms' then 'sms'
        when deduplicated.value->>'kind' in ('owner', 'staff', 'vendor', 'etc') then 'sms'
        when coalesce((
          select occupancy.alimtalk_opt_in
          from public.occupancies occupancy
          join public.units unit on unit.id = occupancy.unit_id
          join public.buildings building on building.id = unit.building_id and building.org_id = p_org_id
          where occupancy.id = case
            when deduplicated.value->'ref'->>'occupancyId' ~ '^[0-9]+$'
              then (deduplicated.value->'ref'->>'occupancyId')::bigint else null end
            and occupancy.deleted_at is null
        ), false) then 'alimtalk'
        when p_mode = 'alimtalk' then null
        else 'sms'
      end as resolved_channel
    from deduplicated
  ),
  producted as (
    select routed.*,
      case when routed.resolved_channel = 'alimtalk' then 'alimtalk'
           when routed.resolved_channel = 'sms' then v_text_product
           else null end as product
    from routed
  ),
  priced as (
    select producted.*,
      case producted.product
        when 'sms' then v_sms_rate_id
        when 'lms' then v_lms_rate_id
        when 'alimtalk' then v_alimtalk_rate_id
      end as rate_id,
      case producted.product
        when 'sms' then v_sms_points
        when 'lms' then v_lms_points
        when 'alimtalk' then v_alimtalk_points
      end as recipient_points,
      encode(extensions.digest(producted.normalized_phone, 'sha256'), 'hex') as recipient_key
    from producted
    where producted.resolved_channel is not null
  )
  select
    coalesce(jsonb_agg(
      priced.value || jsonb_build_object('channel', priced.resolved_channel, 'product', priced.product)
      order by priced.ordinality), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
      'recipient_key', priced.recipient_key,
      'phone_hash', priced.recipient_key,
      'ref', coalesce(priced.value->'ref', '{}'::jsonb),
      'channel', priced.resolved_channel,
      'product', priced.product,
      'rate_id', priced.rate_id,
      'points', priced.recipient_points
    ) order by priced.ordinality), '[]'::jsonb),
    count(*)::integer,
    count(*) filter (where priced.product = 'sms')::integer,
    count(*) filter (where priced.product = 'lms')::integer,
    count(*) filter (where priced.product = 'alimtalk')::integer,
    coalesce(sum(priced.recipient_points), 0)::bigint
  into v_resolved_recipients, v_recipient_costs, v_resolved_count,
       v_sms_count, v_lms_count, v_alimtalk_count, v_estimated_points
  from priced;

  if v_resolved_count = 0 then
    return jsonb_build_object('ok', false, 'code', 'NO_ELIGIBLE_RECIPIENTS',
      'message', '발송 가능한 수신처가 없습니다.', 'excluded_count', v_original_count);
  end if;

  -- 실제 사용되는 제품의 단가가 없으면 명시적으로 실패한다(LMS 미설정 포함).
  if (v_sms_count > 0 and v_sms_rate_id is null)
     or (v_lms_count > 0 and v_lms_rate_id is null)
     or (v_alimtalk_count > 0 and v_alimtalk_rate_id is null) then
    return jsonb_build_object('ok', false, 'code', 'RATE_NOT_CONFIGURED',
      'message', '사용하려는 메시지 제품의 단가가 설정되지 않았습니다.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'resolved_recipients', v_resolved_recipients,
    'recipient_costs', v_recipient_costs,
    'excluded_count', v_original_count - v_resolved_count,
    'counts', jsonb_build_object('total', v_resolved_count,
      'sms', v_sms_count, 'lms', v_lms_count, 'alimtalk', v_alimtalk_count),
    'rate_ids', jsonb_build_object(
      'sms', v_sms_rate_id, 'lms', v_lms_rate_id, 'alimtalk', v_alimtalk_rate_id),
    'rate_snapshot', jsonb_build_object(
      'sms', jsonb_build_object('id', v_sms_rate_id, 'points', v_sms_points),
      'lms', jsonb_build_object('id', v_lms_rate_id, 'points', v_lms_points),
      'alimtalk', jsonb_build_object('id', v_alimtalk_rate_id, 'points', v_alimtalk_points)),
    'estimated_points', v_estimated_points
  );
end
$$;
revoke all on function public.resolve_message_point_quote(bigint, text, jsonb, bigint, text)
  from public, anon, authenticated;

-- ===== 사용자 견적: p_body 추가 + provider_pending을 예약 합계에 포함 =====
drop function if exists public.quote_message_points(text, jsonb, bigint);
create or replace function public.quote_message_points(
  p_mode text,
  p_recipients jsonb,
  p_template_id bigint default null,
  p_body text default null
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

  v_quote := public.resolve_message_point_quote(v_org_id, p_mode, p_recipients, p_template_id, p_body);
  if not coalesce((v_quote->>'ok')::boolean, false) then
    return v_quote || jsonb_build_object('billing_mode', 'stub');
  end if;

  select coalesce(sum(point_transaction.points), 0)::bigint into v_ledger_balance
  from public.point_transactions point_transaction where point_transaction.org_id = v_org_id;

  select coalesce(sum(reservation.reserved_points), 0)::bigint into v_reserved_points
  from public.message_point_reservations reservation
  where reservation.org_id = v_org_id
    and reservation.status in ('reserved', 'provider_pending', 'reconcile_required');

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
revoke all on function public.quote_message_points(text, jsonb, bigint, text) from public, anon;
grant execute on function public.quote_message_points(text, jsonb, bigint, text) to authenticated;

-- ===== 예약: 최종 본문으로 재견적 + provider_pending을 예약 합계에 포함 =====
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

  perform 1 from public.organizations organization
  where organization.id = p_org_id and organization.status = 'active' for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'ORG_NOT_ACTIVE');
  end if;

  if not exists (
    select 1 from public.org_members member
    join public.profiles profile on profile.user_id = member.user_id
    where member.org_id = p_org_id and member.user_id = p_requested_by and profile.is_active
      and (member.role in ('org_owner', 'platform_admin') or member.feature_permissions ? 'messaging')
  ) then
    return jsonb_build_object('ok', false, 'code', 'REQUESTER_FORBIDDEN');
  end if;

  select reservation.* into v_existing
  from public.message_point_reservations reservation
  where reservation.org_id = p_org_id and reservation.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.payload_hash <> p_payload_hash then
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return jsonb_build_object('ok', true, 'replayed', true,
      'reservation_id', v_existing.id, 'message_log_id', v_existing.message_log_id,
      'status', v_existing.status, 'reserved_points', v_existing.reserved_points,
      'charged_points', v_existing.charged_points);
  end if;

  v_quote := public.resolve_message_point_quote(p_org_id, p_mode, p_recipients, p_template_id, p_body);
  if not coalesce((v_quote->>'ok')::boolean, false) then
    return v_quote;
  end if;

  if p_confirmed_points is distinct from (v_quote->>'estimated_points')::integer
    or coalesce(p_confirmed_rate_ids, '{}'::jsonb) is distinct from v_quote->'rate_ids' then
    return jsonb_build_object('ok', false, 'code', 'QUOTE_CHANGED', 'quote', v_quote);
  end if;

  select coalesce(sum(point_transaction.points), 0)::bigint into v_ledger_balance
  from public.point_transactions point_transaction where point_transaction.org_id = p_org_id;

  select coalesce(sum(reservation.reserved_points), 0)::bigint into v_reserved_points
  from public.message_point_reservations reservation
  where reservation.org_id = p_org_id
    and reservation.status in ('reserved', 'provider_pending', 'reconcile_required');

  v_available_points := v_ledger_balance - v_reserved_points;
  if v_available_points < (v_quote->>'estimated_points')::bigint then
    return jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_POINTS',
      'ledger_balance', v_ledger_balance, 'reserved_points', v_reserved_points,
      'available_points', v_available_points, 'required_points', (v_quote->>'estimated_points')::bigint);
  end if;

  select coalesce(jsonb_agg(recipient.value || jsonb_build_object('result', 'queued')
    order by recipient.ordinality), '[]'::jsonb)
  into v_log_recipients
  from jsonb_array_elements(v_quote->'resolved_recipients') with ordinality as recipient(value, ordinality);

  insert into public.message_logs(
    org_id, channel, body, context, recipient_count, recipients, result,
    sent_by, template_id, estimated_points, charged_points, point_status
  ) values (
    p_org_id, p_mode, p_body, coalesce(p_context, 'manual'),
    (v_quote->'counts'->>'total')::integer, v_log_recipients, 'queued',
    p_requested_by, p_template_id, (v_quote->>'estimated_points')::integer, 0, 'reserved'
  ) returning id into v_log_id;

  insert into public.message_point_reservations(
    org_id, message_log_id, idempotency_key, payload_hash, status,
    reserved_points, charged_points, rate_snapshot, recipient_costs, requested_by, expires_at
  ) values (
    p_org_id, v_log_id, p_idempotency_key, p_payload_hash, 'reserved',
    (v_quote->>'estimated_points')::integer, 0, v_quote->'rate_snapshot',
    v_quote->'recipient_costs', p_requested_by, now() + interval '15 minutes'
  ) returning id into v_reservation_id;

  return jsonb_build_object('ok', true, 'replayed', false,
    'reservation_id', v_reservation_id, 'message_log_id', v_log_id,
    'status', 'reserved', 'reserved_points', (v_quote->>'estimated_points')::integer,
    'recipient_costs', v_quote->'recipient_costs',
    'resolved_recipients', v_quote->'resolved_recipients');
end
$$;
revoke all on function public.reserve_message_points(
  bigint, uuid, uuid, text, text, text, text, jsonb, bigint, jsonb, integer
) from public, anon, authenticated;
grant execute on function public.reserve_message_points(
  bigint, uuid, uuid, text, text, text, text, jsonb, bigint, jsonb, integer
) to service_role;

-- ===== 잔액 조회/조정: provider_pending을 활성 예약 합계에 포함 =====
create or replace function public.platform_list_point_balances()
returns table (org_id bigint, ledger_balance bigint, reserved_points bigint, available_points bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  return query
  with ledger as (
    select point_transaction.org_id, coalesce(sum(point_transaction.points), 0)::bigint as balance
    from public.point_transactions point_transaction group by point_transaction.org_id
  ),
  active_reservations as (
    select reservation.org_id, coalesce(sum(reservation.reserved_points), 0)::bigint as reserved
    from public.message_point_reservations reservation
    where reservation.status in ('reserved', 'provider_pending', 'reconcile_required')
    group by reservation.org_id
  )
  select organization.id,
    coalesce(ledger.balance, 0)::bigint,
    coalesce(active_reservations.reserved, 0)::bigint,
    (coalesce(ledger.balance, 0) - coalesce(active_reservations.reserved, 0))::bigint
  from public.organizations organization
  left join ledger on ledger.org_id = organization.id
  left join active_reservations on active_reservations.org_id = organization.id
  order by organization.id;
end
$$;
revoke all on function public.platform_list_point_balances() from public, anon;
grant execute on function public.platform_list_point_balances() to authenticated;

create or replace function public.platform_record_point_adjustment(
  p_org_id bigint, p_kind text, p_points integer,
  p_amount_krw integer default null, p_memo text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
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
  if nullif(btrim(coalesce(p_memo, '')), '') is null or length(btrim(p_memo)) > 200 then
    raise exception 'invalid memo: 1-200 characters required' using errcode = '22023';
  end if;

  perform 1 from public.organizations organization where organization.id = p_org_id for update;
  if not found then raise exception 'organization not found' using errcode = 'P0002'; end if;

  select coalesce(sum(point_transaction.points), 0)::bigint into v_ledger_balance
  from public.point_transactions point_transaction where point_transaction.org_id = p_org_id;

  select coalesce(sum(reservation.reserved_points), 0)::bigint into v_reserved_points
  from public.message_point_reservations reservation
  where reservation.org_id = p_org_id
    and reservation.status in ('reserved', 'provider_pending', 'reconcile_required');

  v_after_balance := v_ledger_balance + p_points;
  if p_points < 0 and v_after_balance < v_reserved_points then
    return jsonb_build_object('ok', false,
      'code', case when v_reserved_points > 0 then 'POINTS_RESERVED' else 'INSUFFICIENT_POINTS' end,
      'ledger_balance', v_ledger_balance, 'reserved_points', v_reserved_points);
  end if;

  v_label := case p_kind when 'correction' then '정정' when 'deduction' then '차감' when 'refund' then '환불' end;

  insert into public.point_transactions(org_id, type, points, amount_krw, memo, created_by)
  values (p_org_id, 'adjustment'::public.point_tx_type, p_points,
    case when p_kind = 'refund' then p_amount_krw else null end,
    '[' || v_label || '] ' || btrim(p_memo), (select auth.uid()))
  returning id into v_transaction_id;

  return jsonb_build_object('ok', true, 'transaction_id', v_transaction_id);
end
$$;
revoke all on function public.platform_record_point_adjustment(bigint, text, integer, integer, text)
  from public, anon;
grant execute on function public.platform_record_point_adjustment(bigint, text, integer, integer, text)
  to authenticated;

-- ===== 제출 작업 생성(service_role): submitting 상태로 job+recipient 저장 =====
-- p_jobs: [{ product, request_num, recipients: [{ recipient_key, provider_ref_key }] }]
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
      schedule_id, request_num, status
    ) values (
      v_reservation.org_id, 'popbill', 'message', v_job->>'product',
      p_reservation_id, v_reservation.message_log_id,
      nullif(v_job->>'schedule_id', '')::bigint, v_job->>'request_num', 'submitting'
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

-- ===== 접수 결과 반영(service_role): receipt 저장 + 예약 provider_pending 전환 =====
-- p_outcomes: [{ request_num, outcome: 'accepted'|'failed'|'unknown', receipt_num?, error_code?, error_message? }]
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
  v_accepted integer := 0;
  v_unknown integer := 0;
  v_failed integer := 0;
  v_new_status text;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;
  select * into v_reservation from public.message_point_reservations where id = p_reservation_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND'); end if;

  for v_outcome in select value from jsonb_array_elements(p_outcomes) loop
    if v_outcome->>'outcome' = 'accepted' then
      update public.provider_dispatch_jobs
        set receipt_num = v_outcome->>'receipt_num', status = 'pending',
            submitted_at = now(), next_poll_at = now() + interval '1 minute',
            last_error_code = null, last_error_message = null
        where reservation_id = p_reservation_id and request_num = v_outcome->>'request_num';
      v_accepted := v_accepted + 1;
    elsif v_outcome->>'outcome' = 'unknown' then
      update public.provider_dispatch_jobs
        set status = 'reconcile_required',
            last_error_code = v_outcome->>'error_code',
            last_error_message = left(coalesce(v_outcome->>'error_message', ''), 500)
        where reservation_id = p_reservation_id and request_num = v_outcome->>'request_num';
      v_unknown := v_unknown + 1;
    else
      update public.provider_dispatch_jobs
        set status = 'failed', completed_at = now(),
            last_error_code = v_outcome->>'error_code',
            last_error_message = left(coalesce(v_outcome->>'error_message', ''), 500)
        where reservation_id = p_reservation_id and request_num = v_outcome->>'request_num';
      update public.provider_dispatch_recipients
        set status = 'failed', completed_at = now(),
            result_code = v_outcome->>'error_code'
        where job_id in (
          select id from public.provider_dispatch_jobs
          where reservation_id = p_reservation_id and request_num = v_outcome->>'request_num'
        ) and status = 'pending';
      v_failed := v_failed + 1;
    end if;
  end loop;

  if v_accepted > 0 then
    v_new_status := 'provider_pending';
  elsif v_unknown > 0 then
    v_new_status := 'reconcile_required';
  else
    v_new_status := 'released';
  end if;

  if v_new_status = 'released' then
    -- 접수가 하나도 안 됐고 확정 실패만 있으면 즉시 전액 반환한다.
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

  return jsonb_build_object('ok', true, 'status', v_new_status,
    'accepted', v_accepted, 'unknown', v_unknown, 'failed', v_failed);
end
$$;
revoke all on function public.mark_message_reservation_provider_pending(bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.mark_message_reservation_provider_pending(bigint, jsonb) to service_role;

-- ===== 최종 정산(service_role, 멱등): 성공 수신자만 차감, 실패분 반환 =====
create or replace function public.settle_message_points_from_jobs(p_reservation_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.message_point_reservations%rowtype;
  v_org_id bigint;
  v_total integer;
  v_success integer;
  v_charged integer;
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
    -- 연결된 예약 스케줄/고지서를 실패로 최종화한다(즉시발송이면 매칭 0건).
    update public.message_schedules
      set status = 'failed'
      where message_log_id = v_reservation.message_log_id and status = 'sending';
    update public.bill_issues
      set send_status = 'failed'
      where message_schedule_id in (
        select id from public.message_schedules where message_log_id = v_reservation.message_log_id
      );
    return jsonb_build_object('ok', true, 'status', 'released', 'result', 'failed', 'charged_points', 0);
  end if;

  insert into public.point_transactions(
    org_id, type, points, amount_krw, memo, created_by, message_log_id, reservation_id
  ) values (
    v_org_id, 'usage'::public.point_tx_type, -v_charged, null,
    '메시지 발송 · SMS ' || v_sms || ' · LMS ' || v_lms || ' · 알림톡 ' || v_alimtalk,
    v_reservation.requested_by, v_reservation.message_log_id, p_reservation_id
  );

  v_log_result := case when v_success = v_total then 'sent' else 'partial' end;

  update public.message_point_reservations
    set status = 'settled', charged_points = v_charged, settled_at = now()
    where id = p_reservation_id;
  update public.message_logs
    set result = v_log_result, charged_points = v_charged, point_status = 'settled'
    where id = v_reservation.message_log_id;

  -- 연결된 예약 스케줄을 sent/partial로, 고지서는 sent로 최종화한다(즉시발송이면 매칭 0건).
  update public.message_schedules
    set status = case when v_log_result = 'sent' then 'sent' else 'partial' end
    where message_log_id = v_reservation.message_log_id and status = 'sending';
  update public.bill_issues
    set send_status = 'sent'
    where message_schedule_id in (
      select id from public.message_schedules where message_log_id = v_reservation.message_log_id
    );

  return jsonb_build_object('ok', true, 'status', 'settled', 'result', v_log_result,
    'charged_points', v_charged, 'released_points', v_reservation.reserved_points - v_charged);
end
$$;
revoke all on function public.settle_message_points_from_jobs(bigint)
  from public, anon, authenticated;
grant execute on function public.settle_message_points_from_jobs(bigint) to service_role;

-- ===== 수동 만료 해제: provider_pending·reconcile_required는 후보에서 제외 =====
create or replace function public.platform_list_point_reservations(p_status text default null)
returns table (
  id bigint, org_id bigint, organization_name text, message_log_id bigint, status text,
  reserved_points integer, charged_points integer, age_seconds bigint, is_releasable boolean,
  expires_at timestamptz, created_at timestamptz, requested_by uuid, requested_by_name text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in (
    'reserved', 'provider_pending', 'settled', 'released', 'reconcile_required'
  ) then
    raise exception 'invalid reservation status' using errcode = '22023';
  end if;

  return query
  select reservation.id, reservation.org_id, organization.name, reservation.message_log_id,
    reservation.status, reservation.reserved_points, reservation.charged_points,
    greatest(0, extract(epoch from (now() - reservation.created_at))::bigint),
    -- provider 접수 전 'reserved' 예약이 만료됐고 provider 작업이 붙지 않은 경우만 해제 가능.
    (reservation.status = 'reserved' and reservation.expires_at <= now()
      and not exists (
        select 1 from public.provider_dispatch_jobs job
        where job.reservation_id = reservation.id and job.receipt_num is not null
      )),
    reservation.expires_at, reservation.created_at, reservation.requested_by, profile.full_name
  from public.message_point_reservations reservation
  join public.organizations organization on organization.id = reservation.org_id
  left join public.profiles profile on profile.user_id = reservation.requested_by
  where p_status is null or reservation.status = p_status
  order by reservation.created_at desc, reservation.id desc;
end
$$;
revoke all on function public.platform_list_point_reservations(text) from public, anon;
grant execute on function public.platform_list_point_reservations(text) to authenticated;

create or replace function public.platform_release_stale_reservation(p_id bigint, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_org_id bigint;
  v_reservation public.message_point_reservations%rowtype;
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null or length(btrim(p_reason)) > 500 then
    raise exception 'invalid reason: 1-500 characters required' using errcode = '22023';
  end if;

  select reservation.org_id into v_org_id
  from public.message_point_reservations reservation where reservation.id = p_id;
  if v_org_id is null then return jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND'); end if;

  perform 1 from public.organizations organization where organization.id = v_org_id for update;

  select reservation.* into v_reservation
  from public.message_point_reservations reservation where reservation.id = p_id for update;

  -- provider 접수/미확인 예약은 결과 확인 없이 해제하지 않는다. 오직 미접수 'reserved' 만료건만 허용.
  if v_reservation.status <> 'reserved' then
    return jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_ACTIVE');
  end if;
  if v_reservation.expires_at > now() then
    return jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_STALE');
  end if;
  if exists (
    select 1 from public.provider_dispatch_jobs job
    where job.reservation_id = p_id and job.receipt_num is not null
  ) then
    return jsonb_build_object('ok', false, 'code', 'PROVIDER_RECEIPT_EXISTS');
  end if;
  if exists (
    select 1 from public.point_transactions point_transaction
    where point_transaction.reservation_id = p_id
      and point_transaction.type = 'usage'::public.point_tx_type
  ) then
    return jsonb_build_object('ok', false, 'code', 'USAGE_ALREADY_RECORDED');
  end if;

  update public.message_point_reservations set status = 'released', settled_at = now() where id = p_id;
  update public.message_logs
    set result = 'failed', point_status = 'released', charged_points = 0
    where id = v_reservation.message_log_id;

  insert into public.audit_log(org_id, actor_id, action, table_name, row_pk, before, after)
  values (v_org_id, (select auth.uid()), 'MESSAGE_POINT_RESERVATION_RELEASE',
    'message_point_reservations', p_id::text,
    jsonb_build_object('status', v_reservation.status),
    jsonb_build_object('status', 'released', 'reason', btrim(p_reason)));

  return jsonb_build_object('ok', true, 'reservation_id', p_id, 'status', 'released');
end
$$;
revoke all on function public.platform_release_stale_reservation(bigint, text) from public, anon;
grant execute on function public.platform_release_stale_reservation(bigint, text) to authenticated;

-- ===== 예약 발송 재견적/예약 재정의(0094 대체) =====
-- 변경점: (1) 최종 본문으로 sms/lms 판정, (2) provider_pending을 예약 합계에 포함,
--        (3) 예약 생성 즉시 message_schedules.message_log_id 연결(재조회가 스케줄을 최종화 가능).
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

  v_quote := resolve_message_point_quote(v_row.org_id, v_row.channel, v_row.recipients, v_row.template_id, v_row.body);
  if not coalesce((v_quote->>'ok')::boolean, false) then
    return v_quote;  -- {ok:false, code}
  end if;

  if v_row.template_id is not null and exists (
    select 1 from jsonb_array_elements(v_quote->'resolved_recipients') r(v)
    where r.v->>'channel' = 'alimtalk'
  ) then
    select mt.alimtalk_template_code, coalesce(mt.buttons, '[]'::jsonb)
      into v_tpl_code, v_buttons
    from message_templates mt where mt.id = v_row.template_id;
  end if;

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
      'ok', true, 'replayed', true, 'reservation_status', v_existing.status,
      'reservation_id', v_existing.id, 'message_log_id', v_existing.message_log_id,
      'resolved_recipients', v_quote->'resolved_recipients',
      'recipient_costs', v_quote->'recipient_costs',
      'alimtalk_template_code', v_tpl_code, 'buttons', v_buttons
    );
  end if;

  -- 잔액 하드스톱(provider_pending 포함)
  select coalesce(sum(points), 0)::bigint into v_ledger
    from point_transactions where org_id = v_row.org_id;
  select coalesce(sum(reserved_points), 0)::bigint into v_reserved
    from message_point_reservations
    where org_id = v_row.org_id and status in ('reserved', 'provider_pending', 'reconcile_required');
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

  -- 재조회 정산이 원래 스케줄을 최종화할 수 있도록 로그를 즉시 연결한다.
  update message_schedules set message_log_id = v_log_id where id = p_schedule_id;

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

-- ===== 결과 반영(service_role, 멱등): 수신자 terminal 반영 + job 집계 + 예약 정산 =====
-- p_results: [{ provider_ref_key, status: 'success'|'failed', code }]
-- p_next_poll_at: pending 유지 시 다음 조회 시각(null이면 24시간 초과로 reconcile_required)
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

  -- 이미 terminal/미확인으로 넘어간 작업은 재처리하지 않는다(멱등).
  if v_job.status <> 'pending' then
    return jsonb_build_object('ok', true, 'replayed', true, 'job_status', v_job.status);
  end if;

  -- terminal 결과를 pending 수신자에만 반영(중복 polling 안전).
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
  else
    v_new_status := 'pending';
    update public.provider_dispatch_jobs
      set next_poll_at = p_next_poll_at, lease_until = null
      where id = p_job_id;
  end if;

  -- 예약의 모든 job이 terminal이면 성공분만 멱등 정산한다.
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
grant execute on function public.apply_provider_dispatch_results(bigint, jsonb, timestamptz) to service_role;

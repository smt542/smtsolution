-- 0254_suspended_org_resident_and_scheduled_gate.sql
-- 정책문제점_개선1차 #5: 정지·해지된 테넌트의 세입자 앱 접속과 예약 발송이 계속됨.
-- 정책(통합관리자_테넌트 관리 88행): 정지/해지 → 해당 테넌트의 staff·partner·resident 접속 제한.
-- staff·partner는 0229에서 막혔고(org_is_operational = status='active' and deleted_at is null),
-- 여기서는 세입자 RPC와 예약 발송 경로에 같은 판정을 건다.
--  - resident_linked_unit / resident_my_link: 운영 중인 조직의 세대만 돌려준다
--    (resident_linked_unit을 쓰는 세입자 RPC 전체가 함께 막힌다).
--  - resident_automatch: 운영 중인 조직만 매칭.
--  - resident_confirm / resident_request_claim / resident_search_buildings: 비운영 조직 건물은 연결·신청·검색 불가.
--  - reserve_message_points: deleted_at 확인 추가.
--  - reserve_scheduled_message: 예약 발송 cron 경로에 조직 운영 확인 추가(ORG_NOT_ACTIVE → 스케줄 failed 마감).
-- 변경하지 않은 것: resident_withdraw(해지 조직의 세입자도 탈퇴할 수 있어야 함), public_* 공개 링크(범위 밖).
-- create or replace는 기존 ACL을 유지한다.

create or replace function public.resident_linked_unit()
 returns table(org_id bigint, building_id bigint, unit_id bigint, occupancy_id bigint, move_in date, move_out date, tenant_name text)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select
    b.org_id,
    b.id,
    u.id,
    o.id,
    o.move_in_date,
    o.move_out_date,
    o.tenant_name
  from res_claims rc
  join occupancies o on o.id = rc.occupancy_id
    and o.deleted_at is null
    and o.status in ('occupied', 'moving_out')
  join units u on u.id = o.unit_id
  join buildings b on b.id = u.building_id
  join organizations org on org.id = b.org_id
    and org.status = 'active'
    and org.deleted_at is null
  where rc.resident_user_id = auth.uid()
    and rc.status = 'linked'
    and coalesce(rc.resolved_at, rc.created_at) > coalesce((select max(h.created_at) from occupancy_history h where h.unit_id = u.id), '-infinity'::timestamptz)
  order by rc.created_at desc, rc.id desc
  limit 1;
$function$;

create or replace function public.resident_my_link()
 returns table(claim_id bigint, org_id bigint, building_id bigint, building_name text, unit_id bigint, unit_no text, occupancy_id bigint, tenant_name text, occupancy_phone text, linked_at timestamp with time zone)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return query
  select
    rc.id,
    rc.org_id,
    rc.building_id,
    b.name,
    rc.unit_id,
    u.unit_no,
    rc.occupancy_id,
    o.tenant_name,
    o.phone,
    coalesce(rc.resolved_at, rc.created_at)
  from res_claims rc
  join organizations org on org.id = rc.org_id
    and org.status = 'active'
    and org.deleted_at is null
  left join buildings b on b.id = rc.building_id
  left join units u on u.id = rc.unit_id
  left join occupancies o on o.id = rc.occupancy_id
  where rc.resident_user_id = auth.uid()
    and rc.status = 'linked'
    and coalesce(rc.resolved_at, rc.created_at) > coalesce((select max(h.created_at) from occupancy_history h where h.unit_id = rc.unit_id), '-infinity'::timestamptz)
  order by rc.created_at desc
  limit 1;
end
$function$;

create or replace function public.resident_automatch()
 returns table(org_id bigint, building_id bigint, building_name text, unit_id bigint, unit_no text, occupancy_id bigint, kakao_name text, tenant_name_masked text, phone_masked text, move_in_date date, org_name text, profile_image_url text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return query
  with matched as (
    select
      b.org_id,
      b.id as building_id,
      b.name as building_name,
      u.id as unit_id,
      u.unit_no,
      o.id as occupancy_id,
      ri.kakao_name,
      btrim(coalesce(o.tenant_name, '')) as name,
      normalize_phone(o.phone) as digits,
      o.move_in_date,
      org.name as org_name,
      ri.profile_image_url
    from resident_identities ri
    join occupancies o
      on normalize_phone(o.phone) = normalize_phone(ri.phone)
     and normalize_phone(o.phone) is not null
     and o.status = 'occupied'
     and o.deleted_at is null
    join units u
      on u.id = o.unit_id
     and u.deleted_at is null
    join buildings b
      on b.id = u.building_id
     and b.deleted_at is null
    join organizations org
      on org.id = b.org_id
     and org.status = 'active'
     and org.deleted_at is null
    where ri.user_id = auth.uid()
  )
  select
    m.org_id,
    m.building_id,
    m.building_name,
    m.unit_id,
    m.unit_no,
    m.occupancy_id,
    m.kakao_name,
    case
      when m.name = '' then null
      when length(m.name) = 1 then m.name
      when length(m.name) = 2 then left(m.name, 1) || 'O'
      else left(m.name, 1) || repeat('O', length(m.name) - 2) || right(m.name, 1)
    end as tenant_name_masked,
    case
      when m.digits is null then null
      when length(m.digits) >= 7 then left(m.digits, 3) || '-****-' || right(m.digits, 4)
      else m.digits
    end as phone_masked,
    m.move_in_date,
    m.org_name,
    m.profile_image_url
  from matched m
  order by m.building_name, m.unit_no, m.occupancy_id;
end
$function$;

create or replace function public.resident_confirm(p_occupancy_id bigint)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_identity resident_identities%rowtype;
  v_org_id bigint;
  v_building_id bigint;
  v_unit_id bigint;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_identity
  from resident_identities
  where user_id = auth.uid();
  if not found then
    raise exception 'resident identity not found';
  end if;

  select b.org_id, b.id, u.id
    into v_org_id, v_building_id, v_unit_id
  from occupancies o
  join units u on u.id = o.unit_id and u.deleted_at is null
  join buildings b on b.id = u.building_id and b.deleted_at is null
  join organizations org on org.id = b.org_id
    and org.status = 'active'
    and org.deleted_at is null
  where o.id = p_occupancy_id
    and normalize_phone(o.phone) = normalize_phone(v_identity.phone)
    and normalize_phone(o.phone) is not null
    and o.status = 'occupied'
    and o.deleted_at is null;
  if not found then
    raise exception 'occupancy does not match resident phone';
  end if;

  -- 자동확정으로 linked가 생기면 기존 pending(스태프 승인 대기)은 무의미해지므로 제거한다.
  -- (제거하지 않으면 pending+linked 공존 → 유령 pending)
  delete from res_claims
  where resident_user_id = auth.uid()
    and status = 'pending';

  insert into res_claims (
    org_id, resident_user_id, kakao_id, kakao_name,
    claimed_name, claimed_phone, building_id, unit_id, occupancy_id,
    status, kind, resolved_at
  ) values (
    v_org_id, auth.uid(), v_identity.kakao_id, v_identity.kakao_name,
    v_identity.kakao_name, v_identity.phone, v_building_id, v_unit_id, p_occupancy_id,
    'linked', 'auto', now()
  )
  on conflict (resident_user_id) where status = 'linked'
  do update set
    org_id = excluded.org_id,
    kakao_id = excluded.kakao_id,
    kakao_name = excluded.kakao_name,
    claimed_name = excluded.claimed_name,
    claimed_phone = excluded.claimed_phone,
    building_id = excluded.building_id,
    unit_id = excluded.unit_id,
    occupancy_id = excluded.occupancy_id,
    kind = 'auto',
    memo = null,
    resolved_at = now(),
    resolved_by = null;
end
$function$;

create or replace function public.resident_request_claim(p_building_id bigint, p_unit_text text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_identity resident_identities%rowtype;
  v_org_id bigint;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_unit_text, '')), '') is null then
    raise exception 'unit text required';
  end if;

  select * into v_identity
  from resident_identities
  where user_id = auth.uid();
  if not found then
    raise exception 'resident identity not found';
  end if;

  select b.org_id into v_org_id
  from buildings b
  join organizations org on org.id = b.org_id
    and org.status = 'active'
    and org.deleted_at is null
  where b.id = p_building_id and b.deleted_at is null;
  if not found then
    raise exception 'building not found';
  end if;

  insert into res_claims (
    org_id, resident_user_id, kakao_id, kakao_name,
    claimed_name, claimed_phone, building_id, claimed_unit_text,
    status, kind
  ) values (
    v_org_id, auth.uid(), v_identity.kakao_id, v_identity.kakao_name,
    v_identity.kakao_name, v_identity.phone, p_building_id, btrim(p_unit_text),
    'pending', 'manual'
  );
end
$function$;

create or replace function public.resident_search_buildings(p_q text default null::text)
 returns table(building_id bigint, org_id bigint, name text, address text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with matched_orgs as (
    select distinct m.org_id
    from resident_automatch() m
  )
  select b.id, b.org_id, b.name, b.address
  from buildings b
  join matched_orgs mo
    on mo.org_id = b.org_id
  join organizations org on org.id = b.org_id
    and org.status = 'active'
    and org.deleted_at is null
  where b.deleted_at is null
    and (
      nullif(btrim(coalesce(p_q, '')), '') is null
      or b.name ilike '%' || btrim(p_q) || '%'
      or b.address ilike '%' || btrim(p_q) || '%'
    )
  order by b.name, b.id;
$function$;

create or replace function public.reserve_message_points(p_org_id bigint, p_requested_by uuid, p_idempotency_key uuid, p_payload_hash text, p_mode text, p_body text, p_context text, p_recipients jsonb, p_template_id bigint, p_confirmed_rate_ids jsonb, p_confirmed_points integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
  where organization.id = p_org_id and organization.status = 'active'
    and organization.deleted_at is null for update;
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

  perform public.lock_point_pool();
  select coalesce(sum(point_transaction.points), 0)::bigint into v_ledger_balance
  from public.point_transactions point_transaction;

  select coalesce(sum(reservation.reserved_points), 0)::bigint into v_reserved_points
  from public.message_point_reservations reservation
  where reservation.status in ('reserved', 'provider_pending', 'reconcile_required');

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
$function$;

create or replace function public.reserve_scheduled_message(p_schedule_id bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_row public.message_schedules%rowtype;
  v_quote jsonb;
  v_idem uuid;
  v_hash text;
  v_existing public.message_point_reservations%rowtype;
  v_log_result text;
  v_ledger bigint; v_reserved bigint; v_available bigint;
  v_log_id bigint; v_reservation_id bigint; v_log_recipients jsonb;
  v_tpl_code text := null; v_buttons jsonb := '[]'::jsonb;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;

  select * into v_row from public.message_schedules where id = p_schedule_id;
  if not found or v_row.status <> 'sending' then
    return jsonb_build_object('ok', false, 'code', 'SCHEDULE_NOT_CLAIMED');
  end if;

  -- 정지·해지된 테넌트의 예약 발송은 접수하지 않는다(스케줄은 호출부가 failed로 마감).
  if not public.org_is_operational(v_row.org_id) then
    return jsonb_build_object('ok', false, 'code', 'ORG_NOT_ACTIVE');
  end if;

  v_idem := md5('scheduled-message:' || p_schedule_id::text)::uuid;

  v_quote := public.resolve_message_point_quote(v_row.org_id, v_row.channel, v_row.recipients, v_row.template_id, v_row.body);
  if not coalesce((v_quote->>'ok')::boolean, false) then
    return v_quote;  -- {ok:false, code}
  end if;

  if v_row.template_id is not null and exists (
    select 1 from jsonb_array_elements(v_quote->'resolved_recipients') r(v)
    where r.v->>'channel' = 'alimtalk'
  ) then
    select mt.alimtalk_template_code, coalesce(mt.buttons, '[]'::jsonb)
      into v_tpl_code, v_buttons
    from public.message_templates mt where mt.id = v_row.template_id;
  end if;

  select * into v_existing from public.message_point_reservations
    where org_id = v_row.org_id and idempotency_key = v_idem;
  if found then
    if v_existing.status in ('settled', 'released') then
      select result into v_log_result from public.message_logs where id = v_existing.message_log_id;
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
  perform public.lock_point_pool();
  select coalesce(sum(points), 0)::bigint into v_ledger
    from public.point_transactions;
  select coalesce(sum(reserved_points), 0)::bigint into v_reserved
    from public.message_point_reservations
    where status in ('reserved', 'provider_pending', 'reconcile_required');
  v_available := v_ledger - v_reserved;
  if v_available < (v_quote->>'estimated_points')::bigint then
    return jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_POINTS',
      'required_points', (v_quote->>'estimated_points')::bigint, 'available_points', v_available);
  end if;

  v_hash := left(md5(v_row.channel || '|' || v_row.body || '|' || v_row.recipients::text), 128);

  select coalesce(jsonb_agg(r.v || jsonb_build_object('result', 'queued') order by r.ord), '[]'::jsonb)
    into v_log_recipients
  from jsonb_array_elements(v_quote->'resolved_recipients') with ordinality as r(v, ord);

  insert into public.message_logs(
    org_id, channel, body, context, recipient_count, recipients, result,
    sent_by, template_id, estimated_points, charged_points, point_status
  ) values (
    v_row.org_id, v_row.channel, v_row.body, coalesce(v_row.context, 'manual'),
    (v_quote->'counts'->>'total')::integer, v_log_recipients, 'queued',
    v_row.created_by, v_row.template_id, (v_quote->>'estimated_points')::integer, 0, 'reserved'
  ) returning id into v_log_id;

  insert into public.message_point_reservations(
    org_id, message_log_id, idempotency_key, payload_hash, status,
    reserved_points, charged_points, rate_snapshot, recipient_costs, requested_by, expires_at
  ) values (
    v_row.org_id, v_log_id, v_idem, v_hash, 'reserved',
    (v_quote->>'estimated_points')::integer, 0, v_quote->'rate_snapshot',
    v_quote->'recipient_costs', v_row.created_by, now() + interval '15 minutes'
  ) returning id into v_reservation_id;

  -- 재조회 정산이 원래 스케줄을 최종화할 수 있도록 로그를 즉시 연결한다.
  update public.message_schedules set message_log_id = v_log_id where id = p_schedule_id;

  return jsonb_build_object(
    'ok', true, 'replayed', false, 'reservation_status', 'reserved',
    'reservation_id', v_reservation_id, 'message_log_id', v_log_id,
    'resolved_recipients', v_quote->'resolved_recipients',
    'recipient_costs', v_quote->'recipient_costs',
    'alimtalk_template_code', v_tpl_code, 'buttons', v_buttons
  );
end $function$;
